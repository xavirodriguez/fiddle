import { createMachine, assign } from 'xstate';
import { PitchFrame } from '../domain/data-structures';
import { frequencyToMidi } from '../domain/musical-domain';

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

export const practiceMachine = createMachine({
  id: 'practice',
  initial: 'idle',
  types: {} as {
    context: PracticeContext;
    events: PracticeEvent;
  },
  context: ({ input }: { input?: Partial<PracticeContext> }) => ({
    targetMidi: 0,
    toleranceCents: 15,
    requiredHoldTime: 1.0,
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
      entry: 'notifySuccess',
      on: {
        SET_TARGET: {
          target: 'listening',
          actions: ['assignTarget', 'clearHoldTime'],
        },
      },
    },
  },
}, {
  guards: {
    isCorrectPitch: ({ context, event }) => {
      if (event.type !== 'PITCH_DETECTED') return false;
      const result = frequencyToMidi(event.frame.frequency);
      if (result.isErr()) return false;
      const diff = Math.abs(result.value - context.targetMidi) * 100;
      return diff <= context.toleranceCents;
    },
    isHoldComplete: ({ context, event }) => {
      if (event.type !== 'PITCH_DETECTED') return false;
      const delta = context.lastTimestamp > 0 ? event.frame.timestamp - context.lastTimestamp : 0;
      return (context.currentHoldTime + delta) >= context.requiredHoldTime;
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
        if (event.type !== 'PITCH_DETECTED') return context.currentHoldTime;
        const delta = context.lastTimestamp > 0 ? event.frame.timestamp - context.lastTimestamp : 0;
        return context.currentHoldTime + delta;
      },
      lastTimestamp: ({ event }) => (event.type === 'PITCH_DETECTED' ? event.frame.timestamp : 0),
    }),
    clearHoldTime: assign({
      currentHoldTime: 0,
      lastTimestamp: 0,
    }),
    notifySuccess: () => {
      // Inlined in PracticeService.actor definition
    },
  },
});
