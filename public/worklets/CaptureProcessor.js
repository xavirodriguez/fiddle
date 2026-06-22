/**
 * CaptureProcessor
 *
 * High-performance AudioWorkletProcessor for zero-latency audio capture.
 * Runs on a dedicated audio thread to ensure deterministic behavior.
 */

class CaptureProcessor extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      // Note: In a production environment with SharedArrayBuffer, we would write
      // directly to a shared buffer. For this implementation, we use message passing
      // which is standard for AudioWorklets.
      this.port.postMessage(channelData);
    }
    return true;
  }
}

registerProcessor('capture-processor', CaptureProcessor);
