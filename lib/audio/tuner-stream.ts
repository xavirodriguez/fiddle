/**
 * Tuner Stream
 *
 * Infrastructure adapter: wraps the Web Audio API + Pitchy into an RxJS
 * Observable that emits a PitchFrame on every animation frame.
 *
 * Zero-Allocation Contract
 * ------------------------
 * - `SHARED_PITCH_FRAME` from data-structures is mutated in-place and emitted
 *   by reference. Subscribers MUST NOT store the reference across frames — they
 *   must copy any values they need to persist.
 * - No `{}`, `[]`, or `new` inside the frame loop. Pre-allocated buffers only.
 *
 * Layer: Infrastructure (adapters). May import from domain & ports; must NOT
 * import from React, Zustand, or any UI framework.
 */

import { Observable, type Subscription } from 'rxjs'

import type { PitchFrame } from '../domain/data-structures'
import { audioPipeline } from './audio-pipeline'

/**
 * Configuration for the tuner stream.
 */
export interface TunerStreamConfig {
  /** FFT buffer size (power of 2). Default: 2048. */
  readonly fftSize?: number
  /** AudioContext sample rate override. Default: device default. */
  readonly sampleRate?: number
}

/**
 * Creates a cold RxJS Observable that:
 * 1. Subscribes to the unified audioPipeline.
 * 2. Emits a SHARED (mutated-in-place) `PitchFrame` for each detected pitch.
 * 3. Manages the lifecycle of the shared WebAudioAdapter via the pipeline.
 *
 * @remarks
 * The emitted `PitchFrame` object is shared across emissions for zero
 * allocation. Subscribers that need to store values must copy them explicitly.
 *
 * @param _config - Optional stream configuration.
 * @returns A cold Observable of PitchFrame.
 */
export function createTunerStream(_config: TunerStreamConfig = {}): Observable<PitchFrame> {
  return new Observable<PitchFrame>((subscriber) => {
    let pipelineSub: Subscription | null = null

    // Ensure the unified pipeline is initialized
    void audioPipeline.init()

    // Relay processed frames from the singleton pipeline to this subscriber
    pipelineSub = audioPipeline.pitchFrame$.subscribe({
      next: (frame) => subscriber.next(frame),
      error: (err) => subscriber.error(err),
      complete: () => subscriber.complete(),
    })

    // Teardown
    return () => {
      pipelineSub?.unsubscribe()
      // Note: We don't call audioPipeline.destroy() here because other
      // consumers (like PracticeService) might still need it.
    }
  })
}
