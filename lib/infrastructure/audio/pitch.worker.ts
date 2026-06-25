import { PitchDetector } from '../../pitch-detector'
import type { WorkerInputMessage, WorkerOutputMessage } from './pitch-worker.types'

let detector: PitchDetector | null = null

self.onmessage = (event: MessageEvent<WorkerInputMessage>) => {
  const data = event.data

  if (data.type === 'init') {
    detector = new PitchDetector(data.sampleRate)
    return
  }

  if (data.type === 'process' && detector && data.buffer) {
    const result = detector.detectPitchWithValidation(data.buffer, data.rmsThreshold ?? 0.01)

    // Devolvemos el resultado y el buffer (transferido de vuelta para reuso)
    // Incluimos el timestamp original para mantener la sincronización musical
    ;(self as unknown as { postMessage: (message: any, transfer: Transferable[]) => void }).postMessage(
      {
        type: 'result',
        result,
        buffer: data.buffer,
        timestamp: data.timestamp,
      } satisfies WorkerOutputMessage,
      [data.buffer.buffer]
    )
  }
}
