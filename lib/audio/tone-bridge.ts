/**
 * tone-bridge.ts
 *
 * Bridge to ensure Tone.js and the native Web Audio DSP pipeline share
 * the exact same AudioContext and temporal reference.
 *
 * ARCHITECTURAL DESIGN DECISIONS:
 *
 * 1. Single Source of Truth (Temporal Sync):
 *    All audio operations must use the same native AudioContext. By forcing
 *    Tone.js to share the context from AudioManager, we ensure that the
 *    musical scheduler (Tone.Transport) and the DSP pipeline (Pitch Detection)
 *    reference the exact same hardware clock. This eliminates drift between
 *    accompaniment and analysis.
 *
 * 2. Nominal Typing (Unit Safety):
 *    Uses branded types for `Seconds` and `BPM`. This prevents common
 *    musical computing errors, such as accidentally adding a tempo value
 *    to a time value or passing raw numbers where specific units are required.
 *
 * 3. Idempotency & Lifecycle:
 *    `initialize()` is designed to be safe to call multiple times. It
 *    protects against redundant re-initialization of Tone's internal
 *    context, which can cause audible glitches or reset the musical timeline.
 *
 * 4. Sample-Accurate Precision:
 *    By setting Tone's context directly and using the transport's scheduling
 *    capabilities (which use the AudioContext's look-ahead), we guarantee
 *    events are triggered with hardware-level precision, bypassing the
 *    main thread's variable jitter.
 */

import { err, ok, type Result } from 'neverthrow'
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
        // @ts-expect-error - Transport context is sometimes typed as read-only but must be set here
        Tone.getTransport().context = toneContext

        this.isInitialized = true
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
