import { type RootState } from './app-store'

export * from './app-store'

export const selectCents = (s: RootState) => s.cents
export const selectFrequency = (s: RootState) => s.frequency
export const selectConfidence = (s: RootState) => s.confidence
export const selectActive = (s: RootState) => s.active
export const selectError = (s: RootState) => s.error
