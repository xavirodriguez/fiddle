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
     * We use a pool of Float64Arrays and Transferable Objects to avoid GC.
     */
    this._bufferPool = [
      new Float64Array(6),
      new Float64Array(6),
      new Float64Array(6),
      new Float64Array(6)
    ];
    this._availableBuffers = [...this._bufferPool];

    this.port.onmessage = (event) => {
      if (event.data.type === 'init') {
        this._sampleRate = event.data.sampleRate;
        this._detector = PitchDetector.forFloat32Array(this._bufferSize);
      } else if (event.data instanceof Float64Array) {
        // Regresar buffer al pool (Task 2.3)
        this._availableBuffers.push(event.data);
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

          // 2. Pitch Detection (Noise Gate - Task 2.3)
          const noiseGateThreshold = 0.01;
          if (rms > noiseGateThreshold) {
            const pitchResult = detector.findPitch(buffer, this._sampleRate);
            pitchHz = pitchResult[0] || 0;
            confidence = pitchResult[1] || 0;
          }

          // 3. Update result container from pool (Task 2.3)
          const output = this._availableBuffers.pop();
          if (output) {
            output[0] = pitchHz;
            output[1] = confidence;
            output[2] = rms;
            output[3] = features?.spectralFlatness || 0;
            output[4] = features?.spectralCentroid || 0;
            output[5] = currentTime;

            // 4. Post results to main thread using Transferable Objects
            this.port.postMessage(output, [output.buffer]);
          }
        }

        this._ptr = 0;
      }
    }
    return true;
  }
}

registerProcessor('capture-processor', CaptureProcessor);
