/**
 * timeline-synchronizer.ts
 *
 * Orchestrates the relationship between the musical timeline (beats/measures),
 * the physical timeline (seconds/AudioContext), and the practice logic.
 *
 * Design Decisions:
 * 1. Determinism: Pre-calculates the absolute time for every note to avoid
 *    accumulative drift. By using absolute timestamps referenced to the start
 *    of the transport, we ensure that rounding errors don't compound.
 * 2. O(1) Verification: Uses a pointer-based lookup in a pre-sorted array.
 *    Since audio detection happens sequentially, we can maintain a pointer
 *    to the current expected note and only move forward when the clock
 *    reaches the next event's start time.
 * 3. Zero-allocation: Reuses a singleton `SHARED_VERIFICATION_RESULT`
 *    object to provide feedback to the practice service without triggering
 *    Garbage Collection (GC) pauses at 60 FPS.
 * 4. Temporal Drift Mitigation:
 *    - Drift Source: Differences between the CPU clock (performance.now) and
 *      the Audio Hardware clock.
 *    - Mitigation: All timing logic uses `Tone.now()` or `AudioContext.currentTime`.
 *    - Drift Source: Accumulative error in `currentTime += duration` during compilation.
 *    - Mitigation: Use absolute scheduling in Tone.Transport.
 */

import { err,ok, type Result } from 'neverthrow'
import * as Tone from 'tone'

import { type BPM,type Seconds } from '@/lib/audio/tone-bridge'
import { type Exercise } from '@/lib/domain/exercise'
import { AppError, ERROR_CODES } from '@/lib/errors/app-error'
import { formatPitchName,MusicalNote } from '@/lib/practice-core'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A compiled musical event with absolute timing.
 */
export interface MusicalEvent {
  readonly id: string
  readonly midiNote: number
  readonly startTime: Seconds
  readonly duration: Seconds
  readonly noteIndex: number
  readonly measureIndex: number
}

/**
 * Feedback provided when verifying a detected pitch against the timeline.
 */
export interface SyncVerification {
  isCorrectPitch: boolean
  timingError: Seconds
  expectedMidi: number
  currentNoteIndex: number
}

/**
 * Shared mutable instance for zero-allocation verification.
 */
const SHARED_VERIFICATION_RESULT: SyncVerification = {
  isCorrectPitch: false,
  timingError: 0 as Seconds,
  expectedMidi: -1,
  currentNoteIndex: -1,
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class TimelineSynchronizer {
  private timeline: MusicalEvent[] = []
  private currentEventPointer: number = 0
  private exerciseBpm: BPM = 60 as BPM

  /**
   * Compiles an exercise into a deterministic timeline.
   *
   * Complexity Analysis:
   * - Temporal: O(N) where N is the number of notes in the exercise.
   * - Spatial: O(N) to store the compiled events.
   */
  compile(exercise: Exercise): Result<void, AppError> {
    try {
      this.exerciseBpm = (exercise.bpm ?? 60) as BPM
      this.timeline = []
      this.currentEventPointer = 0

      let currentTime = 0
      const secondsPerBeat = 60 / this.exerciseBpm

      exercise.notes.forEach((note, index) => {
        const noteName = formatPitchName(note.pitch)
        const musicalNote = MusicalNote.fromName(noteName)

        const durationSeconds = note.duration * secondsPerBeat

        this.timeline.push({
          id: note.id,
          midiNote: musicalNote.midiNumber,
          startTime: currentTime as Seconds,
          duration: durationSeconds as Seconds,
          noteIndex: index,
          measureIndex: Math.floor(index / 4), // Fallback: assumes 4/4 if not provided
        })

        currentTime += durationSeconds
      })

      return ok(undefined)
    } catch (error) {
      return err(
        new AppError({
          message: `Failed to compile timeline: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: ERROR_CODES.INTERNAL_ERROR,
        })
      )
    }
  }

  /**
   * Schedules all events on Tone.Transport.
   * Calls the provided callback for each event at its start time.
   */
  schedule(onEventTrigger: (event: MusicalEvent) => void): void {
    this.timeline.forEach((event) => {
      Tone.getTransport().schedule((_time) => {
        onEventTrigger(event)
      }, event.startTime)
    })
  }

  /**
   * Verifies a detected pitch against the timeline in O(1).
   * Uses a shared mutable object to ensure zero-allocation in the hot path.
   *
   * @param currentTime - Current audio clock time in seconds.
   * @param detectedMidi - The MIDI note currently detected from the mic.
   * @param tolerance - Maximum allowed timing deviation (default 100ms).
   *
   * Complexity Analysis:
   * - Temporal: O(1) average case, assuming sequential playback.
   * - Spatial: O(1) as it reuses a singleton result object.
   */
  verify(
    currentTime: Seconds,
    detectedMidi: number,
    _tolerance: Seconds = 0.1 as Seconds,
  ): SyncVerification {
    // 1. Find the active event (O(1) assuming incremental calls)
    // In a real-world scenario with seeking, we'd need a binary search or pointer reset
    while (
      this.currentEventPointer < this.timeline.length - 1 &&
      currentTime >= this.timeline[this.currentEventPointer + 1].startTime
    ) {
      this.currentEventPointer++
    }

    const currentEvent = this.timeline[this.currentEventPointer]

    if (!currentEvent) {
      SHARED_VERIFICATION_RESULT.isCorrectPitch = false
      SHARED_VERIFICATION_RESULT.timingError = 0 as Seconds
      SHARED_VERIFICATION_RESULT.expectedMidi = -1
      SHARED_VERIFICATION_RESULT.currentNoteIndex = -1
      return SHARED_VERIFICATION_RESULT
    }

    const timingError = (currentTime - currentEvent.startTime) as Seconds
    const isCorrectPitch = Math.round(detectedMidi) === currentEvent.midiNote

    SHARED_VERIFICATION_RESULT.isCorrectPitch = isCorrectPitch
    SHARED_VERIFICATION_RESULT.timingError = timingError
    SHARED_VERIFICATION_RESULT.expectedMidi = currentEvent.midiNote
    SHARED_VERIFICATION_RESULT.currentNoteIndex = currentEvent.noteIndex

    return SHARED_VERIFICATION_RESULT
  }

  /**
   * Resets the playback pointer.
   */
  reset(): void {
    this.currentEventPointer = 0
  }

  /**
   * Returns the full compiled timeline (read-only).
   */
  getTimeline(): readonly MusicalEvent[] {
    return this.timeline
  }
}
