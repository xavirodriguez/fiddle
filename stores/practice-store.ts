"use client"

/**
 * practice-store.ts
 *
 * Zustand 5 store that wraps the pure `reducePracticeEvent` core reducer.
 * The store is the single source of truth for UI-visible practice state.
 * All mutations go through `internalUpdate` to preserve the deterministic
 * reducer contract; no state is mutated directly.
 *
 * Architecture note: this store lives in the Infrastructure / Adapters layer
 * — it is the React-facing boundary. Domain logic stays in practice-core.ts.
 */

import { create } from 'zustand'
import { reducePracticeEvent } from '@/lib/practice-core'
import type { PracticeState, PracticeEvent } from '@/lib/practice-core'

// ---------------------------------------------------------------------------
// Placeholder exercise used before a real exercise is loaded.
// Matches the shape expected by reducePracticeEvent.
// ---------------------------------------------------------------------------

const EMPTY_EXERCISE = {
  id: '__empty__',
  title: 'Sin ejercicio',
  notes: [] as PracticeState['exercise']['notes'],
}

// ---------------------------------------------------------------------------
// Initial domain state
// ---------------------------------------------------------------------------

const INITIAL_PRACTICE_STATE: PracticeState = {
  status: 'idle',
  currentIndex: 0,
  detectionHistory: [],
  holdDuration: 0,
  lastObservations: [],
  perfectNoteStreak: 0,
  exercise: EMPTY_EXERCISE,
  loopRegion: {
    isEnabled: false,
    startNoteIndex: 0,
    endNoteIndex: 0,
    drillTarget: null,
  },
  metronome: {
    bpm: 60,
    isEnabled: false,
    beatsPerMeasure: 4,
    subdivisions: 1,
  },
}

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

export interface PracticeStore {
  /** The full domain state managed by the pure reducer. */
  practiceState: PracticeState

  /**
   * How long (ms) a correct note must be held before it is accepted.
   * Configurable via settings UI; defaults to 300 ms.
   */
  requiredHoldTime: number

  /**
   * Sends an event through the pure reducer, producing the next state.
   * This is the ONLY way to mutate `practiceState`.
   */
  internalUpdate: (event: PracticeEvent) => void

  /** Replaces the active exercise and resets session state. */
  loadExercise: (exercise: PracticeState['exercise']) => void

  /** Convenience: jump to a specific note index. */
  jumpToNote: (index: number) => void

  /** Convenience: advance cursor by one note. */
  nextNote: () => void

  /** Convenience: move cursor back one note. */
  prevNote: () => void
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const usePracticeStore = create<PracticeStore>((set, get) => ({
  practiceState: INITIAL_PRACTICE_STATE,
  requiredHoldTime: 300,

  internalUpdate(event: PracticeEvent) {
    set((state) => ({
      practiceState: reducePracticeEvent(state.practiceState, event),
    }))
  },

  loadExercise(exercise: PracticeState['exercise']) {
    set({
      practiceState: {
        ...INITIAL_PRACTICE_STATE,
        exercise,
      },
    })
  },

  jumpToNote(index: number) {
    get().internalUpdate({ type: 'JUMP_TO_NOTE', payload: { index } })
  },

  nextNote() {
    const { currentIndex, exercise } = get().practiceState
    get().jumpToNote(Math.min(currentIndex + 1, exercise.notes.length - 1))
  },

  prevNote() {
    const { currentIndex } = get().practiceState
    get().jumpToNote(Math.max(currentIndex - 1, 0))
  },
}))
