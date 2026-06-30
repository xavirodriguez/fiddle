/**
 * Estructuras de Datos del Dominio
 *
 * Define tipos fundamentales para el procesamiento de audio, optimizados
 * para Zero-Allocation y baja latencia en el ciclo de vida de la aplicación.
 *
 * @packageDocumentation
 */

import { CircularBuffer } from 'mnemonist';

import { type TechniqueMetrics } from '../technique-types';
import { type Cents, type Hertz } from './musical-domain';

/**
 * Umbral de tolerancia profesional para violín (15 cents).
 * Se considera el estándar para una ejecución afinada en contexto de práctica.
 */
export const VIOLIN_TOLERANCE_CENTS = 15 as Cents;

/**
 * PitchFrame: Estructura inmutable para transporte de datos de tono.
 * Representa un instante puntual de análisis de la señal de audio.
 */
export interface PitchFrame {
  readonly frequency: Hertz;
  readonly centsDeviation: Cents;
  readonly confidence: number; // [0.0, 1.0]
  readonly timestamp: number;  // Basado en AudioContext.currentTime
  readonly technique?: TechniqueMetrics;
}

/**
 * MutablePitchFrame: Estructura para reutilización de memoria en el hot path.
 * Permite actualizar datos 60 veces por segundo sin disparar el Garbage Collector.
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
 * Utiliza mnemonist.CircularBuffer para garantizar Zero-Allocation.
 */
export class FixedRingBuffer<T> {
  private readonly buffer: CircularBuffer<T>;

  constructor(public readonly maxSize: number) {
    this.buffer = new CircularBuffer(Array, maxSize);
  }

  /**
   * Inserta un elemento en el buffer. Si el buffer está lleno,
   * sobrescribe el elemento más antiguo (O(1)).
   */
  push(item: T): void {
    this.buffer.push(item);
  }

  /** Itera sobre los elementos de más reciente a más antiguo sin crear nuevos arrays. */
  forEach(callback: (item: T, index: number) => void): void {
    const size = this.buffer.size;
    for (let i = 0; i < size; i++) {
      const item = this.buffer.get(size - 1 - i);
      if (item !== undefined) {
        callback(item, i);
      }
    }
  }

  /**
   * Retorna el último elemento insertado sin extraerlo.
   */
  peek(): T | undefined {
    if (this.buffer.size === 0) return undefined;
    return this.buffer.get(this.buffer.size - 1);
  }

  /**
   * Limpia el buffer lógicamente reseteando los punteros.
   */
  clear(): void {
    this.buffer.clear();
  }

  get length(): number {
    return this.buffer.size;
  }

  /**
   * Convierte el buffer a un array estándar.
   * ADVERTENCIA: Esta operación asigna memoria. Usar solo fuera del hot path (ej. reportes).
   * @internal
   */
  toArray(): readonly T[] {
    const size = this.buffer.size;
    const result = new Array<T>(size);
    for (let i = 0; i < size; i++) {
      const item = this.buffer.get(size - 1 - i);
      if (item !== undefined) {
        result[i] = item;
      }
    }
    return result;
  }
}
