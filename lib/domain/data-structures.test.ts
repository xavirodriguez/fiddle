import { describe, it, expect } from 'vitest'
import { FixedRingBuffer } from './data-structures'

describe('FixedRingBuffer', () => {
  it('should push elements to the front and maintain size', () => {
    const buffer = new FixedRingBuffer<number, 3>(3)
    buffer.push(1)
    buffer.push(2)
    buffer.push(3)
    expect(buffer.toArray()).toEqual([3, 2, 1])
  })

  it('should displace older elements on overflow', () => {
    const buffer = new FixedRingBuffer<number, 3>(3)
    buffer.push(1)
    buffer.push(2)
    buffer.push(3)
    buffer.push(4) // Displaces 1
    expect(buffer.toArray()).toEqual([4, 3, 2])

    buffer.push(5) // Displaces 2
    expect(buffer.toArray()).toEqual([5, 4, 3])
  })

  it('should return a copy from toArray() to ensure immutability', () => {
    const buffer = new FixedRingBuffer<number, 3>(3)
    buffer.push(1)
    buffer.push(2)

    const array = buffer.toArray()
    // Try to modify the array (bypassing TypeScript to test runtime copy)
    // @ts-expect-error - testing runtime immutability by attempting to modify readonly array
    array[0] = 99

    expect(buffer.toArray()).toEqual([2, 1])
    expect(buffer.toArray()[0]).toBe(2)
  })

  it('should handle push with multiple elements (adding newest to front)', () => {
    const buffer = new FixedRingBuffer<number, 3>(3)
    buffer.push(1, 2, 3, 4, 5)
    // 5 is newest, so it should be at index 0. Buffer size is 3.
    // Result should be [5, 4, 3]
    expect(buffer.toArray()).toEqual([5, 4, 3])
  })
})
