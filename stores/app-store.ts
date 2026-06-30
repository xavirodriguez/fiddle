import { create } from 'zustand'

import { audioPipeline } from '@/lib/audio/audio-pipeline'
import { loadAsync, saveAsync } from '@/lib/persistence/persistence-core'
import { type PracticeSessionRecord, type SessionHistory,SessionHistorySchema } from '@/lib/persistence/storage-types'

import { createPracticeSlice, type PracticeSlice } from './slices/practice-slice'
import { createTunerSlice, type TunerSlice } from './slices/tuner-slice'

export type RootState = PracticeSlice & TunerSlice

export const useAppStore = create<RootState>()((set, get, store) => ({
  ...createPracticeSlice(set, get, store),
  ...createTunerSlice(set, get, store),
}))

export const STORE_VERSION = 1
const HISTORY_KEY = 'violin-session-history'

// Auto-save middleware / effect
if (typeof window !== 'undefined') {
  useAppStore.subscribe((state, prevState) => {
    const handleUpdate = async () => {
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

      // Handle session completion: if status moves to 'completed', we should save it to history.
      if (state.practiceState.status === 'completed' && prevState.practiceState.status !== 'completed') {
        const report = audioPipeline.getTechniqueAgent().getSessionReport()
        const record: PracticeSessionRecord = {
          id: crypto.randomUUID(),
          exerciseId: state.practiceState.exercise.id,
          timestamp: Date.now(),
          score: state.practiceState.perfectNoteStreak,
          accuracyPercentage: report.noteCount > 0 ? (1 - report.bestNoteCents / 50) * 100 : 0, // Heuristic
          mostDifficultNote: report.worstNote ?? undefined,
          durationSeconds: 0, // Would need actual timer
        }

        // Update in-memory state
        state.completeSession(record)

        // Persistent History using PersistenceCore tools
        const history = (await loadAsync<SessionHistory>(HISTORY_KEY, SessionHistorySchema)) ?? {
          sessions: [],
          lastUpdated: Date.now(),
        }

        history.sessions.push(record)
        history.lastUpdated = Date.now()
        void saveAsync(HISTORY_KEY, history)
      }
    }
    void handleUpdate()
  })
}

export const selectCents = (s: RootState) => s.cents
export const selectFrequency = (s: RootState) => s.frequency
export const selectConfidence = (s: RootState) => s.confidence
export const selectActive = (s: RootState) => s.active
export const selectError = (s: RootState) => s.error

/** Legacy compatibility exports */
export const usePracticeStore = useAppStore
export const useTunerStore = useAppStore
