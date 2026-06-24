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
    if (!input || input.length === 0) return true;

    const channelData = input[0];
    const bufferSize = this._bufferSize;
    const buffer = this._buffer;
    const detector = this._detector;

    for (let i = 0; i < channelData.length; i++) {
      buffer[this._ptr++] = channelData[i];

      if (this._ptr >= bufferSize) {
        if (detector && globalThis.Meyda) {
          // 1. Spectral Analysis (First pass for Noise Gate)
          // We accept one object allocation per 2048 samples (~46ms) as it's within library constraints
          const features = globalThis.Meyda.extract(MEYDA_FEATURES, buffer);
          const rms = features?.rms || 0;

          let pitchHz = 0;
          let confidence = 0;

          // 2. Conditional Pitch Detection (Internal Noise Gate)
          // Only run heavy pitch detection if there's significant signal
          if (rms > 0.01) {
            const pitchResult = detector.findPitch(buffer, this._sampleRate);
            pitchHz = pitchResult[0] || 0;
            confidence = pitchResult[1] || 0;
          }

          // 3. Update shared result (Zero-Allocation)
          const res = this._result;
          res.pitchHz = pitchHz;
          res.confidence = confidence;
          res.rms = rms;
          res.spectralFlatness = features?.spectralFlatness || 0;
          res.spectralCentroid = features?.spectralCentroid || 0;
          res.timestamp = currentTime;

          // 4. Post results to main thread
          this.port.postMessage(res);
        }

        this._ptr = 0;
      }
    }
    return true;
  }
}

registerProcessor('capture-processor', CaptureProcessor);
