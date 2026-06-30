import type { Subscription } from 'rxjs'
import { type StateCreator } from 'zustand'

import type { PitchFrame } from '@/lib/domain/data-structures'
import { type Cents, type Hertz, frequencyToMidiRaw } from '@/lib/domain/musical-domain'

export interface TunerSlice {
  frequency: Hertz
  cents: Cents
  confidence: number
  timestamp: number
  active: boolean
  error: string | null
  start: () => void
  stop: () => void
  updatePitch: (frequencyHz: number, confidence: number) => void
}

const _frame = {
  frequency: 0 as Hertz,
  cents: 0 as Cents,
  confidence: 0,
  timestamp: 0,
}

export const createTunerSlice: StateCreator<TunerSlice> = (set, get) => {
  let subscription: Subscription | null = null

  return {
    frequency: 0 as Hertz,
    cents: 0 as Cents,
    confidence: 0,
    timestamp: 0,
    active: false,
    error: null,

    start() {
      if (get().active) return
      import('@/lib/audio/tuner-stream').then(({ createTunerStream }) => {
        set({ active: true, error: null })
        subscription = createTunerStream().subscribe({
          next(frame: PitchFrame) {
            _frame.frequency = frame.frequency
            _frame.cents = frame.centsDeviation
            _frame.confidence = frame.confidence
            _frame.timestamp = frame.timestamp
            set({
              frequency: _frame.frequency,
              cents: _frame.cents,
              confidence: _frame.confidence,
              timestamp: _frame.timestamp,
            })
          },
          error(err: unknown) {
            const message = err instanceof Error ? err.message : 'Microphone error'
            set({ active: false, error: message })
            subscription = null
          },
        })
      }).catch((err) => {
        set({ active: false, error: err instanceof Error ? err.message : String(err) })
      })
    },

    stop() {
      subscription?.unsubscribe()
      subscription = null
      set({ active: false })
    },

    updatePitch(frequencyHz: number, confidence: number, centsDeviation?: number) {
      let cents = (centsDeviation ?? 0) as Cents
      if (centsDeviation === undefined && frequencyHz > 0) {
        const midi = frequencyToMidiRaw(frequencyHz as Hertz)
        const rounded = Math.round(midi)
        cents = ((midi - rounded) * 100) as Cents
      }
      _frame.frequency = frequencyHz as Hertz
      _frame.cents = cents
      _frame.confidence = confidence
      set({
        frequency: _frame.frequency,
        cents: _frame.cents,
        confidence: _frame.confidence,
      })
    },
  }
}
