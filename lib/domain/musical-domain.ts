/**
 * Núcleo Matemático e Inmutable del Dominio Musical
 *
 * Este módulo proporciona las bases matemáticas fundamentales para el análisis
 * de afinación, utilizando tipos nominales para seguridad de unidades y
 * Neverthrow para el manejo funcional de errores.
 */

import { err, ok, type Result } from 'neverthrow';
import { z } from 'zod';

import { AppError, ERROR_CODES } from '../errors/app-error';

/**
 * Tipos Nominales (Branding) para prevenir la mezcla accidental de unidades.
 */
export type Hertz = number & { readonly __brand: 'Hertz' };
export type Cents = number & { readonly __brand: 'Cents' };
export type MidiNote = number & { readonly __brand: 'MidiNote' };

/**
 * Esquemas de Validación (Zod)
 */
const HertzSchema = z.number().finite().positive();
const CentsSchema = z.number().finite();
const MidiNoteSchema = z.number().finite().min(0).max(127);

/**
 * Configuración de Afinación
 */
export interface TuningConfig {
  readonly a4Frequency: Hertz;
}

export const DEFAULT_TUNING: TuningConfig = {
  a4Frequency: 440 as Hertz,
};

/**
 * Factorías y Validadores
 */

/**
 * Crea un valor de frecuencia en Hertz.
 * @param value - Valor numérico en hercios.
 * @returns Result con Hertz o AppError.
 */
export function makeHertz(value: number): Result<Hertz, AppError> {
  const result = HertzSchema.safeParse(value);
  if (!result.success) {
    return err(
      new AppError({
        message: 'Valor de Hertz inválido. Debe ser un número finito y positivo.',
        code: ERROR_CODES.DATA_VALIDATION_ERROR,
      })
    );
  }
  return ok(value as Hertz);
}

/**
 * Crea un valor de desviación en Cents.
 * @param value - Valor numérico en cents.
 * @returns Result con Cents o AppError.
 */
export function makeCents(value: number): Result<Cents, AppError> {
  const result = CentsSchema.safeParse(value);
  if (!result.success) {
    return err(
      new AppError({
        message: 'Valor de Cents inválido. Debe ser un número finito.',
        code: ERROR_CODES.DATA_VALIDATION_ERROR,
      })
    );
  }
  return ok(value as Cents);
}

/**
 * Crea una nota MIDI. Soporta valores fraccionales para precisión microtonal.
 * @param value - Valor numérico de la nota MIDI (0-127).
 * @returns Result con MidiNote o AppError.
 */
export function makeMidiNote(value: number): Result<MidiNote, AppError> {
  const result = MidiNoteSchema.safeParse(value);
  if (!result.success) {
    return err(
      new AppError({
        message: 'Valor de MidiNote inválido. Debe estar entre 0 y 127.',
        code: ERROR_CODES.DATA_VALIDATION_ERROR,
      })
    );
  }
  return ok(value as MidiNote);
}

/**
 * Factory para TuningConfig.
 */
export function makeTuningConfig(a4Frequency: number): Result<TuningConfig, AppError> {
  return makeHertz(a4Frequency).map((hz) => ({ a4Frequency: hz }));
}

/**
 * Fórmulas de Conversión Exacta Bidireccional (Logaritmo Base 2)
 *
 * m = 12 * log2(f / f_A4) + 69
 * f = f_A4 * 2^((m - 69) / 12)
 */

/**
 * Convierte frecuencia en Hertz a nota MIDI (fraccional).
 */
export function frequencyToMidi(
  frequency: Hertz,
  config: TuningConfig = DEFAULT_TUNING
): Result<MidiNote, AppError> {
  if (frequency <= 0) {
    return err(
      new AppError({
        message: 'La frecuencia debe ser mayor que cero para la conversión MIDI.',
        code: ERROR_CODES.DATA_VALIDATION_ERROR,
      })
    );
  }

  const midiValue = 12 * Math.log2(frequency / config.a4Frequency) + 69;
  return makeMidiNote(midiValue);
}

/**
 * Versión de alto rendimiento (Zero-Allocation) de frequencyToMidi.
 * @internal
 */
export function frequencyToMidiRaw(
  frequency: Hertz,
  config: TuningConfig = DEFAULT_TUNING
): MidiNote {
  return (12 * Math.log2(frequency / config.a4Frequency) + 69) as MidiNote;
}

/**
 * Convierte nota MIDI (fraccional) a Hertz.
 */
export function midiToFrequency(
  midi: MidiNote,
  config: TuningConfig = DEFAULT_TUNING
): Result<Hertz, AppError> {
  const hertzValue = config.a4Frequency * Math.pow(2, (midi - 69) / 12);
  return makeHertz(hertzValue);
}

/**
 * Calcula la desviación en cents entre una nota medida y una nota objetivo.
 * Formula: cents = (midi_medida - midi_objetivo) * 100
 */
export function calculateCentsDifference(measured: MidiNote, target: MidiNote): Cents {
  return ((measured - target) * 100) as Cents;
}

/**
 * Utilidad de interpolación lineal (Lerp) para suavizado.
 * @internal
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Normaliza y valida una alteración musical.
 * -1 (bemol), 0 (becuadro/natural), 1 (sostenido).
 */
export function normalizeAccidental(alter: number): Result<number, AppError> {
  if (alter !== -1 && alter !== 0 && alter !== 1) {
    return err(
      new AppError({
        message: `Alteración inválida: ${alter}. Se esperaba -1, 0 o 1.`,
        code: ERROR_CODES.DATA_VALIDATION_ERROR,
      })
    );
  }
  return ok(alter);
}
