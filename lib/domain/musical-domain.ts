/**
 * Musical Domain
 *
 * Defines the canonical types and normalization logic for musical concepts
 * shared across the application.
 */

import { z } from 'zod'
import { ok, err, Result } from 'neverthrow'
import { AppError, ERROR_CODES } from '../errors/app-error'

/**
 * Nominal types for musical magnitudes to prevent accidental mixing.
 */
export type Hertz = number & { readonly __brand: 'Hertz' }
export type Cents = number & { readonly __brand: 'Cents' }
export type MidiNote = number & { readonly __brand: 'Midi' }

/**
 * Zod schemas for internal validation.
 */
const HertzSchema = z.number().finite().nonnegative()
const CentsSchema = z.number().finite()
const MidiNoteSchema = z.number().finite().min(0).max(127)

/**
 * Configuration for base tuning.
 */
export interface TuningConfig {
  readonly a4Frequency: Hertz
}

/**
 * Default tuning configuration (Standard Concert Pitch).
 */
export const DEFAULT_TUNING: TuningConfig = {
  a4Frequency: 440 as Hertz,
}

/**
 * Factory for Hertz values.
 */
export function makeHertz(value: number): Result<Hertz, AppError> {
  const result = HertzSchema.safeParse(value)
  if (!result.success) {
    return err(
      new AppError({
        message: `Invalid Hertz value: ${value}. Must be a non-negative finite number.`,
        code: ERROR_CODES.DATA_VALIDATION_ERROR,
      })
    )
  }
  return ok(value as Hertz)
}

/**
 * Factory for Cents values.
 */
export function makeCents(value: number): Result<Cents, AppError> {
  const result = CentsSchema.safeParse(value)
  if (!result.success) {
    return err(
      new AppError({
        message: `Invalid Cents value: ${value}. Must be a finite number.`,
        code: ERROR_CODES.DATA_VALIDATION_ERROR,
      })
    )
  }
  return ok(value as Cents)
}

/**
 * Factory for MidiNote values.
 */
export function makeMidiNote(value: number): Result<MidiNote, AppError> {
  const result = MidiNoteSchema.safeParse(value)
  if (!result.success) {
    return err(
      new AppError({
        message: `Invalid MidiNote value: ${value}. Must be a finite number between 0 and 127.`,
        code: ERROR_CODES.DATA_VALIDATION_ERROR,
      })
    )
  }
  return ok(value as MidiNote)
}

/**
 * Factory for TuningConfig.
 */
export function makeTuningConfig(a4Frequency: number): Result<TuningConfig, AppError> {
  return makeHertz(a4Frequency).map((hz) => ({ a4Frequency: hz }))
}

/**
 * Converts a frequency in Hertz to its corresponding fractional MIDI note number.
 *
 * @formula midi = 12 * log2(f / A4) + 69
 */
export function frequencyToMidi(
  frequency: Hertz,
  config: TuningConfig = DEFAULT_TUNING
): Result<MidiNote, AppError> {
  if (frequency <= 0) {
    return err(
      new AppError({
        message: `Cannot convert zero or negative frequency (${frequency}) to MIDI.`,
        code: ERROR_CODES.DATA_VALIDATION_ERROR,
      })
    )
  }
  const midi = 12 * Math.log2(frequency / config.a4Frequency) + 69
  return makeMidiNote(midi)
}

/**
 * Converts a MIDI note number to its corresponding frequency in Hertz.
 *
 * @formula f = A4 * 2^((midi - 69) / 12)
 */
export function midiToFrequency(
  midi: MidiNote,
  config: TuningConfig = DEFAULT_TUNING
): Result<Hertz, AppError> {
  const frequency = config.a4Frequency * Math.pow(2, (midi - 69) / 12)
  return makeHertz(frequency)
}

/**
 * Linearly interpolates between two numbers.
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t
}

/**
 * Normalizes various accidental representations to the canonical numeric format.
 * (Keeping this as it was in the original file, but it's not explicitly requested for Phase 1,
 * however it's good to keep domain pure functions).
 */
export type CanonicalAccidental = -1 | 0 | 1

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

export function normalizeAccidental(
  input: number | string | undefined
): Result<CanonicalAccidental, AppError> {
  if (input === undefined) return ok(0)
  const mappingKey = String(input)
  const mappedValue = ACCIDENTAL_MAP[mappingKey]
  if (mappedValue !== undefined) return ok(mappedValue)

  return err(
    new AppError({
      message: `Unsupported accidental value: ${input}`,
      code: ERROR_CODES.DATA_VALIDATION_ERROR,
    })
  )
}
