import { describe, it, expect } from 'vitest'
import { generateSyntheticViolinSignal } from './signal-tester'
import { calculateRMS, detectPitchAMDF } from './pitch-algorithms'

describe('Signal Integration QA', () => {
  // Shared diffs buffer for tests (Zero-Allocation simulation)
  const diffsBuffer = new Float32Array(20000)

  it('should detect the correct frequency from a complex synthetic violin signal (A4)', () => {
    const fundamentalHz = 440 // A4
    const sampleRate = 44100
    const duration = 0.1

    const signal = generateSyntheticViolinSignal(fundamentalHz, sampleRate, duration)
    const rms = calculateRMS(signal)
    const { frequency, confidence } = detectPitchAMDF(signal, sampleRate, rms, diffsBuffer)

    expect(Math.abs(frequency - fundamentalHz)).toBeLessThan(1.0)
    expect(confidence).toBeGreaterThan(0.85)
  })

  it('should handle different violin frequencies (G3 to E7)', () => {
    const sampleRate = 44100
    const duration = 0.1

    const testCases = [
      { name: 'G3', freq: 196.0 },
      { name: 'D4', freq: 293.66 },
      { name: 'A4', freq: 440.0 },
      { name: 'E5', freq: 659.25 },
      { name: 'E7', freq: 2637.02 }
    ]

    for (const test of testCases) {
      const signal = generateSyntheticViolinSignal(test.freq, sampleRate, duration)
      const rms = calculateRMS(signal)
      const { frequency } = detectPitchAMDF(signal, sampleRate, rms, diffsBuffer)

      const percentError = Math.abs(frequency - test.freq) / test.freq
      const tolerance = test.name === 'E7' ? 0.02 : 0.01
      expect(percentError, `Failed for ${test.name}: expected ${test.freq}, got ${frequency}`).toBeLessThan(tolerance)
    }
  })
})
