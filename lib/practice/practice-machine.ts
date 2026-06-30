import { assign, setup } from 'xstate'

import { type PitchFrame } from '../domain/data-structures'
import { frequencyToMidiRaw } from '../domain/musical-domain';
import { REQUIRED_HOLD_TIME_SEC } from './practice-constants';

export interface PracticeContext {
  targetMidi: number;
  toleranceCents: number;
  requiredHoldTime: number;
  currentHoldTime: number;
  lastTimestamp: number;
  errorCount: number;
}

export type PracticeEvent =
  | { type: 'START' }
  | { type: 'STOP' }
  | { type: 'PITCH_DETECTED'; frame: PitchFrame }
  | { type: 'PITCH_LOST' }
  | { type: 'SET_TARGET'; midi: number };

export const practiceMachine = setup({
  types: {
    context: ({} as unknown as PracticeContext),
    events: ({} as unknown as PracticeEvent),
    input: ({} as unknown as {
      targetMidi?: number;
      toleranceCents?: number;
      requiredHoldTime?: number;
    }),
  },
  guards: {
    isCorrectPitch: ({ context, event }) => {
      if (event.type !== 'PITCH_DETECTED') return false
      const midi = frequencyToMidiRaw(event.frame.frequency)
      const diff = Math.abs(midi - context.targetMidi) * 100
      return diff <= context.toleranceCents
    },
    isHoldComplete: ({ context, event }) => {
      if (event.type !== 'PITCH_DETECTED') return false
      const delta = context.lastTimestamp > 0 ? event.frame.timestamp - context.lastTimestamp : 0
      return context.currentHoldTime + delta >= context.requiredHoldTime
    },
  },
  actions: {
    assignTarget: assign({
      targetMidi: ({ event }) => (event.type === 'SET_TARGET' ? event.midi : 0),
    }),
    updateTimestamp: assign({
      lastTimestamp: ({ event }) => (event.type === 'PITCH_DETECTED' ? event.frame.timestamp : 0),
    }),
    incrementHoldTime: assign({
      currentHoldTime: ({ context, event }) => {
        if (event.type !== 'PITCH_DETECTED') return context.currentHoldTime
        const delta = context.lastTimestamp > 0 ? event.frame.timestamp - context.lastTimestamp : 0
        return context.currentHoldTime + delta
      },
      lastTimestamp: ({ event }) => (event.type === 'PITCH_DETECTED' ? event.frame.timestamp : 0),
    }),
    clearHoldTime: assign({
      currentHoldTime: 0,
      lastTimestamp: 0,
    }),
    captureSnapshot: () => {
      // Inlined in PracticeService.actor definition
    },
    notifySuccess: () => {
      // Inlined in PracticeService.actor definition
    },
  },
}).createMachine({
  id: 'practice',
  initial: 'idle',
  context: ({ input }) => ({
    targetMidi: 0,
    toleranceCents: 15,
    requiredHoldTime: REQUIRED_HOLD_TIME_SEC,
    currentHoldTime: 0,
    lastTimestamp: 0,
    errorCount: 0,
    ...input,
  }),
  on: {
    SET_TARGET: {
      actions: ['assignTarget', 'clearHoldTime'],
    },
    STOP: '.idle',
  },
  states: {
    idle: {
      on: {
        START: 'listening',
      },
    },
    listening: {
      on: {
        PITCH_DETECTED: [
          {
            target: 'matching',
            guard: 'isCorrectPitch',
            actions: 'updateTimestamp',
          },
          {
            target: 'listening',
            actions: 'clearHoldTime',
          },
        ],
        PITCH_LOST: {
          target: 'listening',
          actions: 'clearHoldTime',
        },
      },
    },
    matching: {
      on: {
        PITCH_DETECTED: [
          {
            target: 'success',
            guard: 'isHoldComplete',
          },
          {
            target: 'matching',
            guard: 'isCorrectPitch',
            actions: 'incrementHoldTime',
            reenter: true,
          },
          {
            target: 'listening',
            actions: 'clearHoldTime',
          },
        ],
        PITCH_LOST: {
          target: 'listening',
          actions: 'clearHoldTime',
        },
      },
    },
    success: {
      after: {
        500: 'listening',
      },
      entry: ['captureSnapshot', 'notifySuccess'],
      on: {
        SET_TARGET: {
          target: 'listening',
          actions: ['assignTarget', 'clearHoldTime'],
        },
      },
    },
  },
})
