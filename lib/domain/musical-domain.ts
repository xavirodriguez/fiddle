/**
 * Núcleo Matemático e Inmutable del Dominio Musical
 *
 * Implementa las bases matemáticas para el análisis de afinación,
 * utilizando Tipos Nominales (Branding) para garantizar la integridad de las unidades
 * y Neverthrow para el manejo funcional de errores.
 *
 * @packageDocumentation
 */

import { err, ok, type Result } from 'neverthrow';
import { z } from 'zod';

import { AppError, ERROR_CODES } from '../errors/app-error';

// ---------------------------------------------------------------------------
// Tipos Nominales (Branding) - Domain Guardian
// ---------------------------------------------------------------------------

declare const HertzSymbol: unique symbol;
/** Representa una frecuencia física en Hercios (Hz). */
export type Hertz = number & { readonly [HertzSymbol]: typeof HertzSymbol };

declare const CentsSymbol: unique symbol;
/** Representa una desviación relativa en Cents (1/100 de semitono). */
export type Cents = number & { readonly [CentsSymbol]: typeof CentsSymbol };

declare const MidiNoteSymbol: unique symbol;
/** Representa una nota MIDI (soporta valores fraccionales para microtonalidad). */
export type MidiNote = number & { readonly [MidiNoteSymbol]: typeof MidiNoteSymbol };

// ---------------------------------------------------------------------------
// Esquemas de Validación (Zod)
// ---------------------------------------------------------------------------

const HertzSchema = z.number().finite().positive();
const CentsSchema = z.number().finite();
const MidiNoteSchema = z.number().finite().min(0).max(127);

// ---------------------------------------------------------------------------
// Configuración de Afinación
// ---------------------------------------------------------------------------

/** Configuración de referencia para la afinación. */
export interface TuningConfig {
  /** Frecuencia de referencia para la nota A4 (La 440Hz por defecto). */
  readonly a4Frequency: Hertz;
}

/** Afinación estándar de referencia (A4 = 440Hz). */
export const DEFAULT_TUNING: TuningConfig = {
  a4Frequency: 440 as Hertz,
};

// ---------------------------------------------------------------------------
// Factorías con Validación (Functional DDD)
// ---------------------------------------------------------------------------

/**
 * Crea un valor de frecuencia en Hertz validado.
 */
export function makeHertz(value: number): Result<Hertz, AppError> {
  const result = HertzSchema.safeParse(value);
  if (!result.success) {
    return err(
      new AppError({
        message: 'Frecuencia inválida: debe ser un número finito y positivo.',
        code: ERROR_CODES.DATA_VALIDATION_ERROR,
      })
    );
  }
  return ok(value as Hertz);
}

/**
 * Crea un valor de desviación en Cents validado.
 */
export function makeCents(value: number): Result<Cents, AppError> {
  const result = CentsSchema.safeParse(value);
  if (!result.success) {
    return err(
      new AppError({
        message: 'Cents inválidos: debe ser un número finito.',
        code: ERROR_CODES.DATA_VALIDATION_ERROR,
      })
    );
  }
  return ok(value as Cents);
}

/**
 * Crea una nota MIDI validada.
 */
export function makeMidiNote(value: number): Result<MidiNote, AppError> {
  const result = MidiNoteSchema.safeParse(value);
  if (!result.success) {
    return err(
      new AppError({
        message: 'Nota MIDI inválida: debe estar en el rango [0, 127].',
        code: ERROR_CODES.DATA_VALIDATION_ERROR,
      })
    );
  }
  return ok(value as MidiNote);
}

// ---------------------------------------------------------------------------
// Conversiones Bidireccionales (Fórmulas Logarítmicas Base 2)
// ---------------------------------------------------------------------------

/**
 * Convierte frecuencia (Hz) a nota MIDI.
 * Fórmula: m = 12 * log2(f / f_A4) + 69
 */
export function frequencyToMidi(
  frequency: Hertz,
  config: TuningConfig = DEFAULT_TUNING
): Result<MidiNote, AppError> {
  if (frequency <= 0) {
    return err(
      new AppError({
        message: 'No se puede convertir una frecuencia no positiva.',
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
// Versiones RAW (Optimización de Rendimiento - Zero-Allocation)
// ---------------------------------------------------------------------------

/**
 * Conversión ultra-rápida Hz -> MIDI para el hot path.
 * Evita validaciones y boxing de Result.
 * @internal
 */
export function frequencyToMidiRaw(
  frequency: number,
  a4Freq: number = DEFAULT_TUNING.a4Frequency
): number {
  return 12 * Math.log2(frequency / a4Freq) + 69;
}

/**
 * Conversión ultra-rápida MIDI -> Hz para el hot path.
 * @internal
 */
export function midiToFrequencyRaw(
  midi: number,
  a4Freq: number = DEFAULT_TUNING.a4Frequency
): number {
  return a4Freq * Math.pow(2, (midi - 69) / 12);
}

/**
 * Calcula la desviación en cents entre una nota medida y un objetivo.
 */
export function calculateCentsDifference(measured: number, target: number): number {
  return (measured - target) * 100;
}

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
