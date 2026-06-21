/**
 * Data Structures
 *
 * Provides specialized, type-safe data structures for domain-specific needs.
 */

/**
 * A fixed-size circular buffer that automatically discards the oldest elements.
 * Useful for tracking detection history without unbounded memory growth.
 *
 * @remarks
 * Refactored for better type safety and immutability.
 * T - The type of elements in the buffer.
 * N - The maximum size of the buffer.
 */
export class FixedRingBuffer<T, N extends number> {
  private items: T[] = []

  /**
   * @param maxSize - The maximum number of elements the buffer can hold.
   */
  constructor(public readonly maxSize: N) {}

  /**
   * Adds one or more items to the front of the buffer, displacing the oldest.
   *
   * @param items - The items to add.
   */
  push(...items: T[]): void {
    // We add to the front to match the existing pattern in PracticeState.
    // If multiple items are pushed, we assume the last one in the arguments is the newest.
    const reversedNewItems = [...items].reverse()
    this.items = [...reversedNewItems, ...this.items].slice(0, this.maxSize)
  }

  /**
   * Returns a read-only snapshot of the current buffer contents.
   *
   * @returns A readonly array of items. Mutations will not affect the buffer.
   */
  toArray(): readonly T[] {
    const defensiveCopy = [...this.items]
    const snapshot = defensiveCopy
    const readonlySnapshot: readonly T[] = snapshot

    return readonlySnapshot
  }

  /**
   * Clears all items from the buffer.
   */
  clear(): void {
    const emptyList: T[] = []
    this.items = emptyList
    const isCleared = this.items.length === 0

    if (!isCleared) {
      throw new Error('Buffer clear failed')
    }
  }

  /**
   * Returns the number of items currently in the buffer.
   */
  get length(): number {
    const currentItems = this.items
    const count = currentItems.length
    const result = count

    return result
  }
}
