import { describe, it, expect } from 'vitest'
import { FixedRingBuffer, PitchFrame } from './data-structures'
import { Hertz, Cents } from './musical-domain'

describe('PitchFrame', () => {
  it('should allow creating a PitchFrame with branded types', () => {
    const frame: PitchFrame = {
      frequency: 440 as Hertz,
      centsDeviation: 0 as Cents,
      confidence: 1.0,
      timestamp: 12345,
    }
    expect(frame.frequency).toBe(440)
    expect(frame.centsDeviation).toBe(0)
  })
})

describe('FixedRingBuffer', () => {
  it('should push elements and maintain size', () => {
    const buffer = new FixedRingBuffer<number>(3)
    buffer.push(1)
    buffer.push(2)
    buffer.push(3)
    expect(buffer.toArray()).toEqual([3, 2, 1])
  })

  it('should displace older elements on overflow', () => {
    const buffer = new FixedRingBuffer<number>(3)
    buffer.push(1)
    buffer.push(2)
    buffer.push(3)
    buffer.push(4) // Displaces 1
    expect(buffer.toArray()).toEqual([4, 3, 2])

    buffer.push(5) // Displaces 2
    expect(buffer.toArray()).toEqual([5, 4, 3])
  })

  it('should handle forEach from newest to oldest', () => {
    const buffer = new FixedRingBuffer<number>(3)
    buffer.push(1)
    buffer.push(2)
    buffer.push(3)
    buffer.push(4)

    const results: number[] = []
    buffer.forEach((item) => results.push(item))
    expect(results).toEqual([4, 3, 2])
  })

  it('should peek the latest element', () => {
    const buffer = new FixedRingBuffer<number>(3)
    expect(buffer.peek()).toBeUndefined()
    buffer.push(1)
    expect(buffer.peek()).toBe(1)
    buffer.push(2)
    expect(buffer.peek()).toBe(2)
  })

  it('should return a new array from toArray()', () => {
    const buffer = new FixedRingBuffer<number>(3)
    buffer.push(1)
    buffer.push(2)

    const array = buffer.toArray() as number[]
    array[0] = 99

    expect(buffer.toArray()).toEqual([2, 1])
    expect(buffer.toArray()[0]).toBe(2)
  })

  it('should handle push with multiple elements by pushing them one by one', () => {
    const buffer = new FixedRingBuffer<number, 3>(3)
    buffer.push(1)
    buffer.push(2)
    buffer.push(3)
    buffer.push(4)
    buffer.push(5)
    // 5 is newest, so it should be at index 0. Buffer size is 3.
    // Result should be [5, 4, 3]
    expect(buffer.toArray()).toEqual([5, 4, 3])
  })
})
