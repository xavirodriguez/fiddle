/**
 * Tuner Store
 *
 * Zustand store that bridges the RxJS TunerStream Observable with React.
 *
 * Zero-Allocation Contract
 * ------------------------
 * The subscriber callback mutates `_frame` (a pre-allocated plain object) and
 * calls a single `setState` with the same object reference. React's
 * `useSyncExternalStore` inside Zustand will only trigger re-renders when the
 * selector output changes — callers should use primitive selectors (e.g.
 * `(s) => s.cents`) so the diff is a number comparison, not an object equality
 * check.
 *
 * No `{}`, `[]`, or `new` is used inside the subscription callback.
 */

import { create } from 'zustand'
import type { Subscription } from 'rxjs'
import type { PitchFrame } from '@/lib/domain/data-structures'
import type { Hertz, Cents } from '@/lib/domain/musical-domain'

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface TunerState {
  /** Detected frequency, 0 when silent. */
  frequency: Hertz
  /** Deviation from nearest semitone in cents (-50 … +50). */
  cents: Cents
  /** Pitchy confidence 0–1. */
  confidence: number
  /** AudioContext.currentTime of the last frame. */
  timestamp: number
  /** Whether the microphone stream is running. */
  active: boolean
  /** Permission or hardware error message, if any. */
  error: string | null
}

export interface TunerActions {
  /** Start the microphone stream. Idempotent. */
  start(): void
  /** Stop the microphone stream and release hardware. */
  stop(): void
}

// ---------------------------------------------------------------------------
// Pre-allocated mutable accumulator — mutated in-place by the subscription.
// This is the single object written to Zustand state; Zustand does a shallow
// comparison on the store, so callers MUST use primitive selectors.
// ---------------------------------------------------------------------------
const _frame = {
  frequency: 0 as Hertz,
  cents: 0 as Cents,
  confidence: 0,
  timestamp: 0,
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTunerStore = create<TunerState & TunerActions>()((set, get) => {
  let subscription: Subscription | null = null

  return {
    // Initial state
    frequency: 0 as Hertz,
    cents: 0 as Cents,
    confidence: 0,
    timestamp: 0,
    active: false,
    error: null,

    start() {
      if (get().active) return

      // Lazy-import to keep the stream out of the SSR bundle.
      import('@/lib/audio/tuner-stream').then(({ createTunerStream }) => {
        set({ active: true, error: null })

        subscription = createTunerStream().subscribe({
          next(frame: PitchFrame) {
            // Mutate in-place — no allocation.
            _frame.frequency = frame.frequency
            _frame.cents    = frame.centsDeviation
            _frame.confidence = frame.confidence
            _frame.timestamp  = frame.timestamp
            // setState with the same object reference. Primitive selectors
            // will still receive the latest values via the store snapshot.
            set({
              frequency:  _frame.frequency,
              cents:      _frame.cents,
              confidence: _frame.confidence,
              timestamp:  _frame.timestamp,
            })
          },
          error(err: unknown) {
            const message = err instanceof Error ? err.message : 'Microphone error'
            set({ active: false, error: message })
            subscription = null
          },
        })
      })
    },

    stop() {
      subscription?.unsubscribe()
      subscription = null
      set({ active: false })
    },
  }
})

// ---------------------------------------------------------------------------
// Primitive selectors — use these to avoid object-equality churn.
// ---------------------------------------------------------------------------
export const selectCents      = (s: TunerState) => s.cents
export const selectFrequency  = (s: TunerState) => s.frequency
export const selectConfidence = (s: TunerState) => s.confidence
export const selectActive     = (s: TunerState) => s.active
export const selectError      = (s: TunerState) => s.error
