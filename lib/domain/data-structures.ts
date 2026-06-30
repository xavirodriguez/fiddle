/**
 * Estructuras de Datos del Dominio
 *
 * Define tipos fundamentales para el procesamiento de audio, optimizados
 * para Zero-Allocation y baja latencia.
 *
 * @packageDocumentation
 */

import { type TechniqueMetrics } from '../technique-types';
import { type Cents, type Hertz } from './musical-domain';

/** Umbral de tolerancia profesional para violín (cents). */
export const VIOLIN_TOLERANCE_CENTS = 15 as Cents;

/**
 * PitchFrame: Estructura inmutable para transporte de datos de tono.
 */
export interface PitchFrame {
  readonly frequency: Hertz;
  readonly centsDeviation: Cents;
  readonly confidence: number;
  readonly timestamp: number;
  readonly technique?: TechniqueMetrics;
}

/**
 * MutablePitchFrame: Estructura para reutilización de memoria en el hot path.
 */
export interface MutablePitchFrame {
  frequency: Hertz;
  centsDeviation: Cents;
  confidence: number;
  timestamp: number;
  technique?: TechniqueMetrics;
}

/**
 * Singleton compartido para evitar asignaciones en cada frame de audio (60 FPS).
 * @internal
 */
export const SHARED_PITCH_FRAME: MutablePitchFrame = {
  frequency: 0 as Hertz,
  centsDeviation: 0 as Cents,
  confidence: 0,
  timestamp: 0,
};

/**
 * FixedRingBuffer: Buffer circular de tamaño fijo.
 * Utiliza un array pre-asignado para evitar GC.
 */
export class FixedRingBuffer<T> {
  private readonly buffer: Array<T | undefined>;
  private head = 0;
  private size = 0;

  constructor(public readonly maxSize: number) {
    this.buffer = new Array<T | undefined>(maxSize).fill(undefined);
  }

  /** Inserta un elemento (complejidad O(1)). */
  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.maxSize;
    if (this.size < this.maxSize) {
      this.size++;
    }
  }

  /** Itera sobre los elementos sin crear nuevos arrays. */
  forEach(callback: (item: T, index: number) => void): void {
    for (let i = 0; i < this.size; i++) {
      const index = (this.head - 1 - i + this.maxSize) % this.maxSize;
      const item = this.buffer[index];
      if (item !== undefined) {
        callback(item, i);
      }
    }
  }

  /** Retorna el último elemento insertado. */
  peek(): T | undefined {
    if (this.size === 0) return undefined;
    return this.buffer[(this.head - 1 + this.maxSize) % this.maxSize];
  }

  /** Limpia el buffer lógicamente sin liberar memoria. */
  clear(): void {
    this.head = 0;
    this.size = 0;
  }

  get length(): number {
    return this.size;
  }

  /**
   * toArray: Asigna memoria. SOLO para uso en pruebas o depuración.
   * @internal
   */
  toArray(): readonly T[] {
    const result = new Array<T>(this.size);
    this.forEach((item, i) => {
      result[i] = item;
    });
    return result;
  }
}
