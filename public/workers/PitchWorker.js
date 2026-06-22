/**
 * PitchWorker
 *
 * High-performance Web Worker for real-time pitch detection.
 * Uses AMDF and centralized algorithms with Zero-Allocation patterns.
 */

/* eslint-disable no-restricted-globals */

/**
 * Calculates Root Mean Square (RMS) for noise gating.
 */
function calculateRMS(buffer) {
  let sum = 0;
  const len = buffer.length;
  for (let i = 0; i < len; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / len);
}

/**
 * AMDF (Average Magnitude Difference Function) Implementation.
 */
function detectPitchAMDF(buffer, sampleRate, rms, diffsBuffer) {
  const minFreq = 180;
  const maxFreq = 2800;
  const minPeriod = Math.floor(sampleRate / maxFreq);
  const maxPeriod = Math.ceil(sampleRate / minFreq);
  const windowSize = Math.floor(buffer.length / 2);
  let globalMinDiff = Infinity;

  for (let tau = minPeriod; tau <= maxPeriod; tau++) {
    let diff = 0;
    for (let j = 0; j < windowSize; j++) {
      diff += Math.abs(buffer[j] - buffer[j + tau]);
    }
    diffsBuffer[tau] = diff / windowSize;
    if (diffsBuffer[tau] < globalMinDiff) {
      globalMinDiff = diffsBuffer[tau];
    }
  }

  const absoluteThreshold = rms * 0.2;
  let bestPeriod = 0;
  for (let tau = minPeriod + 1; tau < maxPeriod; tau++) {
    if (diffsBuffer[tau] < diffsBuffer[tau - 1] && diffsBuffer[tau] < diffsBuffer[tau + 1]) {
      if (diffsBuffer[tau] < absoluteThreshold) {
        bestPeriod = tau;
        break;
      }
    }
  }

  if (bestPeriod === 0) {
    let minD = Infinity;
    for (let tau = minPeriod; tau <= maxPeriod; tau++) {
      if (diffsBuffer[tau] < minD) {
        minD = diffsBuffer[tau];
        bestPeriod = tau;
      }
    }
  }

  if (bestPeriod === 0) return { frequency: 0, confidence: 0, rms };

  let refinedPeriod = bestPeriod;
  if (bestPeriod > minPeriod && bestPeriod < maxPeriod) {
    const y0 = diffsBuffer[bestPeriod - 1];
    const y1 = diffsBuffer[bestPeriod];
    const y2 = diffsBuffer[bestPeriod + 1];
    const denominator = 2 * (2 * y1 - y2 - y0);
    if (Math.abs(denominator) > 0.000001) {
      const peak = (y2 - y0) / denominator;
      refinedPeriod += peak;
    }
  }

  const frequency = sampleRate / refinedPeriod;
  const confidence = Math.max(0, 1.0 - (diffsBuffer[bestPeriod] / (rms * 2 + 0.000001)));

  return {
    frequency,
    confidence: isNaN(confidence) ? 0 : Math.min(1.0, confidence),
    rms
  };
}

// Pre-allocated buffers
const MAX_SAMPLE_RATE = 192000;
const MIN_FREQ_CONST = 180;
const MAX_PERIOD_CONST = Math.ceil(MAX_SAMPLE_RATE / MIN_FREQ_CONST);
const differencesBuffer = new Float32Array(MAX_PERIOD_CONST + 2);

self.onmessage = (event) => {
  const { buffer, sampleRate } = event.data;
  if (!buffer || !sampleRate) return;

  const rms = calculateRMS(buffer);
  const NOISE_GATE_THRESHOLD = 0.005;

  let result;
  if (rms < NOISE_GATE_THRESHOLD) {
    result = { frequency: 0, confidence: 0, rms };
  } else {
    result = detectPitchAMDF(buffer, sampleRate, rms, differencesBuffer);
  }

  self.postMessage({ result, buffer }, [buffer.buffer]);
};
