import { describe, expect, it } from 'vitest';
import { PitchDetector } from '../pitch-detector';
import { generateSyntheticViolinSignal } from './signal-tester';

describe('Signal Math Verification (Violin Octave Stress Test)', () => {
  const sampleRate = 44100;
  const detector = new PitchDetector(sampleRate, 2048);

  it('should detect the correct fundamental even with a stronger second harmonic', () => {
    const fundamentalHz = 220; // A3
    // Phase 3.2: fundamental + 2nd harmonic (double volume)
    const buffer = generateSyntheticViolinSignal(fundamentalHz, sampleRate, 2048 / sampleRate);

    // We only need the first 2048 samples
    const slice = buffer.slice(0, 2048);

    const result = detector.detectPitchWithValidation(slice, 0.01);

    // Tolerance for floating point and algorithm approximation
    expect(result.pitchHz).toBeGreaterThan(fundamentalHz * 0.95);
    expect(result.pitchHz).toBeLessThan(fundamentalHz * 1.05);
  });

  it('should detect a pure 440Hz signal accurately', () => {
    const freq = 440;
    const numSamples = 2048;
    const buffer = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      buffer[i] = Math.sin(2 * Math.PI * freq * (i / sampleRate));
    }

    const result = detector.detectPitchWithValidation(buffer, 0.01);
    expect(result.pitchHz).toBeGreaterThan(freq * 0.98);
    expect(result.pitchHz).toBeLessThan(freq * 1.02);
    expect(result.confidence).toBeGreaterThan(0.9);
  });
});
