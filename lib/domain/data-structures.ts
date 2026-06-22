import { Hertz, Cents } from './musical-domain'
import { CircularBuffer } from 'mnemonist'

/**
 * Violin-specific domain constants.
 */
export const VIOLIN_TOLERANCE_CENTS = 15 as Cents

/**
 * Represents a single frame of pitch analysis.
 */
export interface PitchFrame {
  readonly frequency: Hertz
  readonly centsDeviation: Cents
  readonly confidence: number
  readonly timestamp: number
}

/**
 * Internal mutable version of PitchFrame for performance-critical loops.
 * @internal
 */
export interface MutablePitchFrame {
  frequency: Hertz
  centsDeviation: Cents
  confidence: number
  timestamp: number
}

/**
 * A reusable, mutable PitchFrame to avoid allocation in 60FPS loop.
 * @internal - For performance critical loops only.
 */
export const SHARED_PITCH_FRAME: MutablePitchFrame = {
  frequency: 0 as Hertz,
  centsDeviation: 0 as Cents,
  confidence: 0,
  timestamp: 0,
}

/**
 * A fixed-size circular buffer that automatically discards the oldest elements.
 */
export class FixedRingBuffer<T, N extends number> {
  private buffer: CircularBuffer<T>

  constructor(public readonly maxSize: N) {
    this.buffer = new CircularBuffer(Array, maxSize)
  }

  push(...items: T[]): void {
    for (const item of items) {
      this.buffer.push(item)
    }
  }

  toArray(): readonly T[] {
    const size = this.buffer.size
    const result: T[] = new Array(size)
    let i = size - 1
    this.buffer.forEach((item: T) => {
      result[i--] = item
    })
    return result
  }

  forEach(callback: (item: T, index: number) => void): void {
    const size = this.buffer.size
    let i = 0
    for (let j = size - 1; j >= 0; j--) {
      callback(this.buffer.get(j), i++)
    }
  }

  clear(): void {
    this.buffer.clear()
  }

  get length(): number {
    return this.buffer.size
  }
}
