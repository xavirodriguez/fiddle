/**
 * Núcleo Matemático e Inmutable del Dominio Musical
 *
 * Proporciona las bases matemáticas fundamentales para el análisis de afinación,
 * utilizando tipos nominales (Branding) para seguridad de unidades y
 * Neverthrow para el manejo funcional de errores.
 *
 * @packageDocumentation
 */

import { err, ok, type Result } from 'neverthrow';
import { z } from 'zod';

import { AppError, ERROR_CODES } from '../errors/app-error';

// ---------------------------------------------------------------------------
// Tipos Nominales (Branding)
// ---------------------------------------------------------------------------

declare const HertzSymbol: unique symbol;
/** Representa una frecuencia física en Hercios. */
export type Hertz = number & { readonly [HertzSymbol]: typeof HertzSymbol };

declare const CentsSymbol: unique symbol;
/** Representa una desviación relativa en Cents. */
export type Cents = number & { readonly [CentsSymbol]: typeof CentsSymbol };

declare const MidiNoteSymbol: unique symbol;
/** Representa una nota MIDI (puede ser fraccional para microtonalidad). */
export type MidiNote = number & { readonly [MidiNoteSymbol]: typeof MidiNoteSymbol };

// ---------------------------------------------------------------------------
// Esquemas de Validación (Zod)
// ---------------------------------------------------------------------------

const HertzSchema = z.number().finite().positive();
const CentsSchema = z.number().finite();
const MidiNoteSchema = z.number().finite().min(0).max(127);

// ---------------------------------------------------------------------------
// Tipos y Constantes
// ---------------------------------------------------------------------------

/** Configuración de referencia para la afinación de la sesión. */
export interface TuningConfig {
  /** Frecuencia de referencia para la nota A4. */
  readonly a4Frequency: Hertz;
}

/** Afinación estándar de referencia internacional (A4 = 440Hz). */
export const DEFAULT_TUNING: TuningConfig = {
  a4Frequency: 440 as Hertz,
};

// ---------------------------------------------------------------------------
// Factorías con Validación
// ---------------------------------------------------------------------------

/**
 * Crea un valor de frecuencia en Hertz.
 * @param value - Valor numérico.
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
 * @param value - Valor numérico.
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
 * Crea una nota MIDI con soporte fraccional.
 * @param value - Valor numérico (0-127).
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

// ---------------------------------------------------------------------------
// Fórmulas de Conversión (Master Clock: AudioContext.currentTime)
// ---------------------------------------------------------------------------

/**
 * Convierte frecuencia (Hz) a nota MIDI usando logaritmo base 2.
 * Fórmula: m = 12 * log2(f / f_A4) + 69
 */
export function frequencyToMidi(
  frequency: Hertz,
  config: TuningConfig = DEFAULT_TUNING
): Result<MidiNote, AppError> {
  if (frequency <= 0) {
    return err(
      new AppError({
        message: 'Frecuencia no positiva para conversión MIDI.',
        code: ERROR_CODES.DATA_VALIDATION_ERROR,
      })
    );
  }
  const midiValue = 12 * Math.log2(frequency / config.a4Frequency) + 69;
  return makeMidiNote(midiValue);
}

/**
 * Convierte nota MIDI a frecuencia (Hz).
 * Fórmula: f = f_A4 * 2^((m - 69) / 12)
 */
export function midiToFrequency(
  midi: MidiNote,
  config: TuningConfig = DEFAULT_TUNING
): Result<Hertz, AppError> {
  const hertzValue = config.a4Frequency * Math.pow(2, (midi - 69) / 12);
  return makeHertz(hertzValue);
}

// ---------------------------------------------------------------------------
// Versiones RAW (Zero-Allocation / Hot Path)
// ---------------------------------------------------------------------------

/**
 * Conversión rápida Hz -> MIDI sin validación ni boxing de Result.
 * @internal
 */
export function frequencyToMidiRaw(
  frequency: number,
  a4Freq: number = DEFAULT_TUNING.a4Frequency
): number {
  return 12 * Math.log2(frequency / a4Freq) + 69;
}

/**
 * Conversión rápida MIDI -> Hz sin validación ni boxing de Result.
 * @internal
 */
export function midiToFrequencyRaw(
  midi: number,
  a4Freq: number = DEFAULT_TUNING.a4Frequency
): number {
  return a4Freq * Math.pow(2, (midi - 69) / 12);
}

/**
 * Calcula la desviación en cents entre dos puntos MIDI.
 */
export function calculateCentsDifference(measured: number, target: number): number {
  return (measured - target) * 100;
}

// ---------------------------------------------------------------------------
// Utilidades de Dominio
// ---------------------------------------------------------------------------

/** Normalización de alteraciones musicales (-1, 0, 1). */
export function normalizeAccidental(alter: number): Result<number, AppError> {
  if (alter !== -1 && alter !== 0 && alter !== 1) {
    return err(
      new AppError({
        message: `Alteración ${alter} inválida.`,
        code: ERROR_CODES.DATA_VALIDATION_ERROR,
      })
    );
  }
  return ok(alter);
}
