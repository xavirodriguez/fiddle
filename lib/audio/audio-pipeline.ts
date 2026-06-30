import { ok, type Result } from 'neverthrow'
import { type Observable, Subject, type Subscription } from 'rxjs'
import { debounceTime, filter, map, share, tap } from 'rxjs/operators'
import { createActor } from 'xstate'

import { type PitchFrame, SHARED_PITCH_FRAME } from '../domain/data-structures'
import { type Cents, type Hertz } from '../domain/musical-domain'
import { type AppError } from '../errors/app-error'
import { WebAudioAdapter } from '../infrastructure/audio/web-audio-adapter'
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
  private adapter = new WebAudioAdapter()
  private segmenter = createActor(noteSegmenterMachine)
  private techniqueAgent = new TechniqueAgent()
  private internalSubscription: Subscription | null = null

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
    // Flow: RawPitchEvent \> NoteSegmenter \> Agent \> EventSink
    this.pitchFrame$ = this.inputSubject.asObservable().pipe(
      // 1. Note Segmentation Stage (XState bridge)
      tap((event) => this.segmentNote(event)),

      // 2. Filter Stage: Only proceed when in NOTE or NOTE_LOST states
      filter(() => {
        const state = this.segmenter.getSnapshot().value
        return state === 'NOTE' || state === 'NOTE_LOST'
      }),

      // 3. Agent Stage: Technique Analysis & Frame Mapping (Zero Allocation)
      map((event) => this.analyzeFrame(event)),

      // 4. EventSink Stage: Multicast the stream across multiple subscribers
      share(),
    )

    /**
     * Debounced stream for stable observations (UI / Feedback).
     * This prevents flickering in the feedback engine by requiring
     * a short period of stability.
     */
    this.stablePitchFrame$ = this.pitchFrame$.pipe(debounceTime(50), share())
  }

  public readonly stablePitchFrame$: Observable<PitchFrame>

  /**
   * Internal logic for note segmentation based on raw signal strength.
   */
  private segmentNote(event: RawPitchEvent): void {
    const isStrong = event.pitchHz > 0 && event.confidence > 0.8 && event.rms > 0.01
    if (isStrong) {
      const e = this.PITCH_DETECTED_EVENT
      e.confidence = event.confidence
      e.rms = event.rms
      this.segmenter.send(e)
    } else {
      this.segmenter.send(this.PITCH_LOST_EVENT)
    }
  }

  /**
   * Internal logic for technique analysis and mapping to PitchFrame.
   * Reuses SHARED_PITCH_FRAME to satisfy the Zero-Allocation mandate.
   */
  private analyzeFrame(event: RawPitchEvent): PitchFrame {
    const note = MusicalNote.fromFrequencyShared(event.pitchHz)

    SHARED_PITCH_FRAME.frequency = event.pitchHz as Hertz
    SHARED_PITCH_FRAME.confidence = event.confidence
    SHARED_PITCH_FRAME.timestamp = event.timestamp
    SHARED_PITCH_FRAME.centsDeviation = note.centsDeviation as Cents

    // Technique Analysis
    SHARED_PITCH_FRAME.technique =
      this.techniqueAgent.analyze(
        SHARED_PITCH_FRAME,
        event.rms,
        event.spectralFlatness,
        event.spectralCentroid,
      ) ?? undefined

    return SHARED_PITCH_FRAME
  }

  /**
   * Initializes the pipeline and starts the hardware audio stream.
   * Ensures only one hardware adapter is active and feeding the pipeline.
   */
  public async init(): Promise<Result<void, AppError>> {
    if (this.internalSubscription) return ok(undefined)

    // Pre-allocated event object to avoid allocations in the hot callback
    const eventProxy: RawPitchEvent = {
      pitchHz: 0,
      confidence: 0,
      rms: 0,
      spectralFlatness: 0,
      spectralCentroid: 0,
      timestamp: 0,
    }

    // 1. Initialize hardware via adapter
    const initResult = await this.adapter.initialize()
    if (initResult.isErr()) return initResult

    const streamResult = await this.adapter.startStream((data: Float64Array) => {
      eventProxy.pitchHz = data[0]
      eventProxy.confidence = data[1]
      eventProxy.rms = data[2]
      eventProxy.spectralFlatness = data[3]
      eventProxy.spectralCentroid = data[4]
      eventProxy.timestamp = data[5]
      this.push(eventProxy)
    })

    if (streamResult.isErr()) return streamResult

    // 2. Start internal processing
    this.internalSubscription = this.pitchFrame$.subscribe()
    return ok(undefined)
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

  getAdapter(): WebAudioAdapter {
    return this.adapter
  }

  /**
   * Cleanup resources and stop hardware stream.
   */
  async stop(): Promise<void> {
    this.internalSubscription?.unsubscribe()
    this.internalSubscription = null
    this.segmenter.stop()
    await this.adapter.stopStream()
  }
}

export const audioPipeline = new AudioPipeline()
