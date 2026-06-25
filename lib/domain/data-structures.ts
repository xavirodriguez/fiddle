import { type Cents,type Hertz } from './musical-domain';
import { type TechniqueMetrics } from '../practice/technique-agent';

/**
 * Violin-specific domain constants.
 * Professional intonation tolerance is typically within 15 cents.
 */
export const VIOLIN_TOLERANCE_CENTS = 15 as Cents;

/**
 * Represents a discrete frame of pitch analysis at a specific point in time.
 * This structure is immutable for domain logic.
 */
export interface PitchFrame {
  readonly frequency: Hertz;
  readonly centsDeviation: Cents;
  readonly confidence: number;
  readonly timestamp: number; // Linked to AudioContext.currentTime
  readonly technique?: TechniqueMetrics;
}

/**
 * Mutable version of PitchFrame for performance-critical DSP loops.
 * Used with SHARED_PITCH_FRAME to avoid object allocation in the hot path.
 */
export interface MutablePitchFrame {
  frequency: Hertz;
  centsDeviation: Cents;
  confidence: number;
  timestamp: number;
  technique?: TechniqueMetrics;
}

/**
 * Pre-allocated shared object to be reused across analysis frames (Zero-Allocation).
 * @internal
 */
export const SHARED_PITCH_FRAME: MutablePitchFrame = {
  frequency: 0 as Hertz,
  centsDeviation: 0 as Cents,
  confidence: 0,
  timestamp: 0,
};

/**
 * Performance-optimized Ring Buffer for real-time analysis windows.
 *
 * DESIGN DECISIONS:
 * 1. Zero-Allocation: Uses a pre-allocated fixed-size array.
 * 2. Pure Domain: No external dependencies.
 * 3. Cache-Friendly: Uses a simple circular index.
 */
export class FixedRingBuffer<T> {
  private readonly buffer: T[];
  private head = 0;
  private size = 0;

  constructor(public readonly maxSize: number) {
    this.buffer = new Array(maxSize);
  }

  /**
   * Pushes an item into the buffer. If the buffer is full, it overwrites the oldest item.
   */
  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.maxSize;
    if (this.size < this.maxSize) {
      this.size++;
    }
  }

  /**
   * High-performance iteration from newest to oldest.
   */
  forEach(callback: (item: T, index: number) => void): void {
    if (this.size === 0) return;

    for (let i = 0; i < this.size; i++) {
      // (this.head - 1 - i) can be negative, so we add maxSize to keep it positive.
      const index = (this.head - 1 - i + this.maxSize) % this.maxSize;
      const item = this.buffer[index];
      if (item !== undefined) {
        callback(item, i);
      }
    }
  }

  /**
   * Returns the most recently added item without removing it.
   */
  peek(): T | undefined {
    if (this.size === 0) return undefined;
    const index = (this.head - 1 + this.maxSize) % this.maxSize;
    return this.buffer[index];
  }

  /**
   * Clears the buffer logically (O(1)).
   */
  clear(): void {
    this.head = 0;
    this.size = 0;
  }

  get length(): number {
    return this.size;
  }

  /**
   * ONLY FOR TESTS OR NON-PERFORMANCE CRITICAL PATHS.
   * Allocates a new array.
   */
  toArray(): readonly T[] {
    const result: T[] = new Array(this.size);
    this.forEach((item, i) => {
      result[i] = item;
    });
    return result;
  }
}
