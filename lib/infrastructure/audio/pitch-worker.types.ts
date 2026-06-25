export interface WorkerInitMessage {
  type: 'init'
  sampleRate: number
  rmsThreshold?: number
}

export interface WorkerProcessMessage {
  type: 'process'
  buffer: Float32Array
  timestamp: number
  rmsThreshold?: number
}

export type WorkerInputMessage = WorkerInitMessage | WorkerProcessMessage

export interface WorkerResultMessage {
  type: 'result'
  result: {
    pitchHz: number
    confidence: number
    rms: number
  }
  buffer: Float32Array
  timestamp: number
}

export type WorkerOutputMessage = WorkerResultMessage
