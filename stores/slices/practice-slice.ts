import { StateCreator } from 'zustand'
import { reducePracticeEvent } from '@/lib/practice-core'
import type { PracticeState, PracticeEvent } from '@/lib/practice-core'
import { Note as TargetNote } from '@/lib/domain/exercise'

const EMPTY_EXERCISE = {
  id: '__empty__',
  title: 'Sin ejercicio',
  notes: [] as TargetNote[],
}

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

export interface PracticeSlice {
  practiceState: PracticeState
  requiredHoldTime: number
  syncState: {
    currentMeasure: number
    currentMidiTarget: number | null
    isCorrectPitch: boolean
  }
  internalUpdate: (event: PracticeEvent) => void
  updateSync: (sync: Partial<PracticeSlice['syncState']>) => void
  loadExercise: (exercise: PracticeState['exercise']) => void
  jumpToNote: (index: number) => void
  nextNote: () => void
  prevNote: () => void
}

export const createPracticeSlice: StateCreator<PracticeSlice> = (set, get) => ({
  practiceState: INITIAL_PRACTICE_STATE,
  requiredHoldTime: 300,
  syncState: {
    currentMeasure: 0,
    currentMidiTarget: null,
    isCorrectPitch: false,
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
})
