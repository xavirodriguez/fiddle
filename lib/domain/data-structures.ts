import { type TechniqueMetrics } from '../technique-types';
import { type Cents, type Hertz } from './musical-domain';

/**
 * Constantes de Dominio Específicas para Violín
 * La tolerancia profesional típica está dentro de los 15 cents.
 */
export const VIOLIN_TOLERANCE_CENTS = 15 as Cents;

/**
 * PitchFrame: Representa una captura discreta de análisis de tono.
 * Estructura inmutable para lógica de dominio (Domain Guardian).
 */
export interface PitchFrame {
  readonly frequency: Hertz;
  readonly centsDeviation: Cents;
  readonly confidence: number;
  readonly timestamp: number; // Referenciado a AudioContext.currentTime
  readonly technique?: TechniqueMetrics;
}

/**
 * MutablePitchFrame: Versión mutable para bucles DSP de alto rendimiento.
 * Utilizado con SHARED_PITCH_FRAME para evitar recolección de basura (Runtime Optimizer).
 */
export interface MutablePitchFrame {
  frequency: Hertz;
  centsDeviation: Cents;
  confidence: number;
  timestamp: number;
  technique?: TechniqueMetrics;
}

/**
 * Objeto compartido pre-asignado (Zero-Allocation).
 * @internal
 */
export const SHARED_PITCH_FRAME: MutablePitchFrame = {
  frequency: 0 as Hertz,
  centsDeviation: 0 as Cents,
  confidence: 0,
  timestamp: 0,
};

/**
 * FixedRingBuffer: Buffer circular de alto rendimiento para ventanas de análisis.
 * (Runtime Optimizer)
 */
export class FixedRingBuffer<T> {
  private readonly buffer: Array<T | undefined>;
  private head = 0;
  private size = 0;

  constructor(public readonly maxSize: number) {
    this.buffer = new Array(maxSize).fill(undefined);
  }

  /**
   * Inserta un elemento en el buffer (Zero-Allocation).
   */
  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.maxSize;
    if (this.size < this.maxSize) {
      this.size++;
    }
  }

  /**
   * Itera sobre los elementos desde el más reciente al más antiguo.
   */
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

  /**
   * Obtiene el elemento más reciente sin extraerlo.
   */
  peek(): T | undefined {
    if (this.size === 0) return undefined;
    const index = (this.head - 1 + this.maxSize) % this.maxSize;
    return this.buffer[index];
  }

  /**
   * Limpieza lógica (O(1)).
   */
  clear(): void {
    this.head = 0;
    this.size = 0;
  }

  get length(): number {
    return this.size;
  }

  /**
   * Convierte a array (Solo para tests o rutas no críticas).
   */
  toArray(): readonly T[] {
    const result: T[] = new Array(this.size);
    this.forEach((item, i) => {
      result[i] = item;
    });
    return result;
  }
}
