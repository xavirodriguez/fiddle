import { CircularBuffer } from 'mnemonist';

import { type TechniqueMetrics } from '../practice/technique-agent';
import { type Cents,type Hertz } from './musical-domain';

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
  technique: undefined,
};

/**
 * Performance-optimized Ring Buffer for real-time analysis windows.
 *
 * DESIGN DECISIONS:
 * 1. Zero-Allocation: Delegates to Mnemonist's CircularBuffer.
 * 2. Pure Domain: Mnemonist is an allowed utility in the domain layer.
 * 3. Cache-Friendly: Uses native Mnemonist iteration.
 */
export class FixedRingBuffer<T> {
  private readonly buffer: CircularBuffer<T>;

  constructor(public readonly maxSize: number) {
    this.buffer = new CircularBuffer(Array, maxSize);
  }

  push(item: T): void {
    this.buffer.push(item);
  }

  /**
   * High-performance iteration from newest to oldest.
   *
   * Note: Mnemonist's CircularBuffer.forEach iterates from oldest to newest.
   * Our domain requires newest to oldest.
   */
  forEach(callback: (item: T, index: number) => void): void {
    if (this.buffer.size === 0) return;

    // Mnemonist CircularBuffer allows indexed access: buffer.get(i)
    // where 0 is the oldest and size-1 is the newest.
    const size = this.buffer.size;
    for (let i = 0; i < size; i++) {
      // newest to oldest: index size-1, size-2, ..., 0
      callback(this.buffer.get(size - 1 - i)!, i);
    }
  }

  /**
   * Returns the most recently added item without removing it.
   */
  peek(): T | undefined {
    if (this.buffer.size === 0) return undefined;
    return this.buffer.peekLast();
  }

  /**
   * Clears the buffer logically (O(1)).
   */
  clear(): void {
    this.buffer.clear();
  }

  get length(): number {
    return this.buffer.size;
  }

  /**
   * ONLY FOR TESTS OR NON-PERFORMANCE CRITICAL PATHS.
   * Allocates a new array.
   */
  toArray(): readonly T[] {
    const result: T[] = new Array(this.buffer.size);
    this.forEach((item, i) => {
      result[i] = item;
    });
    return result;
  }
}
