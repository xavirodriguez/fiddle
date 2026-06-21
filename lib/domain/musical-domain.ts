/**
 * Musical Domain
 *
 * Defines the canonical types and normalization logic for musical concepts
 * shared across the application. This module serves as the source of truth for
 * scientific pitch notation and accidental mapping.
 *
 * @remarks
 * All musical logic in the application follows the standards defined here to
 * ensure consistency between the audio engine, the notation renderer, and
 * the persistence layer.
 */

import { AppError, ERROR_CODES } from '../errors/app-error'

/**
 * Configuration for base tuning.
 *
 * @remarks
 * Standard tuning is A4 = 440Hz, but violinists often use 442Hz or higher.
 */
export interface TuningConfig {
  readonly a4Frequency: Hertz
}

/**
 * Violin-specific domain constants.
 *
 * @remarks
 * The violin range is G3 (196Hz) to E7 (~2637Hz).
 * Tolerance for "in-tune" is usually ±15 cents for professional practice.
 */
export const VIOLIN_TOLERANCE_CENTS = 15 as Cents

/**
 * Linearly interpolates between two numbers.
 * @param start - Start value
 * @param end - End value
 * @param t - Fraction (0.0 to 1.0)
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t
}

/**
 * Default tuning configuration (Standard Concert Pitch).
 */
export const DEFAULT_TUNING: TuningConfig = {
  a4Frequency: 440 as Hertz,
}

/**
 * Nominal types for musical magnitudes to prevent accidental mixing.
 */
export type Hertz = number & { readonly __brand: 'Hertz' }
export type Cents = number & { readonly __brand: 'Cents' }
export type MidiNote = number & { readonly __brand: 'Midi' }

/**
 * Factory for Hertz values.
 * @throws {AppError} if value is negative or not finite.
 */
export function makeHertz(value: number): Hertz {
  if (!Number.isFinite(value) || value < 0) {
    throw new AppError({
      message: `Invalid Hertz value: ${value}. Must be a non-negative finite number.`,
      code: ERROR_CODES.DATA_VALIDATION_ERROR,
    })
  }
  return value as Hertz
}

/**
 * Factory for Cents values.
 * @throws {AppError} if value is not finite.
 */
export function makeCents(value: number): Cents {
  if (!Number.isFinite(value)) {
    throw new AppError({
      message: `Invalid Cents value: ${value}. Must be a finite number.`,
      code: ERROR_CODES.DATA_VALIDATION_ERROR,
    })
  }
  return value as Cents
}

/**
 * Factory for MidiNote values.
 * @throws {AppError} if value is not finite or out of reasonable range (0-127).
 */
export function makeMidiNote(value: number): MidiNote {
  if (!Number.isFinite(value) || value < 0 || value > 127) {
    throw new AppError({
      message: `Invalid MidiNote value: ${value}. Must be a finite number between 0 and 127.`,
      code: ERROR_CODES.DATA_VALIDATION_ERROR,
    })
  }
  return value as MidiNote
}

/**
 * Converts a frequency in Hertz to its corresponding fractional MIDI note number.
 *
 * @formula midi = 12 * log2(f / A4) + 69
 */
export function frequencyToMidi(frequency: Hertz, config: TuningConfig = DEFAULT_TUNING): MidiNote {
  if (frequency <= 0) {
    throw new AppError({
      message: `Cannot convert zero or negative frequency (${frequency}) to MIDI.`,
      code: ERROR_CODES.DATA_VALIDATION_ERROR,
    })
  }
  const midi = 12 * Math.log2(frequency / config.a4Frequency) + 69
  return midi as MidiNote
}

/**
 * Converts a MIDI note number to its corresponding frequency in Hertz.
 *
 * @formula f = A4 * 2^((midi - 69) / 12)
 */
export function midiToFrequency(midi: MidiNote, config: TuningConfig = DEFAULT_TUNING): Hertz {
  const frequency = config.a4Frequency * Math.pow(2, (midi - 69) / 12)
  return frequency as Hertz
}

/**
 * Represents a pitch alteration in a canonical numeric format.
 *
 * @remarks
 * This numeric representation is used for internal calculations and
 * pitch-to-frequency mapping.
 *
 * **Canonical Values**:
 * - `-1`: Flat (b)
 * - `0`: Natural
 * - `1`: Sharp (#)
 *
 * @public
 */
export type CanonicalAccidental = -1 | 0 | 1

/** @internal */
const ACCIDENTAL_MAP: Record<string, CanonicalAccidental> = {
  '1': 1,
  sharp: 1,
  '#': 1,
  '2': 1,
  'double-sharp': 1,
  '##': 1,
  '-1': -1,
  flat: -1,
  b: -1,
  '-2': -1,
  'double-flat': -1,
  bb: -1,
  '0': 0,
  natural: 0,
  '': 0,
}

/**
 * Normalizes various accidental representations to the canonical numeric format.
 *
 * @remarks
 * This function handles the variability of accidental representation in
 * different formats (MusicXML, user input, internal constants).
 *
 * **Supported Formats**:
 * - **Numeric**: -1 (flat), 0 (natural), 1 (sharp).
 * - **MusicXML Labels**: "flat", "natural", "sharp", "double-flat", "double-sharp".
 * - **Notation Symbols**: "b", "#", "##", "bb".
 * - **Nullability**: `undefined` are treated as `0` (natural).
 *
 * @param input - Accidental in any supported format.
 *
 * @returns A {@link CanonicalAccidental} (-1, 0, or 1).
 *
 * @throws {@link AppError} with code `DATA_VALIDATION_ERROR` if the input
 *         cannot be mapped to a known accidental.
 *
 * @example
 * ```ts
 * normalizeAccidental(1);        // returns 1
 * normalizeAccidental("#");      // returns 1
 * normalizeAccidental("flat");   // returns -1
 * ```
 *
 * @public
 */
export function normalizeAccidental(input: number | string | undefined): CanonicalAccidental {
  const isUndefined = input === undefined
  if (isUndefined) {
    return handleUndefinedAccidental()
  }

  const result = lookupAccidentalMapping(input)
  const finalAccidental = result

  return finalAccidental
}

function handleUndefinedAccidental(): CanonicalAccidental {
  const defaultAccidental = 0
  const result = defaultAccidental as CanonicalAccidental

  return result
}

function lookupAccidentalMapping(input: number | string): CanonicalAccidental {
  const mappingKey = String(input)
  const mappedValue = ACCIDENTAL_MAP[mappingKey]
  const hasMapping = mappedValue !== undefined

  if (hasMapping) {
    return mappedValue as CanonicalAccidental
  }

  throwUnsupportedAlterError(input)
}

function throwUnsupportedAlterError(input: number | string): never {
  const errorMsg = `Unsupported alter value: ${input}`
  throw new AppError({
    message: errorMsg,
    code: ERROR_CODES.DATA_VALIDATION_ERROR,
  })
}
