import { type PitchFrame } from '../../domain/data-structures'
import { type Cents,type Hertz } from '../../domain/musical-domain'
import { type PitchDetectorWorkerPort } from '../../ports/audio.port'
import { MusicalNote } from '../../practice-core'
import type { WorkerInputMessage, WorkerOutputMessage } from './pitch-worker.types'

/**
 * WorkerPitchDetectorAdapter
 *
 * Implementación de PitchDetectorWorkerPort que gestiona un Web Worker
 * para procesamiento de DSP fuera del hilo principal.
 */
export class WorkerPitchDetectorAdapter implements PitchDetectorWorkerPort {
  private worker: Worker
  private onResultCallback: ((result: PitchFrame) => void) | null = null

  constructor(sampleRate: number) {
    // Usamos el constructor de Worker compatible con Next.js/Webpack 5
    this.worker = new Worker(new URL('./pitch.worker.ts', import.meta.url))

    this.worker.onmessage = (event: MessageEvent<WorkerOutputMessage>) => {
      const data = event.data
      if (data.type === 'result' && this.onResultCallback) {
        // Mapeamos el resultado bruto del detector al dominio (PitchFrame)
        const note = MusicalNote.fromFrequencyShared(data.result.pitchHz)

        const frame: PitchFrame = {
          frequency: data.result.pitchHz as Hertz,
          centsDeviation: note.centsDeviation as Cents,
          confidence: data.result.confidence,
          timestamp: data.timestamp, // Mantenemos el tiempo original del AudioContext
        }

        this.onResultCallback(frame)
      }
    }

    this.worker.postMessage({ type: 'init', sampleRate } satisfies WorkerInputMessage)
  }

  /**
   * Envía un buffer al worker utilizando Transferable Objects para zero-copy.
   */
  postBuffer(buffer: Float32Array, timestamp: number): void {
    this.worker.postMessage(
      { type: 'process', buffer, timestamp } satisfies WorkerInputMessage,
      [buffer.buffer]
    )
  }

  onResult(callback: (result: PitchFrame) => void): void {
    this.onResultCallback = callback;
  }

  terminate(): void {
    this.worker.terminate();
  }
}
