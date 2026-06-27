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

import { Observable } from 'rxjs'

import { SHARED_PITCH_FRAME } from '../domain/data-structures'
import type { PitchFrame } from '../domain/data-structures'
import type { Cents,Hertz } from '../domain/musical-domain'
import { PitchDetector } from '../pitch-detector'
import { MusicalNote } from '../practice-core'

/** Minimum Pitchy confidence to emit a pitch event. */
const CONFIDENCE_THRESHOLD = 0.85

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
 * 1. Requests microphone permission on subscription.
 * 2. Runs a `requestAnimationFrame` loop calling Pitchy on every frame.
 * 3. Emits a SHARED (mutated-in-place) `PitchFrame` for each detected pitch.
 * 4. Cleans up all Web Audio resources on unsubscription.
 *
 * @remarks
 * The emitted `PitchFrame` object is shared across emissions for zero
 * allocation. Subscribers that need to store values must copy them explicitly.
 *
 * @param config - Optional stream configuration.
 * @returns A cold Observable of PitchFrame.
 */
export function createTunerStream(
  config: TunerStreamConfig = {}
): Observable<PitchFrame> {
  const fftSize = config.fftSize ?? 2048

  return new Observable<PitchFrame>((subscriber) => {
    let audioCtx: AudioContext | null = null
    let analyser: AnalyserNode | null = null
    let source: MediaStreamAudioSourceNode | null = null
    let mediaStream: MediaStream | null = null
    let rafId = 0
    let detector: PitchDetector | null = null

    // Pre-allocate the frame buffer — reused every tick (Zero-Allocation).
    const inputBuffer = new Float32Array(fftSize)

    function loop(): void {
      if (!analyser || !detector) return

      analyser.getFloatTimeDomainData(inputBuffer)

      const result = detector.detect(inputBuffer)

      if (result.pitchHz === 0) {
        // Silent frame or no pitch: emit silence marker without allocating.
        SHARED_PITCH_FRAME.frequency = 0 as Hertz
        SHARED_PITCH_FRAME.centsDeviation = 0 as Cents
        SHARED_PITCH_FRAME.confidence = 0
        SHARED_PITCH_FRAME.timestamp = audioCtx?.currentTime ?? 0
        subscriber.next(SHARED_PITCH_FRAME)
        rafId = requestAnimationFrame(loop)
        return
      }

      if (result.confidence < CONFIDENCE_THRESHOLD) {
        rafId = requestAnimationFrame(loop)
        return
      }

      const frequency = result.pitchHz
      const confidence = result.confidence

      // --- Zero-Allocation mapping using MusicalNote core utility ---
      const note = MusicalNote.fromFrequencyShared(frequency);

      // Mutate the shared frame in-place — no new object.
      SHARED_PITCH_FRAME.frequency = frequency as Hertz
      SHARED_PITCH_FRAME.centsDeviation = note.centsDeviation as Cents
      SHARED_PITCH_FRAME.confidence = confidence
      SHARED_PITCH_FRAME.timestamp = audioCtx?.currentTime ?? 0

      subscriber.next(SHARED_PITCH_FRAME)
      rafId = requestAnimationFrame(loop)
    }

    // Async setup — errors surface through subscriber.error().
    void (async () => {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        audioCtx = new AudioContext(config.sampleRate ? { sampleRate: config.sampleRate } : undefined)
        analyser = audioCtx.createAnalyser()
        analyser.fftSize = fftSize
        source = audioCtx.createMediaStreamSource(mediaStream)
        source.connect(analyser)
        detector = new PitchDetector(audioCtx.sampleRate, fftSize)
        rafId = requestAnimationFrame(loop)
      } catch (error) {
        subscriber.error(error)
      }
    })()

    // Teardown — called by RxJS on unsubscribe / complete / error.
    return () => {
      cancelAnimationFrame(rafId)
      source?.disconnect()
      analyser?.disconnect()
      if (audioCtx) {
        void audioCtx.close()
      }
      mediaStream?.getTracks().forEach((t) => t.stop())
    }
  })
}
