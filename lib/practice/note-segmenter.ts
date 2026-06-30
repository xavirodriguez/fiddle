import { assign, setup } from 'xstate';

/**
 * NoteSegmenterContext
 *
 * Tracks consecutive frames and thresholds for state transitions.
 */
export interface NoteSegmenterContext {
  consecutiveFrames: number;
  readonly minFramesForNote: number;
}

/**
 * NoteSegmenterEvent
 */
export type NoteSegmenterEvent =
  | { type: 'PITCH_DETECTED'; confidence: number; rms: number }
  | { type: 'PITCH_LOST' }
  | { type: 'RESET' };

/**
 * noteSegmenterMachine
 *
 * Robustly distinguishes between silence and musical notes using XState v5.
 * Designed for low-latency practice sessions.
 */

export const noteSegmenterMachine = setup({
  types: {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    context: {} as NoteSegmenterContext,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    events: {} as NoteSegmenterEvent,
  },
  actions: {
    resetCounter: assign({
      consecutiveFrames: 0,
    }),
    incrementCounter: assign({
      consecutiveFrames: ({ context }) => context.consecutiveFrames + 1,
    }),
  },
  guards: {
    isStrongSignal: ({ event }) => {
      if (event.type !== 'PITCH_DETECTED') return false;
      return event.confidence > 0.8 && event.rms > 0.01;
    },
    isConfirmedNote: ({ context }) => context.consecutiveFrames >= 2,
  },
}).createMachine({
  id: 'noteSegmenter',
  initial: 'SILENCE',
  context: {
    consecutiveFrames: 0,
    minFramesForNote: 2,
  },
  on: {
    RESET: {
      target: '.SILENCE',
      actions: 'resetCounter',
    },
  },
  states: {
    SILENCE: {
      entry: 'resetCounter',
      on: {
        PITCH_DETECTED: {
          target: 'NOTE_PENDING',
          guard: 'isStrongSignal',
          actions: 'incrementCounter',
        },
      },
    },
    NOTE_PENDING: {
      on: {
        PITCH_DETECTED: [
          {
            target: 'NOTE',
            guard: 'isConfirmedNote',
          },
          {
            actions: 'incrementCounter',
            guard: 'isStrongSignal',
          },
          {
            target: 'SILENCE',
          }
        ],
        PITCH_LOST: 'SILENCE',
      },
    },
    NOTE: {
      on: {
        PITCH_LOST: 'NOTE_LOST',
      },
    },
    NOTE_LOST: {
      after: {
        150: 'SILENCE',
      },
      on: {
        PITCH_DETECTED: {
          target: 'NOTE',
          guard: 'isStrongSignal',
        },
      },
    },
  },
});
