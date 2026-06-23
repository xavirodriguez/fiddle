import { audioManager } from '../infrastructure/audio-manager'
import { PitchDetector, PitchDetectionResult } from '../pitch-detector'
import { usePracticeStore } from '@/stores/practice-store'
import { useTunerStore } from '@/stores/tuner-store'
import { MusicalNote, formatPitchName } from '../practice-core'
import { lerp, Hertz, Cents, frequencyToMidi } from '../domain/musical-domain'
import { Note as TargetNote, Exercise } from '../domain/exercise'
import { DetectedNote, PracticeState } from '../domain/practice'
import { NoteTechnique } from '../technique-types'
import { SHARED_PITCH_FRAME, MutablePitchFrame, PitchFrame } from '../domain/data-structures'
import { practiceMachine } from './practice-machine'
import { createActor } from 'xstate'
import { TimelineSynchronizer, MusicalEvent } from './timeline-synchronizer'
import { ToneBridge, Seconds } from '../audio/tone-bridge'
import * as Tone from 'tone'

/**
 * PracticeService
 *
 * A simplified service that manages the real-time audio loop for the practice session.
 * It uses XState for robust state management and stores for UI updates.
 */
export class PracticeService {
  private rafId: number | null = null
  private detector: PitchDetector | null = null
  private buffer: Float32Array = new Float32Array(2048)
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
  }

  /**
   * Starts the audio processing loop and playback.
   */
  async start() {
    this.stop()
    const context = audioManager.getContext()
    if (!context) {
      console.warn('[PracticeService] No audio context available')
      return
    }

    this.actor.start()
    this.detector = new PitchDetector(context.sampleRate)

    // Resume Tone.js Transport
    await Tone.start()
    Tone.getTransport().start()

    this.loop()
  }

  /**
   * Stops the audio processing loop and playback.
   */
  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.actor.stop()
    Tone.getTransport().stop()
  }

  private loop = () => {
    try {
      const analyser = audioManager.getAnalyser()
      if (!analyser || !this.detector) {
        this.rafId = requestAnimationFrame(this.loop)
        return
      }

      // Use explicit cast to avoid SharedArrayBuffer issues in TS
      analyser.getFloatTimeDomainData(this.buffer as unknown as Float32Array<ArrayBuffer>)
      const result = this.detector.detectPitchWithValidation(this.buffer, 0.005) // Lower RMS threshold

      this.processDetectionResult(result)
    } catch (err) {
      console.error('[PracticeService] Loop error:', err)
    }

    this.rafId = requestAnimationFrame(this.loop)
  }

  private processDetectionResult(result: PitchDetectionResult) {
    const context = audioManager.getContext()
    if (!context) return

    const now = context.currentTime as Seconds
    const store = usePracticeStore.getState()
    const tuner = useTunerStore.getState()
    const shouldUpdateStore = now - this.lastUpdateTime > this.UPDATE_INTERVAL_SEC

    if (result.pitchHz > 0 && result.confidence > 0.7) {
      tuner.updatePitch(result.pitchHz, result.confidence)

      // Perform real-time sync verification
      const verification = this.synchronizer.verify(now, frequencyToMidi(result.pitchHz as Hertz).unwrapOr(0 as any))

      // Only update store if the musical state has changed to avoid 60FPS React thrashing
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

      this.handlePitchDetected(result, now, shouldUpdateStore)
    } else {
      tuner.updatePitch(0, 0)
      if (shouldUpdateStore) {
        store.internalUpdate({ type: 'NO_NOTE_DETECTED' })
        this.lastUpdateTime = now
      }
      this.actor.send({ type: 'PITCH_LOST' })
    }
  }

  private handlePitchDetected(result: PitchDetectionResult, now: number, shouldUpdateStore: boolean) {
    const store = usePracticeStore.getState()
    const practiceState = store.practiceState

    // Apply smooth interpolation (Task 4.3)
    if (this.smoothedFrequency === 0) {
      this.smoothedFrequency = result.pitchHz
    } else {
      this.smoothedFrequency = lerp(this.smoothedFrequency, result.pitchHz, this.SMOOTHING_FACTOR)
    }

    // Use zero-allocation shared instance (Task 4.2)
    const note = MusicalNote.fromFrequencyShared(this.smoothedFrequency)

    // Zero-allocation: update shared pitch frame
    SHARED_PITCH_FRAME.frequency = this.smoothedFrequency as Hertz
    SHARED_PITCH_FRAME.centsDeviation = note.centsDeviation as Cents
    SHARED_PITCH_FRAME.timestamp = now
    SHARED_PITCH_FRAME.confidence = result.confidence

    this.updateTargetCache(practiceState)

    const detectedNote = this.mapFrameToDetectedNote(SHARED_PITCH_FRAME, note.nameWithOctave)

    if (shouldUpdateStore) {
      store.internalUpdate({ type: 'NOTE_DETECTED', payload: detectedNote })
      this.lastUpdateTime = now
    }

    this.actor.send({
      type: 'PITCH_DETECTED',
      frame: SHARED_PITCH_FRAME,
    })
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
