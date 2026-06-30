import { castDraft, produce } from 'immer'
import { err, ok, type Result } from 'neverthrow'

import type { Note as TargetNote } from '@/lib/domain/exercise'
import type {
  DetectedNote,
  LoopRegion,
  PracticeEvent,
  PracticeState,
  PracticeStatus,
} from '@/lib/domain/practice'

import {
  DEFAULT_TUNING,
  frequencyToMidi,
  type Hertz,
  type MidiNote,
  midiToFrequency,
  normalizeAccidental,
  type TuningConfig,
} from './domain/musical-domain'
import { AppError, ERROR_CODES } from './errors/app-error'
import { type Observation } from './technique-types'

export type {
  DetectedNote,
  LoopRegion,
  PracticeEvent,
  PracticeState,
  PracticeStatus,
  TargetNote,
}

/**
 * Validates note name format using neverthrow.
 */
export function validateNoteName(name: string): Result<string, AppError> {
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
  return ok(name)
}

/**
 * Legacy assertion for compatibility.
 */
export function assertValidNoteName(name: string): asserts name is string {
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
    const midiResult = frequencyToMidi(frequency as Hertz, config)
    if (midiResult.isErr()) throw midiResult.error
    const exactMidi = midiResult.value
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
    const midiResult = frequencyToMidi(frequency as Hertz, config)
    if (midiResult.isErr()) throw midiResult.error
    const exactMidi = midiResult.value
    const roundedMidi = Math.round(exactMidi)
    const centsDeviation = (exactMidi - roundedMidi) * 100
    const noteIndex = ((roundedMidi % 12) + 12) % 12
    const octave = Math.floor(roundedMidi / 12) - 1
    const noteName = NOTE_NAMES[noteIndex]

    return new MusicalNote(frequency, roundedMidi, noteName, octave, centsDeviation)
  }

  static fromMidi(midiNumber: number, config: TuningConfig = DEFAULT_TUNING): MusicalNote {
    const freqResult = midiToFrequency(midiNumber as MidiNote, config)
    if (freqResult.isErr()) throw freqResult.error
    return MusicalNote.fromFrequency(freqResult.value, config)
  }

  /**
   * Parses a note name in scientific pitch notation.
   *
   * @param fullName - A valid note name (e.g., "C4", "F#5", "Bb3")
   * @returns A Result with MusicalNote instance
   */
  static tryFromName(fullName: string): Result<MusicalNote, AppError> {
    return validateNoteName(fullName).andThen((validName) => {
      const noteRegex = /^([A-G])(b{1,2}|#{1,2})?([0-8])$/
      const match = noteRegex.exec(validName)
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
  static fromName(fullName: string): MusicalNote {
    const result = MusicalNote.tryFromName(fullName)
    if (result.isErr()) {
      throw result.error
    }
    return result.value
  }

  get nameWithOctave(): string {
    return `${this.noteName}${this.octave}`
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
export function formatPitchName(pitch: TargetNote['pitch']): string {
  const alterResult = normalizeAccidental(pitch.alter)
  if (alterResult.isErr()) throw alterResult.error
  const canonicalAlter = alterResult.value
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
      case 'START':
        handleStart(draft, event.payload)
        break
      case 'STOP':
      case 'RESET':
        handleStop(draft)
        break
      case 'NOTE_DETECTED':
        handleNoteDetected(draft, event.payload)
        break
      case 'HOLDING_NOTE':
        handleHoldingNote(draft, event.payload)
        break
      case 'NO_NOTE_DETECTED':
        handleNoNoteDetected(draft)
        break
      case 'NOTE_MATCHED':
        handleNoteMatched(draft, event.payload)
        break
      case 'JUMP_TO_NOTE':
        handleJumpToNote(draft, event.payload)
        break
      case 'UPDATE_METRONOME':
        if (draft.metronome) Object.assign(draft.metronome, event.payload)
        break
      case 'UPDATE_LOOP_REGION':
        if (draft.loopRegion) Object.assign(draft.loopRegion, event.payload)
        break
    }
  })
}

function handleStart(draft: PracticeState, payload?: { startIndex?: number }) {
  draft.status = 'listening'
  draft.currentIndex = payload?.startIndex ?? 0
  clearHistory(draft)
  draft.holdDuration = 0
  draft.lastObservations = []
  draft.perfectNoteStreak = 0
  draft.sessionHistory = []
}

function handleStop(draft: PracticeState) {
  draft.status = 'idle'
  draft.currentIndex = 0
  clearHistory(draft)
  draft.holdDuration = 0
  draft.lastObservations = []
  draft.perfectNoteStreak = 0
  draft.sessionHistory = []
}

function handleNoteDetected(draft: PracticeState, payload: DetectedNote) {
  // Bug 5: Zero-allocation update for detection history using ring buffer pointers.
  // Avoids array spreads and slice() to prevent GC pressure in the hot path.
  const history = draft.detectionHistory
  history.items[history.head] = castDraft(payload)
  history.head = (history.head + 1) % history.maxSize
  if (history.size < history.maxSize) {
    history.size++
  }

  if (draft.status === 'correct') draft.status = 'listening'
  if (draft.status === 'listening') draft.holdDuration = 0
}

function clearHistory(draft: PracticeState) {
  draft.detectionHistory.head = 0
  draft.detectionHistory.size = 0
  // Note: we don't necessarily need to null out items for performance,
  // but it's cleaner for some logic.
}

function handleHoldingNote(draft: PracticeState, payload: { duration: number }) {
  if (draft.status === 'listening' || draft.status === 'validating') {
    draft.status = 'validating'
    draft.holdDuration = payload.duration
  }
}

function handleNoNoteDetected(draft: PracticeState) {
  if (draft.status === 'validating') {
    draft.status = 'listening'
    draft.holdDuration = 0
  }
}

function handleNoteMatched(
  draft: PracticeState,
  payload: Extract<PracticeEvent, { type: 'NOTE_MATCHED' }>['payload'],
) {
  if (draft.status !== 'listening' && draft.status !== 'validating' && draft.status !== 'correct') return

  const newestIndex =
    (draft.detectionHistory.head - 1 + draft.detectionHistory.maxSize) %
    draft.detectionHistory.maxSize
  const newestItem = draft.detectionHistory.items[newestIndex]
  const centsError = newestItem ? Math.abs(newestItem.cents) : 100
  const isPerfect = payload?.isPerfect ?? centsError < 5
  draft.perfectNoteStreak = isPerfect ? draft.perfectNoteStreak + 1 : 0
  draft.lastObservations = payload?.observations ?? []

  if (draft.loopRegion?.isEnabled) {
    const isAtEndOfLoop = draft.currentIndex >= draft.loopRegion.endNoteIndex
    if (isAtEndOfLoop) {
      const loopSize = draft.loopRegion.endNoteIndex - draft.loopRegion.startNoteIndex + 1
      const isPerfectRepetition = draft.perfectNoteStreak >= loopSize

      const { drillTarget, isLoopCompleted } = evaluateDrillTarget(draft.loopRegion, {
        isPerfect: isPerfectRepetition,
      })
      draft.loopRegion.drillTarget = drillTarget
      if (isLoopCompleted) {
        draft.status = 'completed'
        draft.holdDuration = 0
      } else {
        draft.currentIndex = draft.loopRegion.startNoteIndex
        draft.status = 'correct'
        clearHistory(draft)
        draft.holdDuration = 0
      }
      return
    }
  }

  const isLastNote = draft.currentIndex >= draft.exercise.notes.length - 1
  if (isLastNote) {
    draft.status = 'completed'
    draft.holdDuration = 0
  } else {
    draft.currentIndex++
    draft.status = 'correct'
    clearHistory(draft)
    draft.holdDuration = 0
  }
}

function handleJumpToNote(draft: PracticeState, payload: { index: number }) {
  const totalNotes = draft.exercise.notes.length
  draft.currentIndex = Math.max(0, Math.min(payload.index, totalNotes - 1))
  if (draft.status === 'completed') draft.status = 'listening'
  draft.holdDuration = 0
  clearHistory(draft)
}

/**
 * Evaluates whether the drill target for a loop has been met.
 * Logic: if 3 consecutive perfect repetitions are achieved, the loop is completed.
 */
function evaluateDrillTarget(
  loopRegion: LoopRegion,
  payload?: { isPerfect: boolean; observations?: Observation[] },
) {
  const drillTarget = loopRegion.drillTarget
  if (!drillTarget) {
    return { drillTarget: null, isLoopCompleted: false }
  }

  const isPerfect = payload?.isPerfect ?? false
  let completedRepetitions = drillTarget.completedRepetitions

  if (isPerfect) {
    completedRepetitions++
  } else {
    completedRepetitions = 0 // Reset on failure for "consecutive" logic
  }

  // Bug 2: Loop completes after the required number of perfect repetitions
  const isLoopCompleted = completedRepetitions >= drillTarget.perfectRepetitions

  return {
    drillTarget: {
      ...drillTarget,
      completedRepetitions,
    },
    isLoopCompleted,
  }
}
