import { type StateCreator } from 'zustand'

import { type Note as TargetNote } from '@/lib/domain/exercise'
import { type DetectedNote } from '@/lib/domain/practice'
import { REQUIRED_HOLD_TIME_SEC } from '@/lib/practice/practice-constants'
import type { PracticeEvent, PracticeState } from '@/lib/practice-core'
import { reducePracticeEvent } from '@/lib/practice-core'

const EMPTY_EXERCISE = {
  id: '__empty__',
  title: 'Sin ejercicio',
  notes: [] as TargetNote[],
}

const INITIAL_PRACTICE_STATE: PracticeState = {
  status: 'idle',
  currentIndex: 0,
  detectionHistory: {
    items: new Array<DetectedNote | null>(10).fill(null),
    head: 0,
    size: 0,
    maxSize: 10,
  },
  holdDuration: 0,
  lastObservations: [],
  perfectNoteStreak: 0,
  exercise: EMPTY_EXERCISE,
  sessionHistory: [],
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

/**
 * PracticeSlice
 *
 * Defines the state and actions for the practice session.
 *
 * DATA ARCHITECTURE:
 * 1. Observable State (Zustand): Contains high-level session status,
 *    discrete musical progress (measure index, target MIDI), and
 *    persistent configuration. This data is observed by React to
 *    drive UI updates.
 * 2. High-Frequency Data (DSP/Refs): Real-time frequency, cents, and
 *    RMS data never enter the Zustand store at 60 FPS. They are
 *    handled via refs and direct DOM manipulation (see FeedbackOverlay)
 *    to prevent React reconciliation pressure.
 */
export interface PracticeSlice {
  practiceState: PracticeState
  requiredHoldTime: number
  /**
   * syncState: Musical synchronization data observed by the UI.
   * Only updated on discrete changes to minimize re-renders.
   */
  syncState: {
    currentMeasure: number
    currentMidiTarget: number | null
    isCorrectPitch: boolean
    isCorrectTiming: boolean
  }
  internalUpdate: (event: PracticeEvent) => void
  updateSync: (sync: Partial<PracticeSlice['syncState']>) => void
  loadExercise: (exercise: PracticeState['exercise']) => void
  jumpToNote: (index: number) => void
  nextNote: () => void
  prevNote: () => void
  setPracticeState: (state: Partial<PracticeState>) => void
}

export const createPracticeSlice: StateCreator<PracticeSlice> = (set, get) => ({
  practiceState: INITIAL_PRACTICE_STATE,
  requiredHoldTime: REQUIRED_HOLD_TIME_SEC,
  syncState: {
    currentMeasure: 0,
    currentMidiTarget: null,
    isCorrectPitch: false,
    isCorrectTiming: false,
  },

  internalUpdate(event: PracticeEvent) {
    set((state) => ({
      practiceState: reducePracticeEvent(state.practiceState, event),
    }))
  },

  updateSync(sync) {
    set((state) => ({
      syncState: { ...state.syncState, ...sync },
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

  setPracticeState(newState) {
    set((state) => ({
      practiceState: { ...state.practiceState, ...newState },
    }))
  },
})
