import { beforeEach,describe, expect, it } from 'vitest'

import { type Seconds } from '@/lib/audio/tone-bridge'
import { type Exercise } from '@/lib/domain/exercise'

import { TimelineSynchronizer } from './timeline-synchronizer'

describe('TimelineSynchronizer', () => {
  let synchronizer: TimelineSynchronizer

  const mockExercise: Exercise = {
    id: 'test-exercise',
    title: 'Test Exercise',
    bpm: 60,
    notes: [
      { id: 'n1', pitch: { step: 'C', alter: 0, octave: 4 }, duration: 1 },
      { id: 'n2', pitch: { step: 'D', alter: 0, octave: 4 }, duration: 1 },
    ],
  }

  beforeEach(() => {
    synchronizer = new TimelineSynchronizer()
  })

  it('should compile an exercise into a timeline', () => {
    const result = synchronizer.compile(mockExercise)
    expect(result.isOk()).toBe(true)
    const timeline = synchronizer.getTimeline()
    expect(timeline).toHaveLength(2)
    expect(timeline[0].startTime).toBe(0)
    expect(timeline[1].startTime).toBe(1) // 60bpm, 1 beat = 1s
  })

  it('should verify correct pitch and timing', () => {
    synchronizer.compile(mockExercise)
    // C4 is MIDI 60
    const verification = synchronizer.verify(0.5 as Seconds, 60)
    expect(verification.isCorrectPitch).toBe(true)
    expect(verification.currentNoteIndex).toBe(0)
    expect(verification.expectedMidi).toBe(60)
  })

  it('should detect incorrect pitch', () => {
    synchronizer.compile(mockExercise)
    const verification = synchronizer.verify(0.5 as Seconds, 62) // D4 instead of C4
    expect(verification.isCorrectPitch).toBe(false)
  })

  it('should advance pointer as time progresses', () => {
    synchronizer.compile(mockExercise)
    const v1 = synchronizer.verify(0.5 as Seconds, 60)
    expect(v1.currentNoteIndex).toBe(0)

    const v2 = synchronizer.verify(1.5 as Seconds, 62) // D4 is MIDI 62
    expect(v2.currentNoteIndex).toBe(1)
    expect(v2.isCorrectPitch).toBe(true)
  })
})
