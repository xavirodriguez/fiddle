import { usePracticeStore } from '@/stores/practice-store'
import { useTunerStore } from '@/stores/tuner-store'
import { MusicalNote, formatPitchName } from '../practice-core'
import { lerp, Hertz, Cents, frequencyToMidi } from '../domain/musical-domain'
import { Note as TargetNote, Exercise } from '../domain/exercise'
import { DetectedNote, PracticeState } from '../domain/practice'
import { SHARED_PITCH_FRAME, MutablePitchFrame, PitchFrame } from '../domain/data-structures'
import { practiceMachine, PracticeEvent } from './practice-machine'
import { createActor } from 'xstate'
import { TimelineSynchronizer, MusicalEvent } from './timeline-synchronizer'
import { ToneBridge, Seconds } from '../audio/tone-bridge'
import * as Tone from 'tone'
import { AudioPipeline } from '../audio/audio-pipeline'
import { WebAudioAdapter } from '../infrastructure/audio/web-audio-adapter'
import { Subscription } from 'rxjs'

/**
 * PracticeService
 *
 * A simplified service that manages the real-time audio loop for the practice session.
 * It uses XState for robust state management and an RxJS pipeline for audio processing.
 */
export class PracticeService {
  private pipeline: AudioPipeline | null = null
  private subscription: Subscription | null = null
  private segmenterSubscription: Subscription | null = null
  private lastUpdateTime = 0 // In AudioContext.currentTime (seconds)
  private readonly UPDATE_INTERVAL_SEC = 0.1 // 10Hz update rate for store
  private cachedTargetNote: TargetNote | null = null
  private cachedTargetPitch: string | null = null
  private cachedIndex: number = -1
  private cachedExerciseId: string = ''
  private smoothedFrequency: number = 0
  private readonly SMOOTHING_FACTOR = 0.2
  private synchronizer = new TimelineSynchronizer()
  private onNoteTriggered: ((event: MusicalEvent) => void) | null = null

  /** Pre-allocated event object for the practice machine */
  private readonly REUSABLE_PITCH_EVENT: Extract<PracticeEvent, { type: 'PITCH_DETECTED' }> = {
    type: 'PITCH_DETECTED',
    frame: SHARED_PITCH_FRAME as PitchFrame,
  }

  private actor = createActor(practiceMachine, {
    actions: {
      notifySuccess: () => {
        const store = usePracticeStore.getState()
        const detected = this.mapFrameToDetectedNote(SHARED_PITCH_FRAME, this.cachedTargetPitch || '')
        store.internalUpdate({
          type: 'NOTE_MATCHED',
          payload: {
            isPerfect: Math.abs(detected.cents) < 10,
          },
        })
      },
    },
  })

  /**
   * Initializes the synchronizer and Tone.js bridge.
   */
  async initialize(exercise: Exercise, onNoteTriggered: (event: MusicalEvent) => void) {
    await ToneBridge.initialize()
    this.synchronizer.compile(exercise)
    this.onNoteTriggered = onNoteTriggered
    this.synchronizer.schedule(onNoteTriggered)

    // Initialize AudioPipeline with WebAudioAdapter
    const adapter = new WebAudioAdapter()
    await adapter.initialize()
    this.pipeline = new AudioPipeline(adapter)
  }

  /**
   * Starts the audio processing loop and playback.
   */
  async start() {
    await this.stop()
    if (!this.pipeline) {
      console.warn('[PracticeService] Pipeline not initialized')
      return
    }

    this.actor.start()

    // Resume Tone.js Transport
    await Tone.start()
    Tone.getTransport().start()

    // Subscribe to pipeline pitch events
    this.subscription = this.pipeline.pitch$.subscribe((frame) => {
      this.processPitchFrame(frame)
    })

    // Subscribe to note segmenter for high-level events
    this.segmenterSubscription = this.pipeline.segmenter$.subscribe((state) => {
      if (state.value === 'note') {
        // Potentially handle note onset
      } else if (state.value === 'silence') {
        this.actor.send({ type: 'PITCH_LOST' })
      }
    })

    await this.pipeline.start()
  }

  /**
   * Stops the audio processing loop and playback.
   */
  async stop() {
    this.subscription?.unsubscribe()
    this.segmenterSubscription?.unsubscribe()
    this.subscription = null
    this.segmenterSubscription = null

    if (this.pipeline) {
      await this.pipeline.stop()
    }

    this.actor.stop()
    Tone.getTransport().stop()
  }

  private processPitchFrame(frame: PitchFrame) {
    const store = usePracticeStore.getState()
    const tuner = useTunerStore.getState()
    const now = frame.timestamp
    const shouldUpdateStore = now - this.lastUpdateTime > this.UPDATE_INTERVAL_SEC

    if (frame.frequency > 0 && frame.confidence > 0.7) {
      // Apply smooth interpolation (Task 4.3)
      if (this.smoothedFrequency === 0) {
        this.smoothedFrequency = frame.frequency
      } else {
        this.smoothedFrequency = lerp(this.smoothedFrequency, frame.frequency, this.SMOOTHING_FACTOR)
      }

      // Update SHARED_PITCH_FRAME with smoothed data for consistent UI/Logic
      const note = MusicalNote.fromFrequencyShared(this.smoothedFrequency)
      SHARED_PITCH_FRAME.frequency = this.smoothedFrequency as Hertz
      SHARED_PITCH_FRAME.centsDeviation = note.centsDeviation as Cents
      // timestamp and confidence are already set by the pipeline in the shared frame

      tuner.updatePitch(this.smoothedFrequency, frame.confidence)

      // Perform real-time sync verification using smoothed data
      const verification = this.synchronizer.verify(now as Seconds, note.midiNumber)

      // Only update store if the musical state has changed to avoid 60FPS React thrashing
      const sync = store.syncState
      const timeline = this.synchronizer.getTimeline()
      const nextMeasure = timeline[verification.currentNoteIndex]?.measureIndex || 0

      if (
        sync.currentMeasure !== nextMeasure ||
        sync.currentMidiTarget !== verification.expectedMidi ||
        sync.isCorrectPitch !== verification.isCorrectPitch
      ) {
        store.updateSync({
          currentMeasure: nextMeasure,
          currentMidiTarget: verification.expectedMidi,
          isCorrectPitch: verification.isCorrectPitch,
        })
      }

      this.handlePitchDetected(SHARED_PITCH_FRAME as PitchFrame, shouldUpdateStore)
    } else {
      this.smoothedFrequency = 0
      tuner.updatePitch(0, 0)
      if (shouldUpdateStore) {
        store.internalUpdate({ type: 'NO_NOTE_DETECTED' })
        this.lastUpdateTime = now
      }
    }
  }

  private handlePitchDetected(frame: PitchFrame, shouldUpdateStore: boolean) {
    const store = usePracticeStore.getState()
    const practiceState = store.practiceState

    this.updateTargetCache(practiceState)

    const detectedNote = this.mapFrameToDetectedNote(frame as MutablePitchFrame, MusicalNote.fromFrequencyShared(frame.frequency).nameWithOctave)

    if (shouldUpdateStore) {
      store.internalUpdate({ type: 'NOTE_DETECTED', payload: detectedNote })
      this.lastUpdateTime = frame.timestamp
    }

    // Use pre-allocated event object
    this.actor.send(this.REUSABLE_PITCH_EVENT)
  }

  /**
   * Adapts a MutablePitchFrame to a DetectedNote structure.
   */
  private mapFrameToDetectedNote(frame: MutablePitchFrame, pitchName: string): DetectedNote {
    return {
      pitch: pitchName,
      pitchHz: frame.frequency,
      cents: frame.centsDeviation,
      timestamp: frame.timestamp,
      confidence: frame.confidence,
    }
  }

  private updateTargetCache(practiceState: PracticeState | undefined) {
    if (
      practiceState &&
      (this.cachedIndex !== practiceState.currentIndex ||
        this.cachedExerciseId !== practiceState.exercise.id)
    ) {
      this.cachedIndex = practiceState.currentIndex
      this.cachedExerciseId = practiceState.exercise.id
      const target = practiceState.exercise.notes[practiceState.currentIndex]
      this.cachedTargetNote = target
      this.cachedTargetPitch = target ? formatPitchName(target.pitch) : null

      if (this.cachedTargetNote && this.cachedTargetPitch) {
        const midiResult = MusicalNote.tryFromName(this.cachedTargetPitch)
        if (midiResult.isOk()) {
          this.actor.send({ type: 'SET_TARGET', midi: midiResult.value.midiNumber })
        }
      }
    }
  }
}

export const practiceService = new PracticeService()
