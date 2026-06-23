/**
 * Musical Domain Foundation
 *
 * This module provides the core mathematical and immutable foundation for musical
 * pitch analysis, using nominal types for unit safety and Neverthrow for functional
 * error handling.
 */

import { z } from 'zod';
import { ok, err, Result } from 'neverthrow';
import { AppError, ERROR_CODES } from '../errors/app-error';

/**
 * Nominal types (Branding) to prevent accidental unit mixing.
 */
export type Hertz = number & { readonly __brand: 'Hertz' };
export type Cents = number & { readonly __brand: 'Cents' };
export type MidiNote = number & { readonly __brand: 'MidiNote' };

/**
 * Validation Schemas
 */
const HertzSchema = z.number().finite().nonnegative();
const CentsSchema = z.number().finite();
const MidiNoteSchema = z.number().finite().min(0).max(127);

/**
 * Tuning Configuration
 */
export interface TuningConfig {
  readonly a4Frequency: Hertz;
}

export const DEFAULT_TUNING: TuningConfig = {
  a4Frequency: 440 as Hertz,
};

/**
 * Type Guards and Factories
 */

export function makeHertz(value: number): Result<Hertz, AppError> {
  const result = HertzSchema.safeParse(value);
  if (!result.success) {
    return err(new AppError({
      message: `Invalid Hertz value: ${value}. Must be a finite non-negative number.`,
      code: ERROR_CODES.DATA_VALIDATION_ERROR,
    }));
  }
  return ok(value as Hertz);
}

export function makeCents(value: number): Result<Cents, AppError> {
  const result = CentsSchema.safeParse(value);
  if (!result.success) {
    return err(new AppError({
      message: `Invalid Cents value: ${value}. Must be a finite number.`,
      code: ERROR_CODES.DATA_VALIDATION_ERROR,
    }));
  }
  return ok(value as Cents);
}

/**
 * Creates a MidiNote. Supports fractional values for microtonal precision.
 */
export function makeMidiNote(value: number): Result<MidiNote, AppError> {
  const result = MidiNoteSchema.safeParse(value);
  if (!result.success) {
    return err(new AppError({
      message: `Invalid MidiNote value: ${value}. Must be between 0 and 127.`,
      code: ERROR_CODES.DATA_VALIDATION_ERROR,
    }));
  }
  return ok(value as MidiNote);
}

/**
 * Factory for TuningConfig.
 */
export function makeTuningConfig(a4Frequency: number): Result<TuningConfig, AppError> {
  return makeHertz(a4Frequency).map((hz) => ({ a4Frequency: hz }));
}

/**
 * Bidirectional exact conversion formulas (Logarithmic Base 2)
 */

/**
 * Converts frequency in Hertz to MIDI Note (fractional).
 * Formula: m = 12 * log2(f / A4) + 69
 */
export function frequencyToMidi(
  frequency: Hertz,
  config: TuningConfig = DEFAULT_TUNING
): Result<MidiNote, AppError> {
  if (frequency <= 0) {
    return err(new AppError({
      message: 'Frequency must be greater than zero for MIDI conversion.',
      code: ERROR_CODES.DATA_VALIDATION_ERROR,
    }));
  }

  const midiValue = 12 * Math.log2(frequency / config.a4Frequency) + 69;
  return makeMidiNote(midiValue);
}

/**
 * Converts MIDI Note (fractional) to Hertz.
 * Formula: f = A4 * 2^((m - 69) / 12)
 */
export function midiToFrequency(
  midi: MidiNote,
  config: TuningConfig = DEFAULT_TUNING
): Result<Hertz, AppError> {
  const hertzValue = config.a4Frequency * Math.pow(2, (midi - 69) / 12);
  return makeHertz(hertzValue);
}

/**
 * Utility for linear interpolation between two values.
 * Used for smoothing and UI animations.
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Normalizes various accidental representations to the canonical numeric format.
 */
export type CanonicalAccidental = -1 | 0 | 1;

const ACCIDENTAL_MAP: Record<string, CanonicalAccidental> = {
  '1': 1,
  'sharp': 1,
  '#': 1,
  '2': 1,
  'double-sharp': 1,
  '##': 1,
  '-1': -1,
  'flat': -1,
  'b': -1,
  '-2': -1,
  'double-flat': -1,
  'bb': -1,
  '0': 0,
  'natural': 0,
  '': 0,
};

export function normalizeAccidental(
  input: number | string | undefined
): Result<CanonicalAccidental, AppError> {
  if (input === undefined) return ok(0);
  const mappingKey = String(input);
  const mappedValue = ACCIDENTAL_MAP[mappingKey];
  if (mappedValue !== undefined) return ok(mappedValue);

  return err(
    new AppError({
      message: `Unsupported accidental value: ${input}`,
      code: ERROR_CODES.DATA_VALIDATION_ERROR,
    })
  );
}
