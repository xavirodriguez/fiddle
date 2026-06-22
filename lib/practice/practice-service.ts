import { audioManager } from '../infrastructure/audio-manager'
import { PitchDetector, PitchDetectionResult } from '../pitch-detector'
import { usePracticeStore } from '@/stores/practice-store'
import { useTunerStore } from '@/stores/tuner-store'
import { MusicalNote, formatPitchName } from '../practice-core'
import { lerp, Hertz, Cents } from '../domain/musical-domain'
import { Note as TargetNote } from '../domain/exercise'
import { DetectedNote, PracticeState } from '../domain/practice'
import { NoteTechnique } from '../technique-types'
import { SHARED_PITCH_FRAME } from '../domain/data-structures'

/**
 * PracticeService
 *
 * A simplified service that manages the real-time audio loop for the practice session.
 * It replaces the complex PracticeEngine and SessionRunner with a direct requestAnimationFrame loop.
 */
export class PracticeService {
  private rafId: number | null = null
  private detector: PitchDetector | null = null
  private buffer: Float32Array = new Float32Array(2048)
  private holdStartTime: number | null = null
  private consecutiveMisses = 0
  private readonly MAX_MISSES = 5
  private lastUpdateTime = 0 // In AudioContext.currentTime (seconds)
  private readonly UPDATE_INTERVAL_SEC = 0.1 // 10Hz update rate for store
  private cachedTargetNote: TargetNote | null = null
  private cachedTargetPitch: string | null = null
  private cachedIndex: number = -1
  private cachedExerciseId: string = ''
  private smoothedFrequency: number = 0
  private readonly SMOOTHING_FACTOR = 0.2

  /**
   * Starts the audio processing loop.
   */
  start() {
    this.stop()
    const context = audioManager.getContext()
    if (!context) {
      console.warn('[PracticeService] No audio context available')
      return
    }

    this.detector = new PitchDetector(context.sampleRate)
    this.loop()
  }

  /**
   * Stops the audio processing loop.
   */
  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.holdStartTime = null
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

    const now = context.currentTime
    const store = usePracticeStore.getState()
    const tuner = useTunerStore.getState()
    const shouldUpdateStore = now - this.lastUpdateTime > this.UPDATE_INTERVAL_SEC

    if (result.pitchHz > 0 && result.confidence > 0.7) {
      tuner.updatePitch(result.pitchHz, result.confidence)
      this.handlePitchDetected(result, now, shouldUpdateStore)
    } else {
      tuner.updatePitch(0, 0)
      if (shouldUpdateStore) {
        store.internalUpdate({ type: 'NO_NOTE_DETECTED' })
        this.lastUpdateTime = now
      }
      this.handleMiss()
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

    // Zero-allocation: update shared pitch frame instead of creating a new object
    const detected = SHARED_PITCH_FRAME as unknown as DetectedNote
    detected.pitch = note.nameWithOctave
    detected.pitchHz = this.smoothedFrequency
    detected.cents = note.centsDeviation
    detected.timestamp = now
    detected.confidence = result.confidence

    this.updateTargetCache(practiceState)

    const isCorrect = this.cachedTargetPitch === detected.pitch && Math.abs(detected.cents) < 20

    if (shouldUpdateStore) {
      // NOTE: We still clone here for the store (external boundary),
      // but the core logic and hot-path calculations use SHARED_PITCH_FRAME.
      store.internalUpdate({ type: 'NOTE_DETECTED', payload: { ...detected } })
      this.lastUpdateTime = now
    }

    if (isCorrect) {
      this.handleCorrectNote(detected, now, shouldUpdateStore)
    } else {
      this.handleMiss()
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
    }
  }

  private handleCorrectNote(detected: DetectedNote, now: number, shouldUpdateStore: boolean) {
    const store = usePracticeStore.getState()
    this.consecutiveMisses = 0
    if (!this.holdStartTime) {
      this.holdStartTime = now
    }

    const holdDuration = now - this.holdStartTime

    if (shouldUpdateStore) {
      store.internalUpdate({
        type: 'HOLDING_NOTE',
        payload: { duration: holdDuration * 1000 }, // Convert back to ms for store if needed
      })
    }

    if (holdDuration * 1000 > store.requiredHoldTime) {
      store.internalUpdate({
        type: 'NOTE_MATCHED',
        payload: {
          isPerfect: Math.abs(detected.cents) < 10,
          technique: {} as NoteTechnique,
        },
      })
      this.holdStartTime = null
      this.lastUpdateTime = now
    }
  }

  private handleMiss() {
    this.consecutiveMisses++
    if (this.consecutiveMisses > this.MAX_MISSES) {
      this.holdStartTime = null
    }
  }
}

export const practiceService = new PracticeService()
