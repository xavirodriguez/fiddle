import { create } from 'zustand'

import { saveAsync } from '@/lib/persistence/persistence-core'

import { createPracticeSlice, type PracticeSlice } from './slices/practice-slice'
import { createTunerSlice, type TunerSlice } from './slices/tuner-slice'

export type RootState = PracticeSlice & TunerSlice

export const useAppStore = create<RootState>()((set, get, store) => ({
  ...createPracticeSlice(set, get, store),
  ...createTunerSlice(set, get, store),
}))

export const STORE_VERSION = 1

// Auto-save middleware / effect
if (typeof window !== 'undefined') {
  useAppStore.subscribe((state, prevState) => {
    // Throttled persistence for performance.
    // Only save if practice status changes or exercise changes.
    // Avoid saving on every frame (holdDuration/detectionHistory changes).
    if (
      state.practiceState.status !== prevState.practiceState.status ||
      state.practiceState.exercise.id !== prevState.practiceState.exercise.id ||
      state.practiceState.currentIndex !== prevState.practiceState.currentIndex
    ) {
      // Inject version for future migrations
      const versionedData = {
        ...state.practiceState,
        __version: STORE_VERSION,
      }
      void saveAsync('violin-practice-state', versionedData)
    }
  })
}

export const selectCents      = (s: RootState) => s.cents
export const selectFrequency  = (s: RootState) => s.frequency
export const selectConfidence = (s: RootState) => s.confidence
export const selectActive     = (s: RootState) => s.active
export const selectError      = (s: RootState) => s.error

/** Legacy compatibility exports */
export const usePracticeStore = useAppStore
export const useTunerStore = useAppStore
