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

    /**
     * Shared results buffer for ultra-efficient postMessage.
     * Index 0: pitchHz
     * Index 1: confidence
     * Index 2: rms
     * Index 3: spectralFlatness
     * Index 4: spectralCentroid
     * Index 5: timestamp
     * @private
     */
    this._sharedArray = new Float64Array(6);

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
          // Meyda forces feature object allocation by design; mitigated by immediate extraction.
          const features = globalThis.Meyda.extract(MEYDA_FEATURES, buffer);
          const rms = features?.rms || 0;

          let pitchHz = 0;
          let confidence = 0;

          // 2. Conditional Pitch Detection (Internal Noise Gate)
          if (rms > 0.01) {
            const pitchResult = detector.findPitch(buffer, this._sampleRate);
            pitchHz = pitchResult[0] || 0;
            confidence = pitchResult[1] || 0;
          }

          // 3. Update shared primitive container
          const arr = this._sharedArray;
          arr[0] = pitchHz;
          arr[1] = confidence;
          arr[2] = rms;
          arr[3] = features?.spectralFlatness || 0;
          arr[4] = features?.spectralCentroid || 0;
          arr[5] = currentTime;

          // 4. Post results to main thread
          // Note: Structured clone is used for this small Float64Array to keep the worklet
          // memory layout stable across frames.
          this.port.postMessage(arr);
        }

        this._ptr = 0;
      }
    }
    return true;
  }
}

registerProcessor('capture-processor', CaptureProcessor);
