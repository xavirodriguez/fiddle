import { assign,setup } from 'xstate';

/**
 * Events for the NoteSegmenterMachine
 */
export type NoteSegmenterEvent =
  | { type: 'PITCH_DETECTED'; confidence: number; rms: number }
  | { type: 'PITCH_LOST' }
  | { type: 'TIMER_DONE' };

/**
 * Context for the NoteSegmenterMachine
 */
export interface NoteSegmenterContext {
  consecutiveFrames: number;
}

/**
 * noteSegmenterMachine
 *
 * Logic to distinguish between silence/noise and actual musical notes.
 * Uses a small "debounce" of consecutive frames to trigger a NOTE onset.
 */
export const noteSegmenterMachine = setup({
  types: {
    context: {} as NoteSegmenterContext,
    events: {} as NoteSegmenterEvent,
  },
  actions: {
    resetCounter: assign({
      consecutiveFrames: 0
    }),
    incrementCounter: assign({
      consecutiveFrames: ({ context }) => context.consecutiveFrames + 1
    }),
  },
}).createMachine({
  id: 'noteSegmenter',
  initial: 'SILENCE',
  context: {
    consecutiveFrames: 0,
  },
  states: {
    SILENCE: {
      on: {
        PITCH_DETECTED: {
          target: 'NOTE_PENDING',
          guard: ({ event }) => event.confidence > 0.8 && event.rms > 0.01,
        },
      },
      entry: 'resetCounter',
    },
    NOTE_PENDING: {
      on: {
        PITCH_DETECTED: [
          {
            target: 'NOTE',
            guard: ({ context }) => context.consecutiveFrames >= 3,
            actions: 'incrementCounter',
          },
          {
            actions: 'incrementCounter',
          },
        ],
        PITCH_LOST: 'SILENCE',
      },
    },
    NOTE: {
      entry: () => console.log('[NoteSegmenter] Note Started'),
      exit: () => console.log('[NoteSegmenter] Note Ended'),
      on: {
        PITCH_LOST: 'NOTE_LOST',
      },
    },
    NOTE_LOST: {
      after: {
        150: 'SILENCE', // Wait 150ms before considering the note finished (legato/vibrato tolerance)
      },
      on: {
        PITCH_DETECTED: {
          target: 'NOTE',
          guard: ({ event }) => event.confidence > 0.7,
        },
      },
    },
  },
});
