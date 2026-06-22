/**
 * PitchWorker
 *
 * High-performance Web Worker for real-time pitch detection.
 * Uses AMDF and centralized algorithms with Zero-Allocation patterns.
 */

/* eslint-disable no-restricted-globals */
import { calculateRMS, detectPitchAMDF } from '../../lib/domain/pitch-algorithms';

// Pre-allocated buffers for zero-allocation loop
const MAX_SAMPLE_RATE = 192000;
const MIN_FREQ = 180;
const MAX_PERIOD = Math.ceil(MAX_SAMPLE_RATE / MIN_FREQ);
const differencesBuffer = new Float32Array(MAX_PERIOD + 2);

self.onmessage = (event: MessageEvent) => {
  const { buffer, sampleRate } = event.data as { buffer: Float32Array; sampleRate: number };

  if (!buffer || !sampleRate) return;

  const rms = calculateRMS(buffer);
  const NOISE_GATE_THRESHOLD = 0.005;

  let result;
  if (rms < NOISE_GATE_THRESHOLD) {
    result = { frequency: 0, confidence: 0, rms };
  } else {
    result = detectPitchAMDF(buffer, sampleRate, rms, differencesBuffer);
  }

  // Return the result and the buffer to the main thread via Transferable Objects
  (self as any).postMessage({ result, buffer }, [buffer.buffer]);
};
