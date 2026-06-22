/**
 * Data Structures
 *
 * Provides specialized, type-safe data structures for domain-specific needs.
 */

import { Hertz, Cents } from './musical-domain'
import { CircularBuffer } from 'mnemonist'

/**
 * Violin-specific domain constants.
 *
 * @remarks
 * The violin range is G3 (196Hz) to E7 (~2637Hz).
 * Tolerance for "in-tune" is usually ±15 cents for professional practice.
 */
export const VIOLIN_TOLERANCE_CENTS = 15 as Cents

/**
 * Represents a single frame of pitch analysis.
 *
 * @remarks
 * Used to communicate pitch data between the DSP engine and the domain.
 * Uses readonly properties to ensure immutability.
 */
export interface PitchFrame {
  readonly frequency: Hertz
  readonly centsDeviation: Cents
  readonly confidence: number
  readonly timestamp: number
}

/**
 * A reusable, mutable PitchFrame to avoid allocation in 60FPS loop.
 * @internal - For performance critical loops only.
 */
export const SHARED_PITCH_FRAME = {
  frequency: 0 as Hertz,
  centsDeviation: 0 as Cents,
  confidence: 0,
  timestamp: 0,
}

/**
 * A fixed-size circular buffer that automatically discards the oldest elements.
 * Useful for tracking detection history without unbounded memory growth.
 *
 * @remarks
 * Uses mnemonist CircularBuffer for high performance.
 * T - The type of elements in the buffer.
 * N - The maximum size of the buffer.
 */
export class FixedRingBuffer<T, N extends number> {
  private buffer: CircularBuffer<T>

  /**
   * @param maxSize - The maximum number of elements the buffer can hold.
   */
  constructor(public readonly maxSize: N) {
    this.buffer = new CircularBuffer(Array, maxSize)
  }

  /**
   * Adds one or more items to the buffer, displacing the oldest.
   *
   * @param items - The items to add.
   */
  push(...items: T[]): void {
    for (const item of items) {
      this.buffer.push(item)
    }
  }

  /**
   * Returns a read-only snapshot of the current buffer contents.
   * MAINTAINS NEWEST-TO-OLDEST ORDER.
   *
   * @returns A readonly array of items.
   */
  toArray(): readonly T[] {
    const size = this.buffer.size
    const result: T[] = new Array(size)
    let i = size - 1
    this.buffer.forEach((item: T) => {
      result[i--] = item
    })
    return result
  }

  /**
   * Clears all items from the buffer.
   */
  clear(): void {
    this.buffer.clear()
  }

  /**
   * Returns the number of items currently in the buffer.
   */
  get length(): number {
    return this.buffer.size
  }
}
