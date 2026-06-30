import { describe, expect, it } from 'vitest'

import { type PracticeSessionRecord } from '../persistence/storage-types'
import { aggregateSessions } from './analytics'

describe('Analytics Domain', () => {
  it('should return empty report for empty sessions', () => {
    const report = aggregateSessions([])
    expect(report.totalSessions).toBe(0)
    expect(report.averageAccuracy).toBe(0)
  })

  it('should aggregate session data correctly and populate trends', () => {
    const sessions: PracticeSessionRecord[] = [
      {
        id: '1',
        exerciseId: 'ex1',
        timestamp: 1000,
        score: 10,
        accuracyPercentage: 80,
        mostDifficultNote: 'A4',
        durationSeconds: 60,
      },
      {
        id: '2',
        exerciseId: 'ex1',
        timestamp: 2000,
        score: 12,
        accuracyPercentage: 90,
        mostDifficultNote: 'A4',
        durationSeconds: 60,
      },
    ]

    const report = aggregateSessions(sessions)
    expect(report.totalSessions).toBe(2)
    expect(report.averageAccuracy).toBe(85)
    expect(report.totalDurationSeconds).toBe(120)

    // Check note statistics
    const a4Stats = report.noteAccuracy['A4']
    expect(a4Stats.attemptCount).toBe(2)
    expect(a4Stats.averageAccuracy).toBe(85)
    expect(a4Stats.trend).toHaveLength(2)
    expect(a4Stats.trend[0].accuracy).toBe(80)
    expect(a4Stats.trend[1].accuracy).toBe(90)

    // Check string statistics (A4 should map to A string or E depending on heuristic)
    // A4 MIDI is 69. 69 < 76 so it's 'A' string.
    expect(report.stringAccuracy['A']).toBeDefined()
    expect(report.stringAccuracy['A'].averageAccuracy).toBe(85)
  })
})
