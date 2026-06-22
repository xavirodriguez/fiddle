/**
 * Exercise Domain Types
 *
 * Defines the immutable data shapes for a practice exercise.
 * Pure types only — no dependencies on infrastructure or UI layers.
 */

// ---------------------------------------------------------------------------
// Pitch
// ---------------------------------------------------------------------------

/**
 * The alter (accidental) of a note.
 * -1 = flat, 0 = natural, 1 = sharp
 */
export type NoteAlter = -1 | 0 | 1

/** A single pitch in scientific pitch notation parts. */
export interface Pitch {
  /** Diatonic step: C, D, E, F, G, A, or B */
  readonly step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'
  /** Chromatic alteration: -1 flat, 0 natural, 1 sharp */
  readonly alter: NoteAlter
  /** Scientific octave number (0–8) */
  readonly octave: number
}

// ---------------------------------------------------------------------------
// Note
// ---------------------------------------------------------------------------

/** A single note within an exercise. */
export interface Note {
  /** Unique identifier within the exercise. */
  readonly id: string
  /** Scientific pitch data. */
  readonly pitch: Pitch
  /** Duration in beats (e.g. 1 = quarter, 0.5 = eighth). */
  readonly duration: number
  /** Optional fingering hint (1–4 for violin). */
  readonly fingering?: 1 | 2 | 3 | 4
}

// ---------------------------------------------------------------------------
// Exercise
// ---------------------------------------------------------------------------

/** A complete practice exercise consisting of an ordered sequence of notes. */
export interface Exercise {
  /** Stable unique identifier. */
  readonly id: string
  /** Human-readable title. */
  readonly title: string
  /** The ordered sequence of notes to practice. */
  readonly notes: readonly Note[]
  /** Optional MusicXML source string for OSMD rendering. */
  readonly musicXml?: string
  /** Tempo in BPM. */
  readonly bpm?: number
}
