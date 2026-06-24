import { audioManager } from '../infrastructure/audio-manager'
import { WebAudioAdapter } from '../infrastructure/audio/web-audio-adapter'
import { PitchDetector, PitchDetectionResult } from '../pitch-detector'
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
import { audioPipeline, RawPitchEvent } from '../audio/audio-pipeline'
import { Subscription } from 'rxjs'
import * as Tone from 'tone'
import { AudioPipeline } from '../audio/audio-pipeline'
import { WebAudioAdapter } from '../infrastructure/audio/web-audio-adapter'
import { Subscription } from 'rxjs'

/**
 * PracticeService
 *
 * Orchestrates the real-time audio pipeline and practice session logic.
 * Uses RxJS for reactive audio events and XState for session state.
 */
export class PracticeService {
  private detector: PitchDetector | null = null
  private lastUpdateTime = 0
  private readonly UPDATE_INTERVAL_SEC = 0.1
  private cachedTargetNote: TargetNote | null = null
  private cachedTargetPitch: string | null = null
  private cachedIndex: number = -1
  private cachedExerciseId: string = ''
  private smoothedFrequency: number = 0
  private readonly SMOOTHING_FACTOR = 0.2
  private synchronizer = new TimelineSynchronizer()
  private onNoteTriggered: ((event: MusicalEvent) => void) | null = null
  private pipelineSubscription: Subscription | null = null
  private audioAdapter: WebAudioAdapter = new WebAudioAdapter()

  /** Pre-allocated event object for the practice machine */
  private readonly REUSABLE_PITCH_EVENT: Extract<PracticeEvent, { type: 'PITCH_DETECTED' }> = {
    type: 'PITCH_DETECTED',
    frame: SHARED_PITCH_FRAME as PitchFrame,
  }

  private actor = createActor(practiceMachine, {
    // @ts-ignore - XState v5 types can be strict with provide/actions
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

  async initialize(exercise: Exercise, onNoteTriggered: (event: MusicalEvent) => void) {
    await ToneBridge.initialize()
    await this.audioAdapter.initialize()
    this.synchronizer.compile(exercise)
    this.onNoteTriggered = onNoteTriggered
    this.detector = new PitchDetector(this.audioAdapter.sampleRate)

    // Setup RxJS Pipeline Subscription
    this.pipelineSubscription = audioPipeline.pitchFrame$.subscribe(frame => {
      this.processFrame(frame)
    })
  }

  async start() {
    this.actor.start()

    // Start Tone Transport
    await Tone.start()
    Tone.getTransport().start()

    // Start Audio Hardware Stream
    await this.audioAdapter.startStream((result: any) => {
      audioPipeline.push(result as RawPitchEvent)
    })

    // Schedule musical events in Tone.js Transport
    this.synchronizer.schedule((event) => {
      if (this.onNoteTriggered) this.onNoteTriggered(event)
    })
  }

  stop() {
    this.actor.stop()
    this.audioAdapter.stopStream()
    Tone.getTransport().stop()
    Tone.getTransport().cancel() // Clear scheduled events
  }

  private processFrame(frame: PitchFrame) {
    const now = frame.timestamp as Seconds
    const store = usePracticeStore.getState()
    const tuner = useTunerStore.getState()
    const now = frame.timestamp
    const shouldUpdateStore = now - this.lastUpdateTime > this.UPDATE_INTERVAL_SEC

    tuner.updatePitch(frame.frequency, frame.confidence)

    // Real-time sync verification
    const verification = this.synchronizer.verify(now, frequencyToMidi(frame.frequency as Hertz).unwrapOr(0 as any))

    const sync = store.syncState
      const nextMeasure = this.synchronizer.getTimeline()[verification.currentNoteIndex]?.measureIndex || 0

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

    this.handlePitchDetected(frame, now, shouldUpdateStore)
  }

  private handlePitchDetected(frame: PitchFrame, now: number, shouldUpdateStore: boolean) {
    const store = usePracticeStore.getState()
    const practiceState = store.practiceState

    if (this.smoothedFrequency === 0) {
      this.smoothedFrequency = frame.frequency
    } else {
      this.smoothedFrequency = lerp(this.smoothedFrequency, frame.frequency, this.SMOOTHING_FACTOR)
    }

    const note = MusicalNote.fromFrequencyShared(this.smoothedFrequency)

    SHARED_PITCH_FRAME.frequency = this.smoothedFrequency as Hertz
    SHARED_PITCH_FRAME.centsDeviation = note.centsDeviation as Cents
    SHARED_PITCH_FRAME.timestamp = now
    SHARED_PITCH_FRAME.confidence = frame.confidence

    this.updateTargetCache(practiceState)

    const detectedNote = this.mapFrameToDetectedNote(frame as MutablePitchFrame, MusicalNote.fromFrequencyShared(frame.frequency).nameWithOctave)

    if (shouldUpdateStore) {
      store.internalUpdate({ type: 'NOTE_DETECTED', payload: detectedNote })
      this.lastUpdateTime = frame.timestamp
    }

    // Use pre-allocated event object
    this.actor.send(this.REUSABLE_PITCH_EVENT)
  }

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

  cleanup() {
    this.pipelineSubscription?.unsubscribe()
    this.stop()
  }
}

export const practiceService = new PracticeService()
