/**
 * PitchDetector
 *
 * Wraps the `pitchy` library to provide pitch detection from a Float32Array buffer.
 * This is the infrastructure implementation of the PitchDetectionPort.
 */
import { PitchDetector as PitchyDetector } from 'pitchy'

/**
 * The result of a single pitch detection analysis.
 */
export interface PitchDetectionResult {
  /** Detected frequency in Hz. 0 if no pitch found or confidence too low. */
  pitchHz: number
  /** Confidence score from 0.0 to 1.0. */
  confidence: number
  /** Root Mean Square of the buffer — proxy for signal volume. */
  rms: number
}

/**
 * Detects pitch from a PCM audio buffer using the McLeod Pitch Method (MPM)
 * via the `pitchy` library.
 */
export class PitchDetector {
  private detector: PitchyDetector<Float32Array>
  private readonly sampleRate: number

  /**
   * @param sampleRate - The sample rate of the audio context (e.g. 44100, 48000).
   * @param bufferSize - Must match the Float32Array length passed to detect/detectPitchWithValidation.
   */
  constructor(sampleRate: number, bufferSize = 2048) {
    this.sampleRate = sampleRate
    this.detector = PitchyDetector.forFloat32Array(bufferSize)
  }

  /**
   * Calculates the Root Mean Square (RMS) of a buffer — used as a volume proxy.
   * Zero-allocation: operates directly on the provided buffer.
   */
  calculateRMS(buffer: Float32Array): number {
    let sum = 0
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i]
    }
    return Math.sqrt(sum / buffer.length)
  }

  /**
   * Detects pitch without any confidence/RMS gating.
   * Returns raw values from pitchy.
   */
  detect(buffer: Float32Array): PitchDetectionResult {
    const [pitchHz, confidence] = this.detector.findPitch(buffer, this.sampleRate)
    return {
      pitchHz: pitchHz ?? 0,
      confidence: confidence ?? 0,
      rms: this.calculateRMS(buffer),
    }
  }

  /**
   * Detects pitch with an RMS noise gate.
   * Returns pitchHz = 0 and confidence = 0 when signal is below `rmsThreshold`.
   *
   * @param buffer - PCM audio samples.
   * @param rmsThreshold - Minimum RMS value to attempt detection (default 0.01).
   */
  detectPitchWithValidation(
    buffer: Float32Array,
    rmsThreshold = 0.01,
  ): PitchDetectionResult {
    const rms = this.calculateRMS(buffer)

    if (rms < rmsThreshold) {
      return { pitchHz: 0, confidence: 0, rms }
    }

    const [pitchHz, confidence] = this.detector.findPitch(buffer, this.sampleRate)
    return {
      pitchHz: pitchHz ?? 0,
      confidence: confidence ?? 0,
      rms,
    }
  }
}
