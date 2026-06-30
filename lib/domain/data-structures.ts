/**
 * Estructuras de Datos del Dominio
 *
 * Define tipos fundamentales para el procesamiento de audio, optimizados
 * para Zero-Allocation y baja latencia en el ciclo de vida de la aplicación.
 *
 * @packageDocumentation
 */

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
 * FixedRingBuffer: Buffer circular de tamaño fijo para datos temporales.
 * Utiliza un array pre-asignado para garantizar Zero-Allocation durante la ejecución.
 */
export class FixedRingBuffer<T> {
  private readonly buffer: Array<T | undefined>;
  private head = 0;
  private size = 0;

  constructor(public readonly maxSize: number) {
    this.buffer = new Array<T | undefined>(maxSize).fill(undefined);
  }

  /**
   * Inserta un elemento en el buffer. Si el buffer está lleno,
   * sobrescribe el elemento más antiguo (O(1)).
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
   * Evita la creación de nuevos arrays para mantener la eficiencia.
   */
  forEach(callback: (item: T, index: number) => void): void {
    for (let i = 0; i < this.size; i++) {
      const index = (this.head - 1 - i + this.maxSize) % this.maxSize;
      const item = this.buffer[index];
      if (item !== undefined) {
        callback(item, i);
      }
    }
  }

  /**
   * Retorna el último elemento insertado sin extraerlo.
   */
  peek(): T | undefined {
    if (this.size === 0) return undefined;
    return this.buffer[(this.head - 1 + this.maxSize) % this.maxSize];
  }

  /**
   * Limpia el buffer lógicamente reseteando los punteros.
   */
  clear(): void {
    this.head = 0;
    this.size = 0;
  }

  get length(): number {
    return this.size;
  }

  /**
   * Convierte el buffer a un array estándar.
   * ADVERTENCIA: Esta operación asigna memoria. Usar solo fuera del hot path (ej. reportes).
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
