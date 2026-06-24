/**
 * tone-bridge.ts
 *
 * Bridge to ensure Tone.js and the native Web Audio DSP pipeline share
 * the exact same AudioContext and temporal reference.
 *
 * Design Decisions:
 * 1. Single Source of Truth: All audio operations use the native context
 *    from AudioManager.
 * 2. Nominal Typing: Branded types for Seconds and BPM to prevent
 *    mathematical errors in scheduling.
 * 3. Idempotency: Tone.setContext is only called once or when the
 *    context changes to avoid re-initialization overhead.
 * 4. Error Handling: Uses neverthrow to manage initialization results.
 */

import { err,ok, type Result } from 'neverthrow'
import * as Tone from 'tone'

import { AppError, ERROR_CODES } from '@/lib/errors/app-error'
import { audioManager } from '@/lib/infrastructure/audio-manager'

/**
 * Branded type for time in seconds.
 */
export type Seconds = number & { readonly __brand: 'Seconds' }

/**
 * Branded type for tempo in Beats Per Minute.
 */
export type BPM = number & { readonly __brand: 'BPM' }

/**
 * Factory for Seconds.
 */
export function makeSeconds(value: number): Seconds {
  return value as Seconds
}

/**
 * Factory for BPM.
 */
export function makeBPM(value: number): BPM {
  return value as BPM
}

export class ToneBridge {
  private static isInitialized = false

  /**
   * Synchronizes Tone.js with the application's global AudioContext.
   * MUST be called after AudioManager.initialize().
   *
   * Architectural Decisions:
   * 1. Sharing Context: Prevents audio clock drift and resource contention.
   * 2. Idempotency: Multiple calls are safe; initialization happens once.
   * 3. Nominal Typing: Branded types prevent mixing BPM/Seconds with raw numbers.
   */
  static async initialize(): Promise<Result<void, AppError>> {
    const nativeContext = audioManager.getContext()

    if (!nativeContext) {
      return err(
        new AppError({
          message:
            'Cannot initialize ToneBridge: native AudioContext is null. Ensure AudioManager is initialized first.',
          code: ERROR_CODES.HARDWARE_NOT_FOUND,
        }),
      )
    }

    try {
      if (!this.isInitialized) {
        // Force Tone.js to use the application's shared AudioContext
        const toneContext = new Tone.Context(nativeContext)
        Tone.setContext(toneContext)

        // Ensure the transport is synchronized with the context
        // This is critical for sample-accurate scheduling
        // @ts-ignore - Transport context is sometimes typed as read-only but must be set here
        Tone.getTransport().context = toneContext

        this.isInitialized = true
        console.info('[ToneBridge] Tone.js successfully synchronized with native AudioContext.')
      }

      // Resume context if suspended (required by browser policies)
      if (nativeContext.state === 'suspended') {
        await Tone.start()
      }

      return ok(undefined)
    } catch (error) {
      return err(
        new AppError({
          message: `ToneBridge initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: ERROR_CODES.INTERNAL_ERROR,
        }),
      )
    }
  }

  /**
   * Returns the current time in seconds according to the shared audio clock.
   */
  static getCurrentTime(): Seconds {
    return makeSeconds(Tone.now())
  }

  /**
   * Updates the global transport BPM using the nominal BPM type.
   */
  static setBpm(bpm: BPM): void {
    Tone.getTransport().bpm.value = bpm
  }

  /**
   * Resets the bridge state. Useful for testing.
   */
  static _reset(): void {
    this.isInitialized = false
  }
}
