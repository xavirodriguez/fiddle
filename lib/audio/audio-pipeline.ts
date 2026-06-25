import { type Observable, Subject } from 'rxjs'
import { filter, map, share, tap } from 'rxjs/operators'
import { createActor } from 'xstate'

import { type PitchFrame, SHARED_PITCH_FRAME } from '../domain/data-structures'
import { type Cents, type Hertz } from '../domain/musical-domain'
import { noteSegmenterMachine } from '../practice/note-segmenter'
import { TechniqueAgent } from '../practice/technique-agent'
import { MusicalNote } from '../practice-core'

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
  private techniqueAgent = new TechniqueAgent()

  /**
   * The processed stream of valid pitch frames.
   * Note: It emits the same SHARED_PITCH_FRAME instance to avoid allocations.
   */
  public readonly pitchFrame$: Observable<PitchFrame>

  constructor() {
    this.segmenter.start()

    this.pitchFrame$ = this.inputSubject.asObservable().pipe(
      // 1. Note Segmentation (Update machine state)
      tap(event => {
        if (event.pitchHz > 0 && event.confidence > 0.8 && event.rms > 0.01) {
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
      map(event => {
        // Calculate Cents Deviation using MusicalNote core utility
        const note = MusicalNote.fromFrequencyShared(event.pitchHz);

        SHARED_PITCH_FRAME.frequency = event.pitchHz as Hertz
        SHARED_PITCH_FRAME.confidence = event.confidence
        SHARED_PITCH_FRAME.timestamp = event.timestamp
        SHARED_PITCH_FRAME.centsDeviation = note.centsDeviation as Cents

        // 4. Technique Analysis (Side effect: updates SHARED_TECHNIQUE_METRICS)
        const metrics = this.techniqueAgent.analyze(
          SHARED_PITCH_FRAME,
          event.rms,
          event.spectralFlatness,
          event.spectralCentroid
        );
        SHARED_PITCH_FRAME.technique = metrics ?? undefined;

        return SHARED_PITCH_FRAME
      }),

      share()
    )
  }

  /**
   * Pushes a new raw detection result into the pipeline.
   */
  push(event: RawPitchEvent): void {
    this.inputSubject.next(event)
  }

  getTechniqueAgent(): TechniqueAgent {
    return this.techniqueAgent
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.segmenter.stop()
  }
}

export const audioPipeline = new AudioPipeline()
