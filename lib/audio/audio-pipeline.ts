import { type Observable, Subject, type Subscription } from 'rxjs'
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
 * Flow: RawPitchEvent \> NoteSegmenter \> Agent \> EventSink
 */
export class AudioPipeline {
  private inputSubject = new Subject<RawPitchEvent>()
  private segmenter = createActor(noteSegmenterMachine)
  private techniqueAgent = new TechniqueAgent()
  private internalSubscription: Subscription

  // Pre-allocated event objects for zero-allocation XState interaction
  private readonly PITCH_DETECTED_EVENT = { type: 'PITCH_DETECTED' as const, confidence: 0, rms: 0 }
  private readonly PITCH_LOST_EVENT = { type: 'PITCH_LOST' as const }

  /**
   * The processed stream of valid pitch frames.
   * Note: It emits the same SHARED_PITCH_FRAME instance to avoid allocations.
   */
  public readonly pitchFrame$: Observable<PitchFrame>

  constructor() {
    this.segmenter.start()

    // Internal pipeline setup
    this.pitchFrame$ = this.inputSubject.asObservable().pipe(
      // 1. Note Segmentation (Side-effect: update machine state)
      tap(event => {
        const isStrong = event.pitchHz > 0 && event.confidence > 0.8 && event.rms > 0.01;
        if (isStrong) {
          const e = this.PITCH_DETECTED_EVENT;
          e.confidence = event.confidence;
          e.rms = event.rms;
          this.segmenter.send(e);
        } else {
          this.segmenter.send(this.PITCH_LOST_EVENT);
        }
      }),

      // 2. Filter based on machine state (Only emit when in NOTE or NOTE_LOST state)
      filter(() => {
        const state = this.segmenter.getSnapshot().value
        return state === 'NOTE' || state === 'NOTE_LOST'
      }),

      // 3. Agent Stage: Zero-allocation mapping & Technique Analysis
      map(event => {
        // Calculate Cents Deviation using MusicalNote core utility
        const note = MusicalNote.fromFrequencyShared(event.pitchHz);

        SHARED_PITCH_FRAME.frequency = event.pitchHz as Hertz
        SHARED_PITCH_FRAME.confidence = event.confidence
        SHARED_PITCH_FRAME.timestamp = event.timestamp
        SHARED_PITCH_FRAME.centsDeviation = note.centsDeviation as Cents

        // 4. Technique Analysis (Side effect: updates SHARED_TECHNIQUE_METRICS)
        SHARED_PITCH_FRAME.technique = this.techniqueAgent.analyze(
          SHARED_PITCH_FRAME,
          event.rms,
          event.spectralFlatness,
          event.spectralCentroid
        ) ?? undefined;

        return SHARED_PITCH_FRAME
      }),

      // 5. Multicast for multiple subscribers (UI, Practice Service, etc.)
      share()
    );

    // We must subscribe to the pipe to keep the side-effects (segmenter) running
    // even if there are no external subscribers at a given moment.
    this.internalSubscription = this.pitchFrame$.subscribe();
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
    this.internalSubscription.unsubscribe()
    this.segmenter.stop()
    this.inputSubject.complete()
  }
}

export const audioPipeline = new AudioPipeline()
