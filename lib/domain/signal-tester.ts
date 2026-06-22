/**
 * Signal Tester Utility
 *
 * Provides synthetic signal generation for validating DSP algorithms
 * and mathematical domain logic.
 */

/**
 * Generates a synthetic violin-like signal.
 *
 * @remarks
 * Combines a fundamental frequency with a second harmonic at double the volume
 * to test robustness against octave doubling.
 *
 * @param fundamentalHz - The fundamental frequency in Hertz.
 * @param sampleRate - The sample rate in Hz (e.g., 44100).
 * @param durationSeconds - Duration of the signal in seconds.
 *
 * @returns A Float32Array containing the normalized signal.
 */
export function generateSyntheticViolinSignal(
  fundamentalHz: number,
  sampleRate: number,
  durationSeconds: number
): Float32Array {
  const numSamples = Math.floor(sampleRate * durationSeconds)
  const buffer = new Float32Array(numSamples)

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate

    // Fundamental: A = 1.0
    const fundamental = Math.sin(2 * Math.PI * fundamentalHz * t)

    // Second Harmonic (Octave): A = 2.0 (as per strict instructions)
    const secondHarmonic = 2.0 * Math.sin(2 * Math.PI * (fundamentalHz * 2) * t)

    // Combine and normalize to [-1.0, 1.0] range
    buffer[i] = (fundamental + secondHarmonic) / 3.0
  }

  return buffer
}
