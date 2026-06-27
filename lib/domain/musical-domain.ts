/**
 * Musical Domain Foundation
 *
 * This module provides the core mathematical and immutable foundation for musical
 * pitch analysis, using nominal types for unit safety and Neverthrow for functional
 * error handling.
 */

import { err, ok, type Result } from 'neverthrow';
import { z } from 'zod';

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
const HertzSchema = z.number().finite().positive(); // Hertz must be positive for log2 formulas
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
      message: `Invalid Hertz value: ${value}. Must be a finite positive number.`,
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
 *
 * Formula (Hz to MIDI): m = 12 * log2(f / A4) + 69
 * Formula (MIDI to Hz): f = A4 * 2^((m - 69) / 12)
 */

/**
 * Converts frequency in Hertz to MIDI Note (fractional).
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

  return makeMidiNote(frequencyToMidiRaw(frequency, config));
}

/**
 * Zero-allocation version of frequencyToMidi for performance-critical loops.
 *
 * DESIGN DECISIONS:
 * 1. No Result/Option wrappers to avoid object instantiation at 60 FPS.
 * 2. Directly uses math primitives for maximum CPU throughput.
 * 3. Assumes valid input (frequency > 0) to bypass check overhead.
 */
export function frequencyToMidiRaw(
  frequency: Hertz,
  config: TuningConfig = DEFAULT_TUNING
): MidiNote {
  return (12 * Math.log2(frequency / config.a4Frequency) + 69) as MidiNote;
}

/**
 * Converts MIDI Note (fractional) to Hertz.
 */
export function midiToFrequency(
  midi: MidiNote,
  config: TuningConfig = DEFAULT_TUNING
): Result<Hertz, AppError> {
  const hertzValue = config.a4Frequency * Math.pow(2, (midi - 69) / 12);
  return makeHertz(hertzValue);
}

/**
 * Linear interpolation utility for signal smoothing.
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Normalizes and validates a musical accidental.
 * -1 (flat), 0 (natural), 1 (sharp).
 */
export function normalizeAccidental(alter: number): Result<number, AppError> {
  if (alter !== -1 && alter !== 0 && alter !== 1) {
    return err(
      new AppError({
        message: `Invalid accidental: ${alter}. Expected -1, 0, or 1.`,
        code: ERROR_CODES.DATA_VALIDATION_ERROR,
      }),
    )
  }
  return ok(alter)
}
