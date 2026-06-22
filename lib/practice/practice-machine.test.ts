import { describe, it, expect, vi } from 'vitest'
import { practiceMachine } from './practice-machine'
import { createActor } from 'xstate'
import { PitchFrame } from '../domain/data-structures'
import { Hertz, Cents } from '../domain/musical-domain'

describe('Practice State Machine (XState v5)', () => {
  it('should transition from idle to listening on START', () => {
    const actor = createActor(practiceMachine)
    actor.start()
    expect(actor.getSnapshot().value).toBe('idle')

    actor.send({ type: 'START' })
    expect(actor.getSnapshot().value).toBe('listening')
  })

  it('should start matching when the correct pitch is detected', () => {
    const actor = createActor(practiceMachine, {
      input: {
        targetMidi: 69,
        toleranceCents: 15
      }
    })
    actor.start()
    actor.send({ type: 'START' })

    const frame: PitchFrame = {
      frequency: 440 as Hertz, // A4
      centsDeviation: 0 as Cents,
      confidence: 0.99,
      timestamp: 1.0
    }

    actor.send({ type: 'PITCH_DETECTED', frame })
    expect(actor.getSnapshot().value).toBe('matching')
    expect(actor.getSnapshot().context.currentHoldTime).toBe(0)
    expect(actor.getSnapshot().context.lastTimestamp).toBe(1.0)
  })

  it('should complete matching and go to success after required duration', () => {
    const actor = createActor(practiceMachine, {
      input: {
        targetMidi: 69,
        requiredHoldTime: 0.5,
        currentHoldTime: 0.1,
        lastTimestamp: 1.0
      }
    })
    actor.start()
    actor.send({ type: 'START' })

    // Transition to matching first
    actor.send({
      type: 'PITCH_DETECTED',
      frame: {
        frequency: 440 as Hertz,
        centsDeviation: 0 as Cents,
        confidence: 0.99,
        timestamp: 1.0
      }
    })

    expect(actor.getSnapshot().value).toBe('matching')

    // Send a frame 0.5 seconds later
    const frame: PitchFrame = {
      frequency: 440 as Hertz,
      centsDeviation: 0 as Cents,
      confidence: 0.99,
      timestamp: 1.5
    }

    actor.send({ type: 'PITCH_DETECTED', frame })
    expect(actor.getSnapshot().value).toBe('success')
  })

  it('should reset hold time if pitch is lost', () => {
    const actor = createActor(practiceMachine, {
      input: {
        targetMidi: 69,
        currentHoldTime: 0.4,
        lastTimestamp: 1.0
      }
    })
    actor.start()
    actor.send({ type: 'START' })

    actor.send({ type: 'PITCH_LOST' })
    expect(actor.getSnapshot().value).toBe('listening')
    expect(actor.getSnapshot().context.currentHoldTime).toBe(0)
  })
})
