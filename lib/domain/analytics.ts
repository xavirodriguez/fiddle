import { MusicalNote } from '../practice-core'

/**
 * Domain representation of a practice session record.
 */
export interface PracticeSession {
  readonly id: string
  readonly exerciseId: string
  readonly timestamp: number
  readonly score: number
  readonly accuracyPercentage: number
  readonly mostDifficultNote?: string
  readonly durationSeconds: number
}

/**
 * Accuracy trend data point.
 */
export interface AccuracyDataPoint {
  readonly timestamp: number
  readonly accuracy: number
}

/**
 * Historical accuracy statistics for a specific category (e.g., a note or a string).
 */
export interface CategoryStatistics {
  readonly category: string
  readonly averageAccuracy: number
  readonly attemptCount: number
  readonly trend: AccuracyDataPoint[]
}

/**
 * Long-term analytics report.
 */
export interface AnalyticsReport {
  readonly totalSessions: number
  readonly totalDurationSeconds: number
  readonly averageAccuracy: number
  readonly noteAccuracy: Record<string, CategoryStatistics>
  readonly stringAccuracy: Record<string, CategoryStatistics>
  readonly sessionHistory: AccuracyDataPoint[]
}

/**
 * Maps a MIDI note number to the likely violin string.
 * This is a heuristic as the same note can often be played on multiple strings.
 */
export function getLikelyString(midi: number): 'G' | 'D' | 'A' | 'E' {
  if (midi < 62) return 'G'
  if (midi < 69) return 'D'
  if (midi < 76) return 'A'
  return 'E'
}

/**
 * Aggregates a list of practice sessions into a comprehensive analytics report.
 */
export function aggregateSessions(sessions: PracticeSession[]): AnalyticsReport {
  if (sessions.length === 0) {
    return {
      totalSessions: 0,
      totalDurationSeconds: 0,
      averageAccuracy: 0,
      noteAccuracy: {},
      stringAccuracy: {},
      sessionHistory: [],
    }
  }

  let totalAccuracy = 0
  let totalDuration = 0
  const noteStats: Record<string, { sum: number; count: number; trend: AccuracyDataPoint[] }> = {}
  const stringStats: Record<string, { sum: number; count: number; trend: AccuracyDataPoint[] }> = {}
  const sessionHistory: AccuracyDataPoint[] = []

  // Sort sessions by timestamp
  const sortedSessions = [...sessions].sort((a, b) => a.timestamp - b.timestamp)

  for (const session of sortedSessions) {
    totalAccuracy += session.accuracyPercentage
    totalDuration += session.durationSeconds
    const dataPoint = {
      timestamp: session.timestamp,
      accuracy: session.accuracyPercentage,
    }
    sessionHistory.push(dataPoint)

    if (session.mostDifficultNote) {
      const note = session.mostDifficultNote
      if (!noteStats[note]) {
        noteStats[note] = { sum: 0, count: 0, trend: [] }
      }
      noteStats[note].sum += session.accuracyPercentage
      noteStats[note].count++
      noteStats[note].trend.push(dataPoint)

      // String-level statistics heuristic
      const noteResult = MusicalNote.tryFromName(note)
      if (noteResult.isOk()) {
        const str = getLikelyString(noteResult.value.midiNumber)
        if (!stringStats[str]) {
          stringStats[str] = { sum: 0, count: 0, trend: [] }
        }
        stringStats[str].sum += session.accuracyPercentage
        stringStats[str].count++
        stringStats[str].trend.push(dataPoint)
      }
    }
  }

  // Finalize note statistics
  const finalizedNoteStats: Record<string, CategoryStatistics> = {}
  for (const [note, stats] of Object.entries(noteStats)) {
    finalizedNoteStats[note] = {
      category: note,
      averageAccuracy: stats.count > 0 ? stats.sum / stats.count : 0,
      attemptCount: stats.count,
      trend: stats.trend,
    }
  }

  // Finalize string statistics
  const finalizedStringStats: Record<string, CategoryStatistics> = {}
  for (const [str, stats] of Object.entries(stringStats)) {
    finalizedStringStats[str] = {
      category: str,
      averageAccuracy: stats.count > 0 ? stats.sum / stats.count : 0,
      attemptCount: stats.count,
      trend: stats.trend,
    }
  }

  return {
    totalSessions: sessions.length,
    totalDurationSeconds: totalDuration,
    averageAccuracy: totalAccuracy / sessions.length,
    noteAccuracy: finalizedNoteStats,
    stringAccuracy: finalizedStringStats,
    sessionHistory,
  }
}
