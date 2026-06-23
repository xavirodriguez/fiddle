/**
 * CaptureProcessor
 *
 * High-performance AudioWorkletProcessor for zero-latency audio capture and analysis.
 * Runs on a dedicated audio thread.
 */

import { PitchDetector } from './pitchy.js';
import './meyda.js'; // Meyda attaches to global scope

class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._bufferSize = 2048;
    this._buffer = new Float32Array(this._bufferSize);
    this._ptr = 0;

    // We'll initialize these when we get the sample rate
    this._detector = null;
    this._sampleRate = 44100; // Default, will be updated

    // Pre-allocated result object for zero-allocation
    this._result = {
      pitchHz: 0,
      confidence: 0,
      rms: 0,
      spectralFlatness: 0,
      spectralCentroid: 0,
      timestamp: 0
    };

    this.port.onmessage = (event) => {
      if (event.data.type === 'init') {
        this._sampleRate = event.data.sampleRate;
        this._detector = PitchDetector.forFloat32Array(this._bufferSize);
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];

      for (let i = 0; i < channelData.length; i++) {
        this._buffer[this._ptr++] = channelData[i];

        if (this._ptr >= this._bufferSize) {
          if (this._detector && globalThis.Meyda) {
            // 1. Pitch Detection
            const [pitchHz, confidence] = this._detector.findPitch(this._buffer, this._sampleRate);

            // 2. Spectral Analysis via Meyda
            const features = globalThis.Meyda.extract(['rms', 'spectralFlatness', 'spectralCentroid'], this._buffer);

            // 3. Update shared result
            this._result.pitchHz = pitchHz || 0;
            this._result.confidence = confidence || 0;
            this._result.rms = features.rms || 0;
            this._result.spectralFlatness = features.spectralFlatness || 0;
            this._result.spectralCentroid = features.spectralCentroid || 0;
            this._result.timestamp = currentTime;

            // 4. Post results to main thread
            this.port.postMessage(this._result);
          }

          this._ptr = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('capture-processor', CaptureProcessor);
