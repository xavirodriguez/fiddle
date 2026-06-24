/**
 * PitchWorker.ts
 *
 * Web Worker para el procesamiento de tono concurrente.
 * Utiliza Transferable Objects para paso de buffers a 60 FPS sin GC.
 * Implementa una Puerta de Ruido (RMS) y el algoritmo AMDF simplificado.
 */

interface WorkerInput {
  buffer: Float32Array;
  sampleRate: number;
  timestamp: number;
}

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

self.onmessage = (event: MessageEvent<WorkerInput>) => {
  const { buffer, sampleRate, timestamp } = event.data;

  if (!buffer) return;

  // 1. Puerta de Ruido (RMS Threshold)
  const rms = calculateRMS(buffer);
  const noiseThreshold = 0.01;

  let frequency = 0;
  let confidence = 0;

  if (rms > noiseThreshold) {
    // 2. Cálculo de Tono mediante AMDF
    frequency = calculateAMDFPitch(buffer, sampleRate);
    confidence = Math.min(1.0, rms * 10);
  }

  // Enviar resultado de vuelta
  // Se devuelve el buffer como Transferable para mantener la política de Zero-Allocation
  // permitiendo que el hilo principal lo reutilice sin nuevas asignaciones.
  (self as any).postMessage({
    result: {
      frequency,
      confidence,
      timestamp
    },
    buffer
  }, [buffer.buffer]);
};
