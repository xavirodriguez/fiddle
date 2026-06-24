import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'

import { noteSegmenterMachine } from './note-segmenter'

describe('NoteSegmenter State Machine (v5 Unified)', () => {
  it('should start in SILENCE state', () => {
    const actor = createActor(noteSegmenterMachine).start()
    expect(actor.getSnapshot().value).toBe('SILENCE')
  })

  it('should transition to NOTE_PENDING on valid pitch', () => {
    const actor = createActor(noteSegmenterMachine).start()
    actor.send({ type: 'PITCH_DETECTED', confidence: 0.9, rms: 0.05 })
    expect(actor.getSnapshot().value).toBe('NOTE_PENDING')
  })

  it('should transition to NOTE state after enough valid frames', () => {
    const actor = createActor(noteSegmenterMachine).start()

    actor.send({ type: 'PITCH_DETECTED', confidence: 0.9, rms: 0.05 }) // -> NOTE_PENDING (0 -> 1)
    actor.send({ type: 'PITCH_DETECTED', confidence: 0.9, rms: 0.05 }) // -> NOTE_PENDING (1 -> 2)
    actor.send({ type: 'PITCH_DETECTED', confidence: 0.9, rms: 0.05 }) // -> NOTE (confirmed at >= 2)

    expect(actor.getSnapshot().value).toBe('NOTE')
  })

  it('should transition back to SILENCE on PITCH_LOST', () => {
    const actor = createActor(noteSegmenterMachine).start()

    actor.send({ type: 'PITCH_DETECTED', confidence: 0.9, rms: 0.05 })
    actor.send({ type: 'PITCH_DETECTED', confidence: 0.9, rms: 0.05 })
    actor.send({ type: 'PITCH_DETECTED', confidence: 0.9, rms: 0.05 })
    expect(actor.getSnapshot().value).toBe('NOTE')

    actor.send({ type: 'PITCH_LOST' })
    expect(actor.getSnapshot().value).toBe('NOTE_LOST')
  })

  it('should reset to SILENCE on RESET event', () => {
    const actor = createActor(noteSegmenterMachine).start()
    actor.send({ type: 'PITCH_DETECTED', confidence: 0.9, rms: 0.05 })
    expect(actor.getSnapshot().value).toBe('NOTE_PENDING')

    actor.send({ type: 'RESET' })
    expect(actor.getSnapshot().value).toBe('SILENCE')
    expect(actor.getSnapshot().context.consecutiveFrames).toBe(0)
  })
})
