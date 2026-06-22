/**
 * Buffer Pool
 *
 * Manages pre-allocated Float32Array buffers to ensure Zero-Allocation.
 * Supports reclamation to avoid detached ArrayBuffer crashes when using
 * Transferable Objects.
 */

export class BufferPool {
  private bufferA: Float32Array;
  private bufferB: Float32Array;
  private isUsingA = true;

  constructor(size: number) {
    this.bufferA = new Float32Array(size);
    this.bufferB = new Float32Array(size);
  }

  /**
   * Returns the current buffer to be filled by the producer.
   */
  getAvailableBuffer(): Float32Array {
    return this.isUsingA ? this.bufferA : this.bufferB;
  }

  /**
   * Reclaims a buffer returned from a consumer (e.g., Web Worker).
   * Essential when using Transferable Objects which detach the original buffer.
   */
  reclaim(buffer: Float32Array): void {
    // Determine which buffer is being returned and update local reference
    // Since the original reference is detached, we must replace it.
    if (this.isUsingA) {
      // If we are currently filling A, the returned buffer must be the previous B
      this.bufferB = buffer;
    } else {
      this.bufferA = buffer;
    }
  }

  /**
   * Switches the active buffer.
   */
  switch(): void {
    this.isUsingA = !this.isUsingA;
  }

  getBufferA(): Float32Array {
    return this.bufferA;
  }

  getBufferB(): Float32Array {
    return this.bufferB;
  }
}
