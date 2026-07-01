import { type TunerSlice } from './slices/tuner-slice'

export * from './app-store'

export const selectCents = (s: TunerSlice) => s.cents
export const selectFrequency = (s: TunerSlice) => s.frequency
export const selectConfidence = (s: TunerSlice) => s.confidence
export const selectActive = (s: TunerSlice) => s.active
export const selectError = (s: TunerSlice) => s.error
