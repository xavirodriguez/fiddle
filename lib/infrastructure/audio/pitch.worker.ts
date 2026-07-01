/// <reference lib="webworker" />
import { type WorkerInputMessage, type WorkerOutputMessage } from './pitch-worker.types';

/**
 * Calcula el valor RMS (Root Mean Square) de un buffer para la Puerta de Ruido.
 */
function calculateRMS(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

/**
 * Algoritmo de Función de Diferencia de Magnitud Promedio (AMDF).
 */
function calculateAMDFPitch(buffer: Float32Array, sampleRate: number): number {
  const minFreq = 196; // G3
  const maxFreq = 2637; // E7
  const minLag = Math.floor(sampleRate / maxFreq);
  const maxLag = Math.ceil(sampleRate / minFreq);

  let bestLag = -1;
  let minDifference = Infinity;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let difference = 0;
    const limit = buffer.length - lag;

    for (let i = 0; i < limit; i++) {
      difference += Math.abs(buffer[i] - buffer[i + lag]);
    }

    difference /= limit;

    if (difference < minDifference) {
      minDifference = difference;
      bestLag = lag;
    }
  }

  return bestLag > 0 ? sampleRate / bestLag : 0;
}

let currentSampleRate = 44100;

self.onmessage = (event: MessageEvent<WorkerInputMessage>) => {
  const data = event.data;

  if (data.type === 'init') {
    currentSampleRate = data.sampleRate;
    return;
  }

  if (data.type === 'process') {
    const { buffer, timestamp } = data;
    const rms = calculateRMS(buffer);
    const noiseThreshold = 0.01;

    let pitchHz = 0;
    let confidence = 0;

    if (rms > noiseThreshold) {
      pitchHz = calculateAMDFPitch(buffer, currentSampleRate);
      confidence = Math.min(1.0, rms * 10);
    }

    (self as DedicatedWorkerGlobalScope).postMessage({
      type: 'result',
      result: {
        pitchHz,
        confidence,
        rms
      },
      buffer,
      timestamp
    } satisfies WorkerOutputMessage, [buffer.buffer]);
  }
};
