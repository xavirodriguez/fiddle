/**
 * PitchDetector
 *
 * Wraps the `pitchy` and `meyda` libraries to provide pitch detection and
 * spectral analysis from a Float32Array buffer.
 * Optimized for high-frequency use with zero-allocation in the hot path.
 */
import Meyda from 'meyda'
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
  /** Spectral Flatness: measures how noise-like the signal is (0.0 to 1.0). */
  spectralFlatness: number
  /** Spectral Centroid: "brightness" of the sound in Hz. */
  spectralCentroid: number
}

/**
 * Pre-allocated shared object to avoid GC pressure in high-frequency detection loops.
 * @internal
 */
export const SHARED_DETECTION_RESULT: PitchDetectionResult = {
  pitchHz: 0,
  confidence: 0,
  rms: 0,
  spectralFlatness: 0,
  spectralCentroid: 0,
};

/**
 * Detects pitch and spectral features from a PCM audio buffer.
 * Acts as a pure adapter for `pitchy` and `meyda` libraries.
 */
export class PitchDetector {
  private detector: PitchyDetector<Float32Array>
  private readonly sampleRate: number
  private readonly bufferSize: number

  /**
   * @param sampleRate - The sample rate of the audio context (e.g. 44100, 48000).
   * @param bufferSize - Must match the Float32Array length passed to detect.
   *                     For Meyda features, it must be a power of 2.
   */
  constructor(sampleRate: number, bufferSize = 2048) {
    this.sampleRate = sampleRate
    this.bufferSize = bufferSize
    this.detector = PitchyDetector.forFloat32Array(bufferSize)
  }

  /**
   * Helper to ensure buffer is a power of 2 for Meyda.
   */
  private getPowerOfTwoBuffer(buffer: Float32Array): Float32Array {
    const n = buffer.length
    if ((n & (n - 1)) === 0 && n !== 0) {
      return buffer
    }
    const lowerPo2 = 1 << (Math.floor(Math.log2(n)))
    return buffer.subarray(0, lowerPo2)
  }

  /**
   * Detects pitch and extracts spectral features.
   * Internal calculations use pre-allocated memory from pitchy/meyda.
   * Reuses SHARED_DETECTION_RESULT to follow Zero-Allocation mandate.
   */
  detect(buffer: Float32Array): PitchDetectionResult {
    const po2Buffer = this.getPowerOfTwoBuffer(buffer);

    // 1. Extract features with Meyda (One pass)
    const features = Meyda.extract(['rms', 'spectralFlatness', 'spectralCentroid'], po2Buffer) as Record<string, number | null>;
    const rms = features?.rms ?? 0;

    const dr = SHARED_DETECTION_RESULT;
    dr.rms = rms;
    dr.spectralFlatness = features?.spectralFlatness ?? 0;
    dr.spectralCentroid = features?.spectralCentroid ?? 0;

    // 2. Conditional Pitch Detection (Internal Noise Gate)
    if (rms > 0.01) {
      const result = this.detector.findPitch(buffer, this.sampleRate);
      dr.pitchHz = result[0] ?? 0;
      dr.confidence = result[1] ?? 0;
    } else {
      dr.pitchHz = 0;
      dr.confidence = 0;
    }

    return dr;
  }
}
