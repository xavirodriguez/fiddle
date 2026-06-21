import { PitchDetectionResult } from '../pitch-detector'

/**
 * Port for retrieving raw audio frames from an input source.
 *
 * @remarks
 * This interface abstracts the source of audio data (e.g., Web Audio AnalyserNode,
 * File API, or synthetic generators), facilitating testing and platform independence.
 *
 * **Concurrency Note**: Implementations must ensure that `getFrame()` is reentrant-safe
 * or explicitly documented as single-threaded if used in a Web Worker context.
 *
 * @public
 */
export interface AudioFramePort {
  /**
   * Captures and retrieves the next available frame of audio data.
   *
   * @remarks
   * **Side Effects**: This method typically performs a side-effect by reading
   * from a live hardware buffer (e.g., via `getFloatTimeDomainData`).
   *
   * **Performance & Memory**:
   * For performance reasons, many implementations (like {@link WebAudioFrameAdapter})
   * will return a reference to a pre-allocated internal buffer. Consumers should
   * **not** mutate this buffer and should copy the data (e.g., via `.slice()`)
   * if it needs to be persisted across multiple frames.
   *
   * **Signal Characteristics**:
   * The returned buffer contains PCM samples as 32-bit floats, typically
   * normalized in the range `[-1.0, 1.0]`.
   *
   * @returns A {@link Float32Array} of PCM samples.
   */
  captureFrame(): Float32Array

  /**
   * The sample rate of the audio stream in Hz (e.g., 44100).
   *
   * @remarks
   * This value is critical for accurate pitch detection algorithms that rely on
   * time-frequency transformations. It is assumed to be constant for the duration
   * of the port's lifecycle.
   */
  readonly sampleRate: number
}

/**
 * Port for pitch detection and signal analysis.
 *
 * @remarks
 * Encapsulates the logic for extracting musical information from raw audio frames.
 *
 * **Statelessness**:
 * Implementations should ideally be stateless or handle internal state such that
 * detections are consistent and re-entrant.
 *
 * @public
 */
export interface PitchDetectionPort {
  /**
   * Detects the pitch and confidence of a given audio frame.
   *
   * @remarks
   * **Performance**:
   * The detection algorithm's complexity (e.g., YIN, McLeod, FFT-based) determines
   * the latency of this call. High-frequency pipelines (e.g., 60Hz) should
   * monitor execution time to avoid dropping frames or causing UI stutter.
   *
   * **Error Handling & Gating**:
   * This method should not throw. If detection fails or the signal is too weak,
   * it should return a result with `confidence: 0` and `pitchHz: 0` (or `NaN`).
   *
   * @param frame - The raw PCM audio samples to analyze.
   * @returns A {@link PitchDetectionResult} containing frequency (Hz) and confidence level (0.0 to 1.0).
   */
  detect(frame: Float32Array): PitchDetectionResult

  /**
   * Calculates the Root Mean Square (RMS) of the frame, representing its volume/intensity.
   *
   * @remarks
   * RMS provides a more stable representation of perceived loudness than peak amplitude.
   * Useful for noise gating and onset detection.
   *
   * @param frame - The raw audio samples.
   * @returns The calculated RMS value, normalized between 0.0 (silence) and 1.0 (full scale).
   */
  calculateRMS(frame: Float32Array): number

  /**
   * Normalizes an audio buffer so that its peak amplitude is 1.0.
   *
   * @param buffer - The raw audio data.
   * @returns A new Float32Array with normalized samples.
   */
  normalize?(buffer: Float32Array): Float32Array
}

/**
 * Port for managing an asynchronous audio processing loop.
 *
 * @remarks
 * Standardizes the execution of real-time audio analysis. This port replaces manual
 * `requestAnimationFrame` or `setInterval` with a managed lifecycle that
 * respects an {@link AbortSignal}.
 *
 * @public
 */
export interface AudioLoopPort {
  /**
   * Starts the high-frequency audio processing loop.
   *
   * @remarks
   * The loop execution is tied to the provided `signal`. Once the signal is aborted,
   * the loop must terminate promptly and resolve the returned promise.
   *
   * @param onFrame - A callback executed for each new frame delivered by the hardware/source.
   * @param signal - An {@link AbortSignal} to gracefully terminate the loop.
   * @returns A promise that resolves when the loop has stopped.
   *
   * @example
   * ```ts
   * const controller = new AbortController();
   * await loopPort.start((frame) => {
   *   const result = detector.detect(frame);
   *   if (result.confidence > 0.9) {
   *     console.log(`Frequency: ${result.pitchHz.toFixed(1)} Hz`);
   *   }
   * }, controller.signal);
   * ```
   *
   * @throws Error - If the loop fails to start or encounters a fatal hardware error.
   */
  start(onFrame: (frame: Float32Array) => void, signal: AbortSignal): Promise<void>
}
