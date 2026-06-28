/**
 * Estructuras de Datos del Dominio
 *
 * Define los tipos fundamentales para el flujo de análisis de audio,
 * optimizados para rendimiento y consistencia temporal.
 */

import { type TechniqueMetrics } from '../technique-types';
import { type Cents, type Hertz } from './musical-domain';

/**
 * Umbral de tolerancia continua para violín (Intonación profesional).
 * Se define típicamente en +/- 15 cents.
 */
export const VIOLIN_TOLERANCE_CENTS = 15 as Cents;

/**
 * Representa un frame discreto de análisis de tono en un punto temporal.
 * Esta estructura es inmutable para la lógica del dominio.
 */
export interface PitchFrame {
  readonly frequency: Hertz;
  readonly centsDeviation: Cents;
  readonly confidence: number;
  readonly timestamp: number; // Vinculado a AudioContext.currentTime
  readonly technique?: TechniqueMetrics;
}

/**
 * Versión mutable de PitchFrame para bucles DSP críticos.
 * Se utiliza con SHARED_PITCH_FRAME para evitar asignaciones de objetos (Zero-Allocation).
 */
export interface MutablePitchFrame {
  frequency: Hertz;
  centsDeviation: Cents;
  confidence: number;
  timestamp: number;
  technique?: TechniqueMetrics;
}

/**
 * Objeto compartido pre-asignado para ser reutilizado en frames de análisis.
 * @internal
 */
export const SHARED_PITCH_FRAME: MutablePitchFrame = {
  frequency: 0 as Hertz,
  centsDeviation: 0 as Cents,
  confidence: 0,
  timestamp: 0,
};

/**
 * Buffer Circular de tamaño fijo optimizado para rendimiento.
 */
export class FixedRingBuffer<T> {
  private readonly buffer: Array<T | undefined>;
  private head = 0;
  private size = 0;

  constructor(public readonly maxSize: number) {
    this.buffer = new Array<T | undefined>(maxSize).fill(undefined);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.maxSize;
    if (this.size < this.maxSize) {
      this.size++;
    }
  }

  forEach(callback: (item: T, index: number) => void): void {
    if (this.size === 0) return;

    for (let i = 0; i < this.size; i++) {
      const index = (this.head - 1 - i + this.maxSize) % this.maxSize;
      const item = this.buffer[index];
      if (item !== undefined) {
        callback(item, i);
      }
    }
  }

  peek(): T | undefined {
    if (this.size === 0) return undefined;
    const index = (this.head - 1 + this.maxSize) % this.maxSize;
    return this.buffer[index];
  }

  clear(): void {
    this.head = 0;
    this.size = 0;
  }

  get length(): number {
    return this.size;
  }

  /**
   * SOLO PARA PRUEBAS O RUTAS NO CRÍTICAS PARA EL RENDIMIENTO.
   * Asigna un nuevo array.
   */
  toArray(): readonly T[] {
    const result: T[] = new Array<T>(this.size);
    this.forEach((item, i) => {
      result[i] = item;
    });
    return result;
  }
}
