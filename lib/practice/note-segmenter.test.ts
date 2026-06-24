import { describe, expect, it, vi } from 'vitest'
import { createActor } from 'xstate'

import { type PitchFrame } from '../domain/data-structures'
import { type Cents,type Hertz } from '../domain/musical-domain'
import { noteSegmenterMachine } from './note-segmenter'

describe('NoteSegmenter State Machine', () => {
  it('should start in silence state', () => {
    const actor = createActor(noteSegmenterMachine).start()
    expect(actor.getSnapshot().value).toBe('silence')
  })

  it('should transition to debouncingToNote on valid pitch', () => {
    const actor = createActor(noteSegmenterMachine).start()
    const frame: PitchFrame = {
      frequency: 440 as Hertz,
      confidence: 0.9,
      timestamp: 1,
      centsDeviation: 0 as Cents,
    }
    actor.send({ type: 'FRAME', frame })
    expect(actor.getSnapshot().value).toBe('debouncingToNote')
    expect(actor.getSnapshot().context.consecutiveFrames).toBe(1)
  })

  it('should transition to note state after enough valid frames', () => {
    const actor = createActor(noteSegmenterMachine).start()
    const frame: PitchFrame = {
      frequency: 440 as Hertz,
      confidence: 0.9,
      timestamp: 1,
      centsDeviation: 0 as Cents,
    }

    actor.send({ type: 'FRAME', frame }) // -> debouncingToNote (1)
    actor.send({ type: 'FRAME', frame }) // -> note (2)

    expect(actor.getSnapshot().value).toBe('note')
  })

  it('should transition back to silence on invalid pitch', () => {
    const actor = createActor(noteSegmenterMachine).start()
    const frame: PitchFrame = {
      frequency: 440 as Hertz,
      confidence: 0.9,
      timestamp: 1,
      centsDeviation: 0 as Cents,
    }
    const silentFrame: PitchFrame = {
      frequency: 0 as Hertz,
      confidence: 0,
      timestamp: 2,
      centsDeviation: 0 as Cents,
    }

    actor.send({ type: 'FRAME', frame })
    actor.send({ type: 'FRAME', frame })
    expect(actor.getSnapshot().value).toBe('note')

    actor.send({ type: 'FRAME', frame: silentFrame }) // -> debouncingToSilence (1)
    actor.send({ type: 'FRAME', frame: silentFrame }) // -> debouncingToSilence (2)
    actor.send({ type: 'FRAME', frame: silentFrame }) // -> silence (3)

    expect(actor.getSnapshot().value).toBe('silence')
  })

  it('should reset to silence on RESET event', () => {
    const actor = createActor(noteSegmenterMachine).start()
    const frame: PitchFrame = {
      frequency: 440 as Hertz,
      confidence: 0.9,
      timestamp: 1,
      centsDeviation: 0 as Cents,
    }
    actor.send({ type: 'FRAME', frame })
    actor.send({ type: 'FRAME', frame })
    expect(actor.getSnapshot().value).toBe('note')

    actor.send({ type: 'RESET' })
    expect(actor.getSnapshot().value).toBe('silence')
    expect(actor.getSnapshot().context.consecutiveFrames).toBe(0)
  })
})
