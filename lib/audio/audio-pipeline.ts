import { Subject, Observable, pipe } from 'rxjs'
import { filter, tap, share } from 'rxjs/operators'
import { PitchFrame, SHARED_PITCH_FRAME } from '../domain/data-structures'
import { PitchDetectionResult } from '../pitch-detector'
import { Hertz, Cents } from '../domain/musical-domain'
import { createActor } from 'xstate'
import { noteSegmenterMachine } from '../practice/note-segmenter-machine'

/**
 * RawPitchEvent
 *
 * Represents a raw detection result from the audio engine.
 */
export interface RawPitchEvent {
  pitchHz: number
  confidence: number
  rms: number
  spectralFlatness: number
  spectralCentroid: number
  timestamp: number
}

/**
 * AudioPipeline
 *
 * Manages the reactive flow of pitch events using RxJS.
 * Optimized for Zero Allocation.
 */
export class AudioPipeline {
  private inputSubject = new Subject<RawPitchEvent>()
  private segmenter = createActor(noteSegmenterMachine)

  /**
   * The processed stream of valid pitch frames.
   * Note: It emits the same SHARED_PITCH_FRAME instance to avoid allocations.
   */
  public readonly pitchFrame$: Observable<PitchFrame>

  constructor() {
    this.segmenter.start()

    this.pitchFrame$ = this.inputSubject.asObservable().pipe(
      // 1. Note Segmentation (Side Effect to the machine)
      tap(event => {
        if (event.pitchHz > 0 && event.confidence > 0.5) {
          this.segmenter.send({
            type: 'PITCH_DETECTED',
            confidence: event.confidence,
            rms: event.rms
          })
        } else {
          this.segmenter.send({ type: 'PITCH_LOST' })
        }
      }),

      // 2. Filter based on machine state (Only emit when in NOTE or NOTE_LOST state)
      filter(() => {
        const state = this.segmenter.getSnapshot().value
        return state === 'NOTE' || state === 'NOTE_LOST'
      }),

      // 3. Zero-allocation mapping (mutating shared object)
      tap(event => {
        SHARED_PITCH_FRAME.frequency = event.pitchHz as Hertz
        SHARED_PITCH_FRAME.confidence = event.confidence
        SHARED_PITCH_FRAME.timestamp = event.timestamp
      }),

      share()
    ) as unknown as Observable<PitchFrame>
  }

  /**
   * Pushes a new raw detection result into the pipeline.
   */
  push(event: RawPitchEvent): void {
    this.inputSubject.next(event)
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.segmenter.stop()
  }
}

export const audioPipeline = new AudioPipeline()
