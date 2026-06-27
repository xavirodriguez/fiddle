/**
 * tone-bridge.ts
 *
 * Bridge to ensure Tone.js and the native Web Audio DSP pipeline share
 * the exact same AudioContext and temporal reference.
 *
 * Design Decisions:
 * 1. Single Source of Truth: All audio operations use the native context
 *    from AudioManager. This ensures that the metronome, accompaniment,
 *    and DSP pipeline (pitch detection) all reference the exact same
 *    hardware clock, eliminating drift over time.
 * 2. Nominal Typing (Branding): We use intersection types with a unique
 *    brand property to ensure that Seconds and BPM are not interchangeable
 *    with raw numbers. This prevents unit-mixing errors (e.g. adding BPM to Seconds).
 * 3. Idempotency: Tone.setContext and Tone.getTransport().context assignment
 *    are protected to avoid redundant re-initialization which can cause
 *    audible glitches or scheduling resets.
 * 4. Functional Error Handling: Uses `neverthrow` to manage initialization
 *    results, forcing callers to explicitly handle hardware failures.
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
   * 1. Sharing Context: Prevents audio clock drift between different engines.
   * 2. Context State Management: Automatically resumes suspended contexts.
   * 3. Sample-Accurate Scheduling: Setting Tone.getTransport().context is
   *    mandatory for precision timing.
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

        // Critical: Ensure the transport uses the same clock for sample-accurate scheduling
        // @ts-ignore - Transport context must be set manually for full synchronization
        Tone.getTransport().context = toneContext

        this.isInitialized = true
        console.info('[ToneBridge] Tone.js successfully synchronized with native AudioContext.')
      }

      // Browser policy: Resume context on user interaction
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
   * Returns the current time in seconds from the shared audio clock.
   */
  static getCurrentTime(): Seconds {
    return makeSeconds(Tone.now())
  }

  /**
   * Updates the global transport BPM using nominal BPM type.
   */
  static setBpm(bpm: BPM): void {
    Tone.getTransport().bpm.value = bpm
  }

  /**
   * Resets the bridge state for testing purposes.
   */
  static _reset(): void {
    this.isInitialized = false
  }
}
