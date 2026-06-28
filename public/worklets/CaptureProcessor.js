/**
 * CaptureProcessor
 *
 * High-performance AudioWorkletProcessor for zero-latency audio capture and analysis.
 * Runs on a dedicated audio thread.
 */

import { PitchDetector } from './pitchy.js';
import './meyda.js'; // Meyda attaches to global scope

const MEYDA_FEATURES = ['rms', 'spectralFlatness', 'spectralCentroid'];

class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._bufferSize = 2048;
    this._buffer = new Float32Array(this._bufferSize);
    this._ptr = 0;

    this._detector = null;
    this._sampleRate = 44100;

    /**
     * Buffer Pool for Zero-Allocation messaging.
     * We use a small pool of Float64Arrays to avoid per-frame allocation
     * while still supporting Transferable Objects.
     */
    this._bufferPool = [
      new Float64Array(6),
      new Float64Array(6),
      new Float64Array(6)
    ];
    this._poolIdx = 0;

    this.port.onmessage = (event) => {
      if (event.data.type === 'init') {
        this._sampleRate = event.data.sampleRate;
        this._detector = PitchDetector.forFloat32Array(this._bufferSize);
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channelData = input[0];
    const bufferSize = this._bufferSize;
    const buffer = this._buffer;
    const detector = this._detector;

    for (let i = 0; i < channelData.length; i++) {
      buffer[this._ptr++] = channelData[i];

      if (this._ptr >= bufferSize) {
        if (detector && globalThis.Meyda) {
          // 1. Spectral Analysis
          const features = globalThis.Meyda.extract(MEYDA_FEATURES, buffer);
          const rms = features?.rms || 0;

          let pitchHz = 0;
          let confidence = 0;

          // 2. Pitch Detection (Noise Gate)
          if (rms > 0.01) {
            const pitchResult = detector.findPitch(buffer, this._sampleRate);
            pitchHz = pitchResult[0] || 0;
            confidence = pitchResult[1] || 0;
          }

          // 3. Update result container from pool
          const output = this._bufferPool[this._poolIdx];
          output[0] = pitchHz;
          output[1] = confidence;
          output[2] = rms;
          output[3] = features?.spectralFlatness || 0;
          output[4] = features?.spectralCentroid || 0;
          output[5] = currentTime;

          // 4. Post results to main thread using Transferable Objects
          // Note: We don't transfer the buffer for such small data (6 floats)
          // because it requires re-allocating in the pool every frame,
          // violating Zero-Allocation. Structured clone is faster for this size.
          this.port.postMessage(output);
          this._poolIdx = (this._poolIdx + 1) % this._bufferPool.length;
        }

        this._ptr = 0;
      }
    }
    return true;
  }
}

registerProcessor('capture-processor', CaptureProcessor);
