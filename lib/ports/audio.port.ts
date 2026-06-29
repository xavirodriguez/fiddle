import { type Result } from 'neverthrow'

import { type RawPitchEvent } from '../audio/audio-pipeline'
import { type AppError } from '../errors/app-error'

/**
 * Event types for audio hardware changes.
 */
export type AudioDeviceEvent = 'devicechange' | 'error' | 'statechange'

/**
 * Port for hardware audio capture management.
 */
export interface AudioCapturePort {
  /**
   * Initializes the audio context and requests microphone permissions.
   */
  initialize(): Promise<Result<void, AppError>>

  /**
   * Starts capturing audio and streaming it to the processing pipeline.
   * @param onFrame - Callback for each captured audio detection event (Raw Float64Array for performance).
   */
  startStream(onFrame: (data: Float64Array) => void): Promise<Result<void, AppError>>

  /**
   * Stops the current audio stream and releases hardware resources.
   */
  stopStream(): Promise<void>

  /**
   * Subscribes to hardware or stream events.
   */
  on(event: AudioDeviceEvent, callback: (data?: unknown) => void): void

  /**
   * The current sample rate of the hardware.
   */
  readonly sampleRate: number

  /**
   * Returns the current time of the audio master clock.
   */
  getCurrentTime(): number
}

/**
 * Port for asynchronous pitch detection communication (Web Worker).
 */
export interface PitchDetectorWorkerPort {
  /**
   * Sends a buffer to the worker for analysis.
   * Uses Transferable Objects for zero-copy performance.
   * @param buffer - The audio buffer to process.
   * @param timestamp - The AudioContext timestamp when this buffer was captured.
   */
  postBuffer(buffer: Float32Array, timestamp: number): void

  /**
   * Registers a callback for when the worker completes an analysis.
   */
  onResult(callback: (result: RawPitchEvent) => void): void

  /**
   * Terminates the worker.
   */
  terminate(): void
}
