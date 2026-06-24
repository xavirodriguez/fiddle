import { PitchDetectorWorkerPort } from '../../ports/audio.port';
import { PitchFrame } from '../../domain/data-structures';
import { Hertz, Cents } from '../../domain/musical-domain';
import { MusicalNote } from '../../practice-core';

/**
 * WorkerPitchDetectorAdapter
 *
 * Implementación de PitchDetectorWorkerPort que gestiona un Web Worker
 * para procesamiento de DSP fuera del hilo principal.
 */
export class WorkerPitchDetectorAdapter implements PitchDetectorWorkerPort {
  private worker: Worker;
  private onResultCallback: ((result: PitchFrame) => void) | null = null;

  constructor(sampleRate: number) {
    // Usamos el constructor de Worker compatible con Next.js/Webpack 5
    this.worker = new Worker(new URL('./pitch.worker.ts', import.meta.url));

    this.worker.onmessage = (event) => {
      const { type, result, timestamp } = event.data;
      if (type === 'result' && this.onResultCallback) {
        // Mapeamos el resultado bruto del detector al dominio (PitchFrame)
        const note = MusicalNote.fromFrequencyShared(result.pitchHz);

        const frame: PitchFrame = {
          frequency: result.pitchHz as Hertz,
          centsDeviation: note.centsDeviation as Cents,
          confidence: result.confidence,
          timestamp: timestamp, // Mantenemos el tiempo original del AudioContext
        };

        this.onResultCallback(frame);
      }
    };

    this.worker.postMessage({ type: 'init', sampleRate });
  }

  /**
   * Envía un buffer al worker utilizando Transferable Objects para zero-copy.
   */
  postBuffer(buffer: Float32Array, timestamp: number): void {
    this.worker.postMessage(
      { type: 'process', buffer, timestamp },
      [buffer.buffer]
    );
  }

  onResult(callback: (result: PitchFrame) => void): void {
    this.onResultCallback = callback;
  }

  terminate(): void {
    this.worker.terminate();
  }
}
