/**
 * Musical Domain Foundation
 *
 * Este módulo constituye el núcleo matemático inmutable para el análisis de afinación.
 * Implementado bajo los principios de DDD (Domain Guardian), DSP de alta precisión (DSP Wizard)
 * y optimización de tiempo de ejecución (Runtime Optimizer).
 */

import { err, ok, type Result } from 'neverthrow';
import { z } from 'zod';

import { AppError, ERROR_CODES } from '../errors/app-error';

/**
 * Nominal Types (Branding)
 * Previene la mezcla accidental de unidades (Hz vs Cents vs MidiNote).
 */
export type Hertz = number & { readonly __brand: 'Hertz' };
export type Cents = number & { readonly __brand: 'Cents' };
export type MidiNote = number & { readonly __brand: 'MidiNote' };

/**
 * El alter (accidental) de una nota.
 * -1 = flat, 0 = natural, 1 = sharp
 */
export type NoteAlter = -1 | 0 | 1;

/**
 * Esquemas de Validación (Zod)
 */
const HertzSchema = z.number().finite().min(0); // Hercios deben ser no negativos
const CentsSchema = z.number().finite();
const MidiNoteSchema = z.number().finite().min(0).max(127);

/**
 * Configuración de Afinación (Calibration)
 */
export interface TuningConfig {
  readonly a4Frequency: Hertz;
}

export const DEFAULT_TUNING: TuningConfig = {
  a4Frequency: 440 as Hertz,
};

/**
 * Fábricas de Tipos con Validación (Domain Guardian)
 */

export function makeHertz(value: number): Result<Hertz, AppError> {
  const result = HertzSchema.safeParse(value);
  if (!result.success) {
    return err(new AppError({
      message: `Valor de Hertz inválido: ${value}. Debe ser un número finito no negativo.`,
      code: ERROR_CODES.DATA_VALIDATION_ERROR,
    }));
  }
  return ok(value as Hertz);
}

export function makeCents(value: number): Result<Cents, AppError> {
  const result = CentsSchema.safeParse(value);
  if (!result.success) {
    return err(new AppError({
      message: `Valor de Cents inválido: ${value}. Debe ser un número finito.`,
      code: ERROR_CODES.DATA_VALIDATION_ERROR,
    }));
  }
  return ok(value as Cents);
}

export function makeMidiNote(value: number): Result<MidiNote, AppError> {
  const result = MidiNoteSchema.safeParse(value);
  if (!result.success) {
    return err(new AppError({
      message: `Valor de MidiNote inválido: ${value}. Debe estar entre 0 y 127.`,
      code: ERROR_CODES.DATA_VALIDATION_ERROR,
    }));
  }
  return ok(value as MidiNote);
}

/**
 * Normaliza y valida un alter (accidental).
 */
export function normalizeAccidental(alter: number | undefined): Result<NoteAlter, AppError> {
  const value = alter ?? 0;
  if (value === -1 || value === 0 || value === 1) {
    return ok(value as NoteAlter);
  }
  return err(new AppError({
    message: `Alter inválido: ${alter}. Debe ser -1, 0 o 1.`,
    code: ERROR_CODES.DATA_VALIDATION_ERROR,
  }));
}

/**
 * Fórmulas de Conversión Exacta (DSP Wizard)
 *
 * Frecuencia a MIDI: m = 12 * log2(f / f_A4) + 69
 * MIDI a Frecuencia: f = f_A4 * 2^((m - 69) / 12)
 */

/**
 * Convierte frecuencia (Hz) a Nota MIDI (fraccional para microtonalidad).
 */
export function frequencyToMidi(
  frequency: Hertz,
  config: TuningConfig = DEFAULT_TUNING
): Result<MidiNote, AppError> {
  if (frequency <= 0) {
    return err(new AppError({
      message: 'La frecuencia debe ser mayor a cero para conversión logarítmica MIDI.',
      code: ERROR_CODES.DATA_VALIDATION_ERROR,
    }));
  }

  return makeMidiNote(frequencyToMidiRaw(frequency, config));
}

/**
 * Versión de alto rendimiento (Zero-Allocation) para el hot-path.
 * (Runtime Optimizer)
 */
export function frequencyToMidiRaw(
  frequency: Hertz,
  config: TuningConfig = DEFAULT_TUNING
): MidiNote {
  // Optimizamos evitando validaciones y wrappers en el bucle de 60 FPS
  return (12 * Math.log2(frequency / config.a4Frequency) + 69) as MidiNote;
}

/**
 * Convierte Nota MIDI (fraccional) a Frecuencia (Hz).
 */
export function midiToFrequency(
  midi: MidiNote,
  config: TuningConfig = DEFAULT_TUNING
): Result<Hertz, AppError> {
  const hertzValue = config.a4Frequency * Math.pow(2, (midi - 69) / 12);
  return makeHertz(hertzValue);
}

/**
 * Utilidad de interpolación lineal (Lerp) para suavizado de señales.
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}
