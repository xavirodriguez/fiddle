/**
 * NoteSegmenter
 *
 * Uses XState to robustly distinguish between SILENCE and NOTE states
 * based on the incoming PitchFrame stream. This prevents "jitter" where
 * a single bad frame might interrupt a held note.
 */

import { assign,createMachine } from 'xstate'

import { type PitchFrame } from '../domain/data-structures'

export interface NoteSegmenterContext {
  consecutiveFrames: number
  readonly minFramesForNote: number
  readonly minFramesForSilence: number
}

export type NoteSegmenterEvent =
  | { type: 'FRAME'; frame: PitchFrame }
  | { type: 'RESET' }

/**
 * Note Segmenter State Machine
 *
 * Transitions between silence and note states with debouncing.
 */
export const noteSegmenterMachine = createMachine(
  {
    id: 'noteSegmenter',
    initial: 'silence',
    types: {},
    context: {
      consecutiveFrames: 0,
      minFramesForNote: 2, // At ~60FPS, 2 frames is ~33ms
      minFramesForSilence: 3, // Be more conservative about ending a note
    },
    on: {
      RESET: {
        target: '.silence',
        actions: assign({ consecutiveFrames: 0 }),
      },
    },
    states: {
      silence: {
        entry: assign({ consecutiveFrames: 0 }),
        on: {
          FRAME: {
            guard: 'isPitchValid',
            target: 'debouncingToNote',
          },
        },
      },
      debouncingToNote: {
        entry: assign({ consecutiveFrames: 1 }),
        on: {
          FRAME: [
            {
              guard: ({ context, event }) =>
                context.consecutiveFrames + 1 >= context.minFramesForNote &&
                event.type === 'FRAME' &&
                event.frame.frequency > 0 &&
                event.frame.confidence > 0.8,
              target: 'note',
            },
            {
              guard: 'isPitchValid',
              actions: assign({
                consecutiveFrames: ({ context }) => context.consecutiveFrames + 1,
              }),
            },
            {
              target: 'silence',
            },
          ],
        },
      },
      note: {
        on: {
          FRAME: {
            guard: 'isPitchInvalid',
            target: 'debouncingToSilence',
          },
        },
      },
      debouncingToSilence: {
        entry: assign({ consecutiveFrames: 1 }),
        on: {
          FRAME: [
            {
              guard: ({ context, event }) =>
                context.consecutiveFrames + 1 >= context.minFramesForSilence &&
                event.type === 'FRAME' &&
                (event.frame.frequency === 0 || event.frame.confidence < 0.5),
              target: 'silence',
            },
            {
              guard: 'isPitchInvalid',
              actions: assign({
                consecutiveFrames: ({ context }) => context.consecutiveFrames + 1,
              }),
            },
            {
              target: 'note',
            },
          ],
        },
      },
    },
  },
  {
    guards: {
      isPitchValid: ({ event }) =>
        event.type === 'FRAME' && event.frame.frequency > 0 && event.frame.confidence > 0.8,
      isPitchInvalid: ({ event }) =>
        event.type === 'FRAME' && (event.frame.frequency === 0 || event.frame.confidence < 0.5),
    },
  }
)
