import { create } from 'zustand'
import { createPracticeSlice, PracticeSlice } from './slices/practice-slice'
import { createTunerSlice, TunerSlice } from './slices/tuner-slice'

export type RootState = PracticeSlice & TunerSlice

export const useAppStore = create<RootState>()((...a) => ({
  ...createPracticeSlice(...a),
  ...createTunerSlice(...a),
}))

/** Legacy compatibility exports */
export const usePracticeStore = useAppStore
export const useTunerStore = useAppStore
