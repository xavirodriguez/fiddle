import { describe, expect,it } from 'vitest'

import { AppError } from '../errors/app-error'
import {
  frequencyToMidi,
  frequencyToMidiRaw,
  type Hertz,
  makeCents,
  makeHertz,
  makeMidiNote,
  type MidiNote,
  midiToFrequency,
} from './musical-domain'

describe('Musical Domain Nominal Types', () => {
  describe('makeHertz', () => {
    it('should create a valid Hertz value', () => {
      const result = makeHertz(440)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBe(440)
      }
    })

    it('should return error for negative frequency', () => {
      const result = makeHertz(-1)
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(AppError)
        expect(result.error.message).toMatch(/Invalid Hertz value/)
      }
    })

    it('should return error for non-finite frequency', () => {
      expect(makeHertz(Infinity).isErr()).toBe(true)
      expect(makeHertz(NaN).isErr()).toBe(true)
    })
  })

  describe('makeCents', () => {
    it('should create a valid Cents value', () => {
      const result = makeCents(50)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBe(50)
      }
    })

    it('should allow negative cents (desafinado grave)', () => {
      const result = makeCents(-10.5)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBe(-10.5)
      }
    })

    it('should return error for non-finite cents', () => {
      expect(makeCents(Infinity).isErr()).toBe(true)
    })
  })

  describe('makeMidiNote', () => {
    it('should create a valid MidiNote value', () => {
      const result = makeMidiNote(69)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBe(69)
      }
    })

    it('should convert 440Hz to MIDI 69 using frequencyToMidiRaw (zero-allocation)', () => {
      const result = frequencyToMidiRaw(440 as Hertz)
      expect(result).toBe(69)
    })

    it('should return error for values out of range', () => {
      expect(makeMidiNote(-1).isErr()).toBe(true)
      expect(makeMidiNote(128).isErr()).toBe(true)
    })

    it('should return error for non-finite midi note', () => {
      expect(makeMidiNote(NaN).isErr()).toBe(true)
    })
  })

  describe('Mathematical Converters', () => {
    it('should convert 440Hz to MIDI 69 with default config', () => {
      const result = frequencyToMidi(440 as Hertz)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBe(69)
      }
    })

    it('should convert MIDI 69 to 440Hz with default config', () => {
      const result = midiToFrequency(69 as MidiNote)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBe(440)
      }
    })

    it('should handle custom A4 calibration (e.g., 442Hz)', () => {
      const config = { a4Frequency: 442 as Hertz }
      const resultMidi = frequencyToMidi(442 as Hertz, config)
      expect(resultMidi.isOk()).toBe(true)
      if (resultMidi.isOk()) {
        expect(resultMidi.value).toBe(69)
      }

      const resultFreq = midiToFrequency(69 as MidiNote, config)
      expect(resultFreq.isOk()).toBe(true)
      if (resultFreq.isOk()) {
        expect(resultFreq.value).toBe(442)
      }
    })

    it('should be bi-directional', () => {
      const originalFreq = 261.63 as Hertz // C4 approx
      const resultMidi = frequencyToMidi(originalFreq)
      expect(resultMidi.isOk()).toBe(true)
      if (resultMidi.isOk()) {
        const resultFreq = midiToFrequency(resultMidi.value)
        expect(resultFreq.isOk()).toBe(true)
        if (resultFreq.isOk()) {
          expect(resultFreq.value).toBeCloseTo(originalFreq, 5)
        }
      }
    })

    it('should return error when converting zero frequency to MIDI', () => {
      const result = frequencyToMidi(0 as Hertz)
      expect(result.isErr()).toBe(true)
    })

    it('should accurately convert G3 (violin open string) frequency to MIDI', () => {
      const g3Freq = 196.0 as Hertz
      const result = frequencyToMidi(g3Freq)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBeCloseTo(55, 1) // G3 is MIDI 55
      }
    })

    it('should accurately convert E7 (violin high harmonic) frequency to MIDI', () => {
      const e7Freq = 2637.02 as Hertz
      const result = frequencyToMidi(e7Freq)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBeCloseTo(100, 2) // E7 is MIDI 100
      }
    })

    it('should calculate microtonal cents deviation with 4 decimal precision', () => {
      // 440Hz is A4 (MIDI 69.0)
      // 441Hz calculation: 1200 * log2(441/440) ≈ 3.9302
      const freq = 441 as Hertz
      const result = frequencyToMidi(freq)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const cents = (result.value - 69) * 100
        expect(cents).toBeCloseTo(3.9302, 4)
      }
    })

    it('should calculate negative cents deviation for flat notes', () => {
      // 440Hz is A4 (MIDI 69.0)
      // 439Hz calculation: 1200 * log2(439/440) ≈ -3.9391
      const freq = 439 as Hertz
      const result = frequencyToMidi(freq)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const cents = (result.value - 69) * 100
        expect(cents).toBeCloseTo(-3.9391, 4)
      }
    })
  })
})
