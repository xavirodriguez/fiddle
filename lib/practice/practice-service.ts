import { type Subscription } from 'rxjs'
import * as Tone from 'tone'
import { createActor } from 'xstate'

import { useAppStore } from '@/stores/app-store'

import { audioPipeline, type RawPitchEvent } from '../audio/audio-pipeline'
import { type Seconds,ToneBridge } from '../audio/tone-bridge'
import { type MutablePitchFrame, type PitchFrame,SHARED_PITCH_FRAME } from '../domain/data-structures'
import { type Exercise,type Note as TargetNote } from '../domain/exercise'
import { type Cents, frequencyToMidiRaw,type Hertz } from '../domain/musical-domain'
import { type DetectedNote, type PracticeState } from '../domain/practice'
import { WebAudioAdapter } from '../infrastructure/audio/web-audio-adapter'
import { audioManager } from '../infrastructure/audio-manager'
import { toneAudioPlayer } from '../infrastructure/audio/tone-audio-player'
import { formatPitchName,MusicalNote } from '../practice-core'
import { type PracticeEvent,practiceMachine } from './practice-machine'
import { type MusicalEvent,TimelineSynchronizer } from './timeline-synchronizer'

/**
 * PracticeService
 *
 * Orchestrates the real-time audio pipeline and practice session logic.
 * Uses RxJS for reactive audio events and XState for session state.
 */
export class PracticeService {
  private lastUpdateTime = 0
  private readonly UPDATE_INTERVAL_SEC = 0.1
  private cachedTargetNote: TargetNote | null = null
  private cachedTargetPitch: string | null = null
  private cachedIndex: number = -1
  private cachedExerciseId: string = ''
  private synchronizer = new TimelineSynchronizer()
  private onNoteTriggered: ((event: MusicalEvent) => void) | null = null
  private pipelineSubscription: Subscription | null = null
  private audioAdapter: WebAudioAdapter = new WebAudioAdapter()

  /** Pre-allocated event object for the practice machine */
  private readonly REUSABLE_PITCH_EVENT: Extract<PracticeEvent, { type: 'PITCH_DETECTED' }> = {
    type: 'PITCH_DETECTED',
    frame: SHARED_PITCH_FRAME,
  }

  private actor = createActor(practiceMachine.provide({
    actions: {
      notifySuccess: () => {
        const store = useAppStore.getState()
        const detected = mapFrameToDetectedNote(SHARED_PITCH_FRAME, this.cachedTargetPitch || '')

        // Generate observations for the matched note
        let observations: any[] = []
        if (SHARED_PITCH_FRAME.technique) {
          observations = audioPipeline.getTechniqueAgent().generateObservations(
            SHARED_PITCH_FRAME.technique,
            SHARED_PITCH_FRAME.timestamp
          )
        }

        store.internalUpdate({
          type: 'NOTE_MATCHED',
          payload: {
            isPerfect: Math.abs(detected.cents) < 10,
            observations,
          },
        })
      },
    },
  }), {
    input: {}
  })

  async initialize(exercise: Exercise, onNoteTriggered: (event: MusicalEvent) => void) {
    // Ensure the native AudioContext is initialized first
    await audioManager.initialize()

    // Synchronize Tone.js with the same AudioContext
    const bridgeResult = await ToneBridge.initialize()
    if (bridgeResult.isErr()) {
      console.error('[PracticeService] ToneBridge failed:', bridgeResult.error)
    }

    // Initialize the adapter (which uses audioManager internally or shares context)
    await this.audioAdapter.initialize()

    this.synchronizer.compile(exercise)
    this.onNoteTriggered = onNoteTriggered

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

    // Start Audio Hardware Stream
    await this.audioAdapter.startStream((event: RawPitchEvent) => {
      audioPipeline.push(event)
    })

    // Schedule musical events in Tone.js Transport
    this.synchronizer.schedule((event) => {
      if (this.onNoteTriggered) this.onNoteTriggered(event)
    })
  }

  stop() {
    this.actor.stop()
    void this.audioAdapter.stopStream()
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
      sync.isCorrectPitch !== verification.isCorrectPitch
    ) {
      store.updateSync({
        currentMeasure: nextMeasure,
        currentMidiTarget: verification.expectedMidi,
        isCorrectPitch: verification.isCorrectPitch,
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
      MusicalNote.fromFrequencyShared(frame.frequency).nameWithOctave,
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
          this.audioAdapter.updateFilterFrequency(midiResult.value.frequency)
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
function mapFrameToDetectedNote(frame: MutablePitchFrame, pitchName: string): DetectedNote {
  return {
    pitch: pitchName,
    pitchHz: frame.frequency,
    cents: frame.centsDeviation,
    timestamp: frame.timestamp,
    confidence: frame.confidence,
  }
}

export const practiceService = new PracticeService()
