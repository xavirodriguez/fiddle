/**
 * PitchDetector
 *
 * Wraps the `pitchy` and `meyda` libraries to provide pitch detection and
 * spectral analysis from a Float32Array buffer.
 */
import { PitchDetector as PitchyDetector } from 'pitchy'
import Meyda from 'meyda'

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
   * If not, it returns a slice or zero-padded version.
   * But for performance, we should ideally pass a power-of-2 buffer.
   */
  private getPowerOfTwoBuffer(buffer: Float32Array): Float32Array {
    const n = buffer.length
    if ((n & (n - 1)) === 0 && n !== 0) {
      return buffer
    }
    // Find next power of two
    let po2 = 1
    while (po2 < n) po2 <<= 1
    // If n is not power of 2, we take the largest power of 2 that is LESS than n
    // to avoid allocation of a larger buffer if possible,
    // or just use the constructor's bufferSize if it was intended to be power of 2.
    const lowerPo2 = 1 << (Math.floor(Math.log2(n)))
    return buffer.subarray(0, lowerPo2)
  }

  /**
   * Detects pitch and extracts spectral features.
   * Internal calculations use pre-allocated memory from pitchy/meyda.
   * Reuses SHARED_DETECTION_RESULT to follow Zero-Allocation mandate.
   */
  detect(buffer: Float32Array): PitchDetectionResult {
    const result = this.detector.findPitch(buffer, this.sampleRate);
    const pitchHz = result[0];
    const confidence = result[1];

    // Use Meyda for feature extraction
    const po2Buffer = this.getPowerOfTwoBuffer(buffer);

    // Meyda.extract might return null or unexpected types if input is invalid
    const features = Meyda.extract(['rms', 'spectralFlatness', 'spectralCentroid'], po2Buffer) as Record<string, number | null>;

    const dr = SHARED_DETECTION_RESULT;
    dr.pitchHz = pitchHz ?? 0;
    dr.confidence = confidence ?? 0;
    dr.rms = features?.rms ?? 0;
    dr.spectralFlatness = features?.spectralFlatness ?? 0;
    dr.spectralCentroid = features?.spectralCentroid ?? 0;

    return dr;
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
    // Use Meyda for RMS
    const po2Buffer = this.getPowerOfTwoBuffer(buffer);
    const rms = (Meyda.extract('rms', po2Buffer) as number) ?? 0;

    if (rms < (rmsThreshold || 0.01)) {
      const dr = SHARED_DETECTION_RESULT;
      dr.pitchHz = 0;
      dr.confidence = 0;
      dr.rms = rms;
      dr.spectralFlatness = 0;
      dr.spectralCentroid = 0;
      return dr;
    }

    return this.detect(buffer);
  }
}
