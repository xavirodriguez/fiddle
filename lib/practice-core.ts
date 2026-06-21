/**
 * This file contains the pure, side-effect-free core logic for the violin practice mode.
 * It defines the state, events, and a reducer function to handle state transitions in an immutable way.
 * This core is decoupled from React, Zustand, OSMD, and any browser-specific APIs.
 * Refactored for branded types and strict validation.
 */

import { normalizeAccidental } from './domain/musical-domain'
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
 * Validates note name format.
 */
export function assertValidNoteName(name: string): asserts name is NoteName {
  const noteRegex = /^[A-G](?:b{1,2}|#{1,2})?[0-8]$/
  const isValid = noteRegex.test(name)

  if (!isValid) {
    const message = `Invalid note name format: "${name}"`
    throw new AppError({
      message,
      code: ERROR_CODES.NOTE_PARSING_FAILED,
    })
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

const A4_FREQUENCY = 440
const A4_MIDI = 69

/**
 * Represents a musical note with properties derived from its frequency.
 */
export class MusicalNote {
  private constructor(
    public readonly frequency: number,
    public readonly midiNumber: number,
    public readonly noteName: string,
    public readonly octave: number,
    public readonly centsDeviation: number,
  ) {}

  isEnharmonic(other: MusicalNote): boolean {
    return this.midiNumber === other.midiNumber
  }

  static fromFrequency(frequency: number): MusicalNote {
    validateFrequency(frequency)
    const midiNumber = A4_MIDI + 12 * Math.log2(frequency / A4_FREQUENCY)
    const roundedMidi = Math.round(midiNumber)
    const centsDeviation = (midiNumber - roundedMidi) * 100
    const noteIndex = ((roundedMidi % 12) + 12) % 12
    const octave = Math.floor(roundedMidi / 12) - 1
    const noteName = NOTE_NAMES[noteIndex]

    return new MusicalNote(frequency, roundedMidi, noteName, octave, centsDeviation)
  }

  static fromMidi(midiNumber: number): MusicalNote {
    if (!Number.isFinite(midiNumber)) {
      throw new Error(`Invalid MIDI number: ${midiNumber}`)
    }

    const interval = (midiNumber - A4_MIDI) / 12
    const frequency = A4_FREQUENCY * Math.pow(2, interval)

    return MusicalNote.fromFrequency(frequency)
  }

  /**
   * Parses a note name in scientific pitch notation.
   *
   * @param fullName - A valid note name (e.g., "C4", "F#5", "Bb3")
   * @returns A MusicalNote instance
   * @throws {@link AppError} with code `NOTE_PARSING_FAILED` if format is invalid
   */
  static fromName(fullName: NoteName): MusicalNote {
    const { step, accidental, octave } = parseNoteName(fullName)
    const stepValue = STEP_VALUES[step]
    const accidentalValue = ACCIDENTAL_MODIFIERS[accidental]

    if (stepValue === undefined || accidentalValue === undefined) {
      throw new Error(`Unknown note components: step="${step}", accidental="${accidental}"`)
    }

    const midiNumber = (octave + 1) * 12 + stepValue + accidentalValue

    return MusicalNote.fromMidi(midiNumber)
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

interface NoteComponents {
  step: string
  accidental: string
  octave: number
}

function parseNoteName(fullName: NoteName): NoteComponents {
  const match = (fullName as string).match(/^([A-G])(b{1,2}|#{1,2})?([0-8])$/)
  if (!match) {
    throw new AppError({
      message: `Invalid note name format: "${fullName}" (octave must be 0-8)`,
      code: ERROR_CODES.NOTE_PARSING_FAILED,
    })
  }
  const [, step, accidental = '', octaveStr] = match
  return {
    step,
    accidental,
    octave: parseInt(octaveStr, 10),
  }
}

// --- PURE FUNCTIONS ---

/**
 * Converts a `TargetNote`'s pitch into a standard, parsable note name string.
 *
 * @param pitch - The pitch object from a `TargetNote`.
 * @returns A standardized branded note name string like `"C#4"`.
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
 * Short-circuits if target or detected note is undefined.
 */
export function isMatch(params: {
  target: TargetNote | undefined
  detected: DetectedNote | undefined
  tolerance?: number
}): boolean {
  const { target, detected, tolerance = 15 } = params
  if (!target || !detected) return false

  return checkPitchAndTune({ target, detected, tolerance })
}

/**
 * Validates both pitch name (enharmonic) and cent deviation.
 * @internal
 */
function checkPitchAndTune(params: {
  target: TargetNote
  detected: DetectedNote
  tolerance: number
}): boolean {
  const { target, detected, tolerance } = params
  const targetNote = MusicalNote.fromName(formatPitchName(target.pitch))

  assertValidNoteName(detected.pitch)
  const detectedNote = MusicalNote.fromName(detected.pitch)

  return targetNote.isEnharmonic(detectedNote) && Math.abs(detected.cents) < tolerance
}

/**
 * Entry point for entering the matched state.
 */
export function isNewMatch(params: {
  target: TargetNote | undefined
  detected: DetectedNote | undefined
  tolerance?: number
}): boolean {
  return isMatch(params)
}

/**
 * Entry point for maintaining the matched state.
 */
export function isStillMatched(params: {
  target: TargetNote | undefined
  detected: DetectedNote | undefined
  tolerance?: number
}): boolean {
  return isMatch(params)
}

/**
 * The core reducer for the practice mode, handling all state transitions.
 */
export function reducePracticeEvent(state: PracticeState, event: PracticeEvent): PracticeState {
  const handler = PRACTICE_EVENT_HANDLERS[event.type]
  return handler ? handler(state, event) : state
}

const PRACTICE_EVENT_HANDLERS: Record<
  string,
  (state: PracticeState, event: PracticeEvent) => PracticeState
> = {
  START: handleStart,
  STOP: handleStopReset,
  RESET: handleStopReset,
  NOTE_DETECTED: (state, event) =>
    handleNoteDetected(state, (event as Extract<PracticeEvent, { type: 'NOTE_DETECTED' }>).payload),
  HOLDING_NOTE: (state, event) =>
    handleHoldingNote(
      state,
      (event as Extract<PracticeEvent, { type: 'HOLDING_NOTE' }>).payload.duration,
    ),
  NO_NOTE_DETECTED: handleNoNoteDetected,
  NOTE_MATCHED: (state, event) =>
    handleNoteMatched(state, (event as Extract<PracticeEvent, { type: 'NOTE_MATCHED' }>).payload),
  JUMP_TO_NOTE: (state, event) =>
    handleJumpToNote(
      state,
      (event as Extract<PracticeEvent, { type: 'JUMP_TO_NOTE' }>).payload.index,
    ),
  UPDATE_METRONOME: (state, event) =>
    handleUpdateMetronome(
      state,
      (event as Extract<PracticeEvent, { type: 'UPDATE_METRONOME' }>).payload,
    ),
  UPDATE_LOOP_REGION: (state, event) =>
    handleUpdateLoopRegion(
      state,
      (event as Extract<PracticeEvent, { type: 'UPDATE_LOOP_REGION' }>).payload,
    ),
}

function handleStart(state: PracticeState, event: PracticeEvent): PracticeState {
  const payload = (event as Extract<PracticeEvent, { type: 'START' }>).payload

  return {
    ...state,
    status: 'listening',
    currentIndex: payload?.startIndex ?? 0,
    detectionHistory: [],
    holdDuration: 0,
    lastObservations: [],
    perfectNoteStreak: 0,
  }
}

function handleStopReset(state: PracticeState): PracticeState {
  return {
    ...state,
    status: 'idle',
    currentIndex: 0,
    detectionHistory: [],
    holdDuration: 0,
    lastObservations: [],
    perfectNoteStreak: 0,
  }
}

function handleNoteDetected(state: PracticeState, payload: DetectedNote): PracticeState {
  const status = getStatusAfterDetection(state.status)
  return {
    ...state,
    detectionHistory: updateDetectionHistory(state.detectionHistory, payload),
    status,
    holdDuration: status === 'listening' ? 0 : state.holdDuration,
  }
}

function updateDetectionHistory(
  history: readonly DetectedNote[],
  payload: DetectedNote,
): readonly DetectedNote[] {
  return [payload, ...history].slice(0, 10)
}

function getStatusAfterDetection(currentStatus: PracticeStatus): PracticeStatus {
  if (currentStatus === 'correct') {
    return 'listening'
  }
  return currentStatus
}

function handleHoldingNote(state: PracticeState, duration: number): PracticeState {
  if (state.status !== 'listening' && state.status !== 'validating') {
    return state
  }

  return { ...state, status: 'validating', holdDuration: duration }
}

function handleNoNoteDetected(state: PracticeState): PracticeState {
  if (state.status !== 'validating') {
    return state
  }

  return {
    ...state,
    status: 'listening',
    holdDuration: 0,
  }
}

type NoteMatchedPayload = Extract<PracticeEvent, { type: 'NOTE_MATCHED' }>['payload']

function handleNoteMatched(state: PracticeState, payload: NoteMatchedPayload): PracticeState {
  if (!isMatchingAllowed(state)) {
    return state
  }

  const streak = calculateNewStreak(state, payload)
  const observations = payload?.observations ?? []

  if (state.loopRegion?.isEnabled) {
    const loopResult = handleLoopMatched(state, payload, streak, observations)
    if (loopResult) return loopResult
  }

  return advanceToNextState(state, streak, observations)
}

function isMatchingAllowed(state: PracticeState): boolean {
  return state.status === 'listening' || state.status === 'validating'
}

function advanceToNextState(
  state: PracticeState,
  streak: number,
  observations: Observation[],
): PracticeState {
  const isLastNote = state.currentIndex >= state.exercise.notes.length - 1

  if (isLastNote) {
    return {
      ...state,
      status: 'completed',
      holdDuration: 0,
      lastObservations: observations,
      perfectNoteStreak: streak,
    }
  }

  return {
    ...state,
    currentIndex: state.currentIndex + 1,
    status: 'correct',
    detectionHistory: [],
    holdDuration: 0,
    lastObservations: observations,
    perfectNoteStreak: streak,
  }
}

function calculateNewStreak(state: PracticeState, payload: NoteMatchedPayload): number {
  const centsError = state.detectionHistory[0] ? Math.abs(state.detectionHistory[0].cents) : 100
  const isPerfect = payload?.isPerfect ?? centsError < 5

  return isPerfect ? state.perfectNoteStreak + 1 : 0
}

function handleJumpToNote(state: PracticeState, index: number): PracticeState {
  const totalNotes = state.exercise.notes.length
  const clampedIndex = Math.max(0, Math.min(index, totalNotes - 1))

  return {
    ...state,
    currentIndex: clampedIndex,
    status: state.status === 'completed' ? 'listening' : state.status,
    holdDuration: 0,
    detectionHistory: [],
  }
}

function handleUpdateMetronome(state: PracticeState, payload: Partial<MetronomeConfig>): PracticeState {
  return {
    ...state,
    metronome: state.metronome ? { ...state.metronome, ...payload } : undefined,
  }
}

function handleUpdateLoopRegion(state: PracticeState, payload: Partial<LoopRegion>): PracticeState {
  return {
    ...state,
    loopRegion: state.loopRegion ? { ...state.loopRegion, ...payload } : undefined,
  }
}

function handleLoopMatched(
  state: PracticeState,
  payload: NoteMatchedPayload,
  streak: number,
  observations: Observation[],
): PracticeState | undefined {
  if (!state.loopRegion) return undefined
  const isAtEndOfLoop = state.currentIndex >= state.loopRegion.endNoteIndex
  if (!isAtEndOfLoop) return undefined

  const { drillTarget, isLoopCompleted } = evaluateDrillTarget(state.loopRegion, payload)

  if (isLoopCompleted) {
    return {
      ...state,
      status: 'completed',
      holdDuration: 0,
      lastObservations: observations,
      perfectNoteStreak: streak,
      loopRegion: {
        ...state.loopRegion,
        drillTarget,
      },
    }
  }

  return {
    ...state,
    currentIndex: state.loopRegion.startNoteIndex,
    status: 'correct',
    detectionHistory: [],
    holdDuration: 0,
    lastObservations: observations,
    perfectNoteStreak: streak,
    loopRegion: {
      ...state.loopRegion,
      drillTarget,
    },
  }
}
