import { type Subscription } from 'rxjs'
import * as Tone from 'tone'
import { createActor } from 'xstate'

import { useAppStore } from '@/stores/app-store'

import { audioPipeline } from '../audio/audio-pipeline'
import { type Seconds, ToneBridge } from '../audio/tone-bridge'
import {
  type MutablePitchFrame,
  type PitchFrame,
  SHARED_PITCH_FRAME,
} from '../domain/data-structures'
import { type Exercise, type Note as TargetNote } from '../domain/exercise'
import { type Cents, frequencyToMidiRaw, type Hertz } from '../domain/musical-domain'
import { type DetectedNote, type PracticeState } from '../domain/practice'
import { toneAudioPlayer } from '../infrastructure/audio/tone-audio-player'
import { audioManager } from '../infrastructure/audio-manager'
import { formatPitchName, MusicalNote } from '../practice-core'
import { type Observation } from '../technique-types'
import { type PracticeEvent, practiceMachine } from './practice-machine'
import { type MusicalEvent, TimelineSynchronizer } from './timeline-synchronizer'

/**
 * PracticeService
 *
 * The central orchestrator of the musical practice engine.
 *
 * RESPONSIBILITIES:
 * 1. Lifecyle Management: Initializes and tears down the AudioPipeline,
 *    ToneBridge, and Musical Scheduler.
 * 2. Event Routing: Connects real-time pitch frames from the RxJS pipeline
 *    to the XState practice machine and the visual ScoreViewer.
 * 3. Synchronization: Uses the TimelineSynchronizer to verify performer
 *    accuracy against the absolute hardware clock.
 * 4. State Projection: Updates the Zustand store with discrete musical
 *    milestones while keeping high-frequency data out of the React lifecycle.
 *
 * ARCHITECTURAL CONTEXT:
 * - This service acts as the "Controller" in the orchestration flow.
 * - It ensures that the single AudioContext is shared across all consumers.
 * - It maintains 60 FPS by throttling store updates and using O(1) verification.
 */
export class PracticeService {
  private lastUpdateTime = 0
  private readonly UPDATE_INTERVAL_SEC = 0.1
  private cachedTargetNote: TargetNote | null = null
  private cachedTargetPitch: string | null = null
  private cachedIndex = -1
  private cachedExerciseId = ''
  private synchronizer = new TimelineSynchronizer()
  private onNoteTriggered: ((event: MusicalEvent) => void) | null = null
  private pipelineSubscription: Subscription | null = null

  private readonly successSnapshot = {
    frequency: 0,
    centsDeviation: 0,
    timestamp: 0,
    confidence: 0,
    technique: undefined as PitchFrame['technique'],
  }

  private readonly REUSABLE_DETECTED_NOTE: DetectedNote = {
    pitch: '',
    pitchHz: 0 as Hertz,
    cents: 0 as Cents,
    timestamp: 0,
    confidence: 0,
  }

  /** Pre-allocated event object for the practice machine */
  private readonly REUSABLE_PITCH_EVENT: Extract<PracticeEvent, { type: 'PITCH_DETECTED' }> = {
    type: 'PITCH_DETECTED',
    frame: SHARED_PITCH_FRAME,
  }

  private actor = createActor(
    practiceMachine.provide({
      actions: {
        captureSnapshot: () => {
          this.successSnapshot.frequency = SHARED_PITCH_FRAME.frequency
          this.successSnapshot.centsDeviation = SHARED_PITCH_FRAME.centsDeviation
          this.successSnapshot.timestamp = SHARED_PITCH_FRAME.timestamp
          this.successSnapshot.confidence = SHARED_PITCH_FRAME.confidence
          this.successSnapshot.technique = SHARED_PITCH_FRAME.technique
        },
        notifySuccess: () => {
          const store = useAppStore.getState()
          const detected = mapFrameToDetectedNote(
            this.successSnapshot as MutablePitchFrame,
            this.cachedTargetPitch ?? '',
            this.REUSABLE_DETECTED_NOTE,
          )

          // Generate observations for the matched note
          let observations: Observation[] = []
          if (this.successSnapshot.technique) {
            observations = audioPipeline
              .getTechniqueAgent()
              .generateObservations(this.successSnapshot.technique, this.successSnapshot.timestamp)
          }

          // Record the note in the technique agent for session statistics
          audioPipeline
            .getTechniqueAgent()
            .recordNote(
              detected.pitch,
              detected.cents,
              this.successSnapshot.technique?.rmsStability ?? 1,
            )

          store.internalUpdate({
            type: 'NOTE_MATCHED',
            payload: {
              isPerfect: Math.abs(detected.cents) < 5,
              observations,
              timestamp: this.successSnapshot.timestamp,
            },
          })
        },
      },
    }),
    {
      input: {},
    },
  )

  async initialize(exercise: Exercise, onNoteTriggered: (event: MusicalEvent) => void) {
    this.pipelineSubscription?.unsubscribe()
    this.pipelineSubscription = null

    // Ensure the native AudioContext is initialized first
    await audioManager.initialize()

    // Synchronize Tone.js with the same AudioContext
    const bridgeResult = await ToneBridge.initialize()
    if (bridgeResult.isErr()) {
      console.error('[PracticeService] ToneBridge failed:', bridgeResult.error)
    }

    const compileResult = this.synchronizer.compile(exercise)
    if (compileResult.isErr()) {
      console.error('[PracticeService] Timeline compilation failed:', compileResult.error)
      return
    }

    this.onNoteTriggered = onNoteTriggered

    // Ensure the reactive pipeline is active (This also starts the hardware stream via singleton adapter)
    const pipelineResult = await audioPipeline.init()
    if (pipelineResult.isErr()) {
      console.error('[PracticeService] AudioPipeline initialization failed:', pipelineResult.error)
    }

    // Setup RxJS Pipeline Subscription
    this.pipelineSubscription = audioPipeline.pitchFrame$.subscribe((frame) => {
      this.processFrame(frame)
    })
  }

  async start() {
    this.actor.start()

    // Start Tone Transport via Bridge initialization (already done in initialize)
    await Tone.start()
    Tone.getTransport().start()

    // Schedule musical events in Tone.js Transport
    this.synchronizer.schedule((event) => {
      if (this.onNoteTriggered) this.onNoteTriggered(event)
    })
  }

  stop() {
    this.actor.stop()
    audioPipeline.stop().catch((err) => console.error('[AudioPipeline]', err))
    toneAudioPlayer.stopAll()
  }

  private processFrame(frame: PitchFrame) {
    const now = frame.timestamp as Seconds
    const store = useAppStore.getState()
    const shouldUpdateStore = now - this.lastUpdateTime > this.UPDATE_INTERVAL_SEC

    // 1. Update Tuner Store (Reactive UI)
    store.updatePitch(frame.frequency, frame.confidence)

    // 2. Real-time sync verification (O(1) Zero-Allocation)
    const detectedMidi = frequencyToMidiRaw(frame.frequency)
    const verification = this.synchronizer.verify(now, detectedMidi)

    // 3. Update Sync State (Only on discrete changes to maintain 60 FPS)
    const sync = store.syncState
    const timeline = this.synchronizer.getTimeline()
    const nextMeasure = timeline[verification.currentNoteIndex]?.measureIndex ?? 0

    if (
      sync.currentMeasure !== nextMeasure ||
      sync.currentMidiTarget !== verification.expectedMidi ||
      sync.isCorrectPitch !== verification.isCorrectPitch ||
      sync.isCorrectTiming !== verification.isCorrectTiming
    ) {
      // If target changed, clear technique agent to avoid bleeding data
      if (sync.currentMidiTarget !== verification.expectedMidi) {
        audioPipeline.getTechniqueAgent().clear()
      }

      store.updateSync({
        currentMeasure: nextMeasure,
        currentMidiTarget: verification.expectedMidi,
        isCorrectPitch: verification.isCorrectPitch,
        isCorrectTiming: verification.isCorrectTiming,
      })
    }

    // 4. Update Practice Core & Observations
    this.handlePitchDetected(frame, now, shouldUpdateStore)
  }

  private handlePitchDetected(frame: PitchFrame, now: number, shouldUpdateStore: boolean) {
    const store = useAppStore.getState()
    const practiceState = store.practiceState

    const note = MusicalNote.fromFrequencyShared(frame.frequency)

    SHARED_PITCH_FRAME.frequency = frame.frequency
    SHARED_PITCH_FRAME.centsDeviation = note.centsDeviation as Cents
    SHARED_PITCH_FRAME.timestamp = now
    SHARED_PITCH_FRAME.confidence = frame.confidence

    this.updateTargetCache(practiceState)

    const detectedNote = mapFrameToDetectedNote(
      SHARED_PITCH_FRAME,
      note.nameWithOctave,
      this.REUSABLE_DETECTED_NOTE,
    )

    if (shouldUpdateStore) {
      store.internalUpdate({ type: 'NOTE_DETECTED', payload: detectedNote })
      this.lastUpdateTime = frame.timestamp
    }

    // Use pre-allocated event object
    this.actor.send(this.REUSABLE_PITCH_EVENT)
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
          const midi = midiResult.value.midiNumber
          this.actor.send({ type: 'SET_TARGET', midi })

          // Adaptive filtering: update biquad filter to target note's frequency
          audioPipeline.getAdapter().updateFilterFrequency(midiResult.value.frequency)
        }
      }
    }
  }

  cleanup() {
    this.pipelineSubscription?.unsubscribe()
    this.stop()
  }
}

/**
 * Pure adapter function to map a MutablePitchFrame to a DetectedNote.
 * Ensures zero-allocation when used in the hot path.
 */
function mapFrameToDetectedNote(
  frame: MutablePitchFrame,
  pitchName: string,
  out: DetectedNote,
): DetectedNote {
  out.pitch = pitchName
  out.pitchHz = frame.frequency
  out.cents = frame.centsDeviation
  out.timestamp = frame.timestamp
  out.confidence = frame.confidence
  return out
}

export const practiceService = new PracticeService()
