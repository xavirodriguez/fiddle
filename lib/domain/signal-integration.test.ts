import { describe, it, expect } from 'vitest'
import { generateSyntheticViolinSignal } from './signal-tester'
import { PitchDetector } from '../pitch-detector'

describe('Signal Integration QA', () => {
  it('should detect the correct frequency from a complex synthetic violin signal (A4)', () => {
    const fundamentalHz = 440 // A4
    const sampleRate = 44100
    const duration = 0.2 // Slightly longer for pitchy

    const signal = generateSyntheticViolinSignal(fundamentalHz, sampleRate, duration)
    const detector = new PitchDetector(sampleRate, signal.length)
    const result = detector.detectPitchWithValidation(signal, 0.001)

    expect(Math.abs(result.pitchHz - fundamentalHz)).toBeLessThan(1.0)
    expect(result.confidence).toBeGreaterThan(0.85)
  })

  it('should handle different violin frequencies (G3 to E7)', () => {
    const sampleRate = 44100
    const duration = 0.2

    const testCases = [
      { name: 'G3', freq: 196.0 },
      { name: 'D4', freq: 293.66 },
      { name: 'A4', freq: 440.0 },
      { name: 'E5', freq: 659.25 },
      { name: 'E7', freq: 2637.02 }
    ]

    for (const test of testCases) {
      const signal = generateSyntheticViolinSignal(test.freq, sampleRate, duration)
      const detector = new PitchDetector(sampleRate, signal.length)
      const result = detector.detectPitchWithValidation(signal, 0.001)

      const percentError = Math.abs(result.pitchHz - test.freq) / test.freq
      const tolerance = test.name === 'E7' ? 0.02 : 0.01
      expect(percentError, `Failed for ${test.name}: expected ${test.freq}, got ${result.pitchHz}`).toBeLessThan(tolerance)
    }
  })
})
