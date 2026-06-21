import { describe, it, expect } from 'vitest'
import { makeHertz, makeCents, makeMidiNote } from './musical-domain'
import { AppError } from '../errors/app-error'

describe('Musical Domain Nominal Types', () => {
  describe('makeHertz', () => {
    it('should create a valid Hertz value', () => {
      const hertz = makeHertz(440)
      expect(hertz).toBe(440)
    })

    it('should throw AppError for negative frequency', () => {
      expect(() => makeHertz(-1)).toThrow(AppError)
      expect(() => makeHertz(-1)).toThrow(/Invalid Hertz value/)
    })

    it('should throw AppError for non-finite frequency', () => {
      expect(() => makeHertz(Infinity)).toThrow(AppError)
      expect(() => makeHertz(NaN)).toThrow(AppError)
    })
  })

  describe('makeCents', () => {
    it('should create a valid Cents value', () => {
      const cents = makeCents(50)
      expect(cents).toBe(50)
    })

    it('should allow negative cents (desafinado grave)', () => {
      const cents = makeCents(-10.5)
      expect(cents).toBe(-10.5)
    })

    it('should throw AppError for non-finite cents', () => {
      expect(() => makeCents(Infinity)).toThrow(AppError)
    })
  })

  describe('makeMidiNote', () => {
    it('should create a valid MidiNote value', () => {
      const midi = makeMidiNote(69)
      expect(midi).toBe(69)
    })

    it('should throw AppError for values out of range', () => {
      expect(() => makeMidiNote(-1)).toThrow(AppError)
      expect(() => makeMidiNote(128)).toThrow(AppError)
    })

    it('should throw AppError for non-finite midi note', () => {
      expect(() => makeMidiNote(NaN)).toThrow(AppError)
    })
  })
})
