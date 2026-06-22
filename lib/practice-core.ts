/**
 * This file contains the pure, side-effect-free core logic for the violin practice mode.
 * It defines the state, events, and a reducer function to handle state transitions in an immutable way.
 * This core is decoupled from React, Zustand, OSMD, and any browser-specific APIs.
 * Refactored for branded types, strict validation, neverthrow and immer.
 */

import {
  normalizeAccidental,
  DEFAULT_TUNING,
  TuningConfig,
  frequencyToMidi,
  midiToFrequency,
} from './domain/musical-domain'
import { AppError, ERROR_CODES } from './errors/app-error'
import { Observation } from './technique-types'
import type { Note as TargetNote } from '@/lib/domain/exercise'
import type {
  DetectedNote,
  PracticeStatus,
  PracticeState,
  PracticeEvent,
  LoopRegion,
  MetronomeConfig,
} from '@/lib/domain/practice'
import { Result, ok, err } from 'neverthrow'
import { produce } from 'immer'

export type {
  TargetNote,
  DetectedNote,
  PracticeStatus,
  PracticeState,
  PracticeEvent,
  LoopRegion,
}

/**
 * A valid note name in scientific pitch notation.
 *
 * @example "C4", "F#5", "Bb3"
 */
export type NoteName = string

/**
 * Validates note name format using neverthrow.
 */
export function validateNoteName(name: string): Result<NoteName, AppError> {
  const noteRegex = /^[A-G](?:b{1,2}|#{1,2})?[0-8]$/
  const isValid = noteRegex.test(name)

  if (!isValid) {
    const message = `Invalid note name format: "${name}"`
    return err(
      new AppError({
        message,
        code: ERROR_CODES.NOTE_PARSING_FAILED,
      }),
    )
  }
  return ok(name as NoteName)
}

/**
 * Legacy assertion for compatibility.
 */
export function assertValidNoteName(name: string): asserts name is NoteName {
  const result = validateNoteName(name)
  if (result.isErr()) {
    throw result.error
  }
}

// --- MUSICAL NOTE LOGIC (inlined to prevent test runner issues) ---

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const STEP_VALUES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const ACCIDENTAL_MODIFIERS: Record<string, number> = {
  '##': 2,
  '#': 1,
  '': 0,
  b: -1,
  bb: -2,
}

/**
 * Represents a musical note with properties derived from its frequency.
 */
export class MusicalNote {
  // Static reusable instance to avoid allocation in 60FPS loop
  private static readonly REUSABLE_INSTANCE = new MusicalNote(0, 0, '', 0, 0)

  private constructor(
    public frequency: number,
    public midiNumber: number,
    public noteName: string,
    public octave: number,
    public centsDeviation: number,
  ) {}

  isEnharmonic(other: MusicalNote): boolean {
    return this.midiNumber === other.midiNumber
  }

  /**
   * Returns a shared, mutable instance updated with new frequency data.
   * WARNING: Do not store references to this instance.
   */
  static fromFrequencyShared(
    frequency: number,
    config: TuningConfig = DEFAULT_TUNING,
  ): MusicalNote {
    validateFrequency(frequency)
    const exactMidi = frequencyToMidi(frequency as any, config)
    const roundedMidi = Math.round(exactMidi)
    const centsDeviation = (exactMidi - roundedMidi) * 100
    const noteIndex = ((roundedMidi % 12) + 12) % 12
    const octave = Math.floor(roundedMidi / 12) - 1

    const instance = MusicalNote.REUSABLE_INSTANCE
    instance.frequency = frequency
    instance.midiNumber = roundedMidi
    instance.noteName = NOTE_NAMES[noteIndex]
    instance.octave = octave
    instance.centsDeviation = centsDeviation

    return instance
  }

  static fromFrequency(frequency: number, config: TuningConfig = DEFAULT_TUNING): MusicalNote {
    validateFrequency(frequency)
    const exactMidi = frequencyToMidi(frequency as any, config)
    const roundedMidi = Math.round(exactMidi)
    const centsDeviation = (exactMidi - roundedMidi) * 100
    const noteIndex = ((roundedMidi % 12) + 12) % 12
    const octave = Math.floor(roundedMidi / 12) - 1
    const noteName = NOTE_NAMES[noteIndex]

    return new MusicalNote(frequency, roundedMidi, noteName, octave, centsDeviation)
  }

  static fromMidi(midiNumber: number, config: TuningConfig = DEFAULT_TUNING): MusicalNote {
    const frequency = midiToFrequency(midiNumber as any, config)
    return MusicalNote.fromFrequency(frequency, config)
  }

  /**
   * Parses a note name in scientific pitch notation.
   *
   * @param fullName - A valid note name (e.g., "C4", "F#5", "Bb3")
   * @returns A Result with MusicalNote instance
   */
  static tryFromName(fullName: NoteName): Result<MusicalNote, AppError> {
    return validateNoteName(fullName).andThen((validName) => {
      const match = (validName as string).match(/^([A-G])(b{1,2}|#{1,2})?([0-8])$/)
      if (!match) {
        return err(
          new AppError({
            message: `Invalid note name format: "${validName}" (octave must be 0-8)`,
            code: ERROR_CODES.NOTE_PARSING_FAILED,
          }),
        )
      }
      const [, step, accidental = '', octaveStr] = match
      const stepValue = STEP_VALUES[step]
      const accidentalValue = ACCIDENTAL_MODIFIERS[accidental]
      const octave = parseInt(octaveStr, 10)

      const midiNumber = (octave + 1) * 12 + stepValue + accidentalValue
      return ok(MusicalNote.fromMidi(midiNumber))
    })
  }

  /**
   * Legacy method for compatibility.
   */
  static fromName(fullName: NoteName): MusicalNote {
    const result = MusicalNote.tryFromName(fullName)
    if (result.isErr()) {
      throw result.error
    }
    return result.value
  }

  get nameWithOctave(): NoteName {
    const result = `${this.noteName}${this.octave}`
    assertValidNoteName(result)
    return result as NoteName
  }
}

function validateFrequency(frequency: number): void {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    throw new Error(`Invalid frequency: ${frequency}`)
  }
}

// --- PURE FUNCTIONS ---

/**
 * Converts a `TargetNote`'s pitch into a standard, parsable note name string.
 */
export function formatPitchName(pitch: TargetNote['pitch']): NoteName {
  const canonicalAlter = normalizeAccidental(pitch.alter)
  const alterStr = getAlterString(canonicalAlter, pitch.alter)
  const result = `${pitch.step}${alterStr}${pitch.octave}`
  assertValidNoteName(result)
  return result
}

function getAlterString(canonicalAlter: number, originalAlter: number | string): string {
  switch (canonicalAlter) {
    case 1:
      return '#'
    case -1:
      return 'b'
    case 0:
      return ''
    default:
      throw new AppError({
        message: `Unsupported alter value: ${originalAlter}`,
        code: ERROR_CODES.DATA_VALIDATION_ERROR,
      })
  }
}

/**
 * Checks if a detected note matches a target note within a specified tolerance.
 */
export function isMatch(params: {
  target: TargetNote | undefined
  detected: DetectedNote | undefined
  tolerance?: number
}): boolean {
  const { target, detected, tolerance = 15 } = params
  if (!target || !detected) return false

  const targetName = formatPitchName(target.pitch)
  const targetResult = MusicalNote.tryFromName(targetName)
  const detectedResult = MusicalNote.tryFromName(detected.pitch)

  if (targetResult.isErr() || detectedResult.isErr()) return false

  return (
    targetResult.value.isEnharmonic(detectedResult.value) && Math.abs(detected.cents) < tolerance
  )
}

/**
 * The core reducer for the practice mode, handling all state transitions.
 * Modernized with Immer for clean immutable updates.
 */
export function reducePracticeEvent(state: PracticeState, event: PracticeEvent): PracticeState {
  return produce(state, (draft) => {
    switch (event.type) {
      case 'START': {
        const payload = (event as Extract<PracticeEvent, { type: 'START' }>).payload
        draft.status = 'listening'
        draft.currentIndex = payload?.startIndex ?? 0
        draft.detectionHistory = []
        draft.holdDuration = 0
        draft.lastObservations = []
        draft.perfectNoteStreak = 0
        break
      }
      case 'STOP':
      case 'RESET': {
        draft.status = 'idle'
        draft.currentIndex = 0
        draft.detectionHistory = []
        draft.holdDuration = 0
        draft.lastObservations = []
        draft.perfectNoteStreak = 0
        break
      }
      case 'NOTE_DETECTED': {
        const payload = (event as Extract<PracticeEvent, { type: 'NOTE_DETECTED' }>).payload
        draft.detectionHistory = [payload, ...draft.detectionHistory].slice(0, 10)
        if (draft.status === 'correct') {
          draft.status = 'listening'
        }
        if (draft.status === 'listening') {
          draft.holdDuration = 0
        }
        break
      }
      case 'HOLDING_NOTE': {
        const payload = (event as Extract<PracticeEvent, { type: 'HOLDING_NOTE' }>).payload
        if (draft.status === 'listening' || draft.status === 'validating') {
          draft.status = 'validating'
          draft.holdDuration = payload.duration
        }
        break
      }
      case 'NO_NOTE_DETECTED': {
        if (draft.status === 'validating') {
          draft.status = 'listening'
          draft.holdDuration = 0
        }
        break
      }
      case 'NOTE_MATCHED': {
        const payload = (event as Extract<PracticeEvent, { type: 'NOTE_MATCHED' }>).payload
        if (draft.status === 'listening' || draft.status === 'validating') {
          const centsError = draft.detectionHistory[0] ? Math.abs(draft.detectionHistory[0].cents) : 100
          const isPerfect = payload?.isPerfect ?? centsError < 5
          draft.perfectNoteStreak = isPerfect ? draft.perfectNoteStreak + 1 : 0
          draft.lastObservations = payload?.observations ?? []

          // Loop Handling
          if (draft.loopRegion?.isEnabled) {
            const isAtEndOfLoop = draft.currentIndex >= draft.loopRegion.endNoteIndex
            if (isAtEndOfLoop) {
              const { drillTarget, isLoopCompleted } = evaluateDrillTarget(draft.loopRegion, payload)
              draft.loopRegion.drillTarget = drillTarget
              if (isLoopCompleted) {
                draft.status = 'completed'
                draft.holdDuration = 0
                return // Important: Exit the reducer to prevent fall-through
              } else {
                draft.currentIndex = draft.loopRegion.startNoteIndex
                draft.status = 'correct'
                draft.detectionHistory = []
                draft.holdDuration = 0
                return // Important: Exit the reducer to prevent fall-through
              }
            }
          }

          // Standard advancement
          const isLastNote = draft.currentIndex >= draft.exercise.notes.length - 1
          if (isLastNote) {
            draft.status = 'completed'
            draft.holdDuration = 0
          } else {
            draft.currentIndex++
            draft.status = 'correct'
            draft.detectionHistory = []
            draft.holdDuration = 0
          }
        }
        break
      }
      case 'JUMP_TO_NOTE': {
        const payload = (event as Extract<PracticeEvent, { type: 'JUMP_TO_NOTE' }>).payload
        const totalNotes = draft.exercise.notes.length
        draft.currentIndex = Math.max(0, Math.min(payload.index, totalNotes - 1))
        if (draft.status === 'completed') {
          draft.status = 'listening'
        }
        draft.holdDuration = 0
        draft.detectionHistory = []
        break
      }
      case 'UPDATE_METRONOME': {
        const payload = (event as Extract<PracticeEvent, { type: 'UPDATE_METRONOME' }>).payload
        if (draft.metronome) {
          Object.assign(draft.metronome, payload)
        }
        break
      }
      case 'UPDATE_LOOP_REGION': {
        const payload = (event as Extract<PracticeEvent, { type: 'UPDATE_LOOP_REGION' }>).payload
        if (draft.loopRegion) {
          Object.assign(draft.loopRegion, payload)
        }
        break
      }
    }
  })
}

/**
 * Evaluates whether the drill target for a loop has been met.
 * Currently a stub for future implementation of intelligent drill logic.
 */
function evaluateDrillTarget(loopRegion: LoopRegion, payload: any) {
  // Placeholder for future logic that will determine if the loop should finish
  // based on technique metrics, perfect streaks, or repetition counts.
  return { drillTarget: loopRegion.drillTarget, isLoopCompleted: false }
}
