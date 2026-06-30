/**
 * Practice Domain Types
 *
 * Defines all state shapes, event discriminated unions, and value types for
 * the practice session state machine.
 * Pure types only — no React, Zustand, or browser API dependencies.
 */

import type { NoteTechnique,Observation } from '../technique-types'
import type { Note } from './exercise'

// ---------------------------------------------------------------------------
// Session status
// ---------------------------------------------------------------------------

/**
 * Represents the current phase of a practice session.
 *
 * idle        → waiting for user to start
 * listening   → session active, waiting for a matching pitch
 * validating  → correct pitch detected, measuring hold duration
 * correct     → note accepted, briefly displaying feedback before advancing
 * completed   → all notes in the exercise (or loop region) have been matched
 */
export type PracticeStatus =
  | 'idle'
  | 'listening'
  | 'validating'
  | 'correct'
  | 'completed'

// ---------------------------------------------------------------------------
// DetectedNote
// ---------------------------------------------------------------------------

/** A snapshot of a single pitch detection result used in the practice loop. */
export interface DetectedNote {
  /** Detected note name in scientific pitch notation (e.g. "A4"). */
  pitch: string
  /** Raw detected frequency in Hz. */
  pitchHz: number
  /** Deviation from the nearest semitone in cents (−50 … +50). */
  cents: number
  /** AudioContext.currentTime when this frame was captured. */
  timestamp: number
  /** Pitchy confidence score (0–1). */
  confidence: number
}

// ---------------------------------------------------------------------------
// Loop region
// ---------------------------------------------------------------------------

/** Configuration for drill / loop mode. */
export interface LoopRegion {
  /** Whether the loop is currently active. */
  isEnabled: boolean
  /** Zero-based index of the first note in the loop. */
  startNoteIndex: number
  /** Zero-based index of the last note in the loop (inclusive). */
  endNoteIndex: number
  /**
   * Optional drill target (e.g. "complete 3 perfect repetitions").
   * null means loop indefinitely until the user disables it.
   */
  drillTarget: DrillTarget | null
}

/** Defines what constitutes a successful drill completion. */
export interface DrillTarget {
  /** Number of consecutive perfect loop repetitions required. */
  perfectRepetitions: number
  /** How many repetitions have been completed so far. */
  completedRepetitions: number
}

// ---------------------------------------------------------------------------
// Metronome config
// ---------------------------------------------------------------------------

/** Metronome configuration embedded in the practice session. */
export interface MetronomeConfig {
  /** Beats per minute. */
  bpm: number
  /** Whether the metronome is active. */
  isEnabled: boolean
  /** Number of beats per bar. */
  beatsPerMeasure: number
  /** Rhythmic subdivisions per beat (1 = no subdivision, 2 = eighth notes, etc.). */
  subdivisions: number
}

// ---------------------------------------------------------------------------
// Practice state
// ---------------------------------------------------------------------------

/**
 * The complete, immutable state snapshot managed by the practice reducer.
 * All fields reflect the current phase and progress of a practice session.
 */
export interface PracticeState {
  /** Current lifecycle phase. */
  status: PracticeStatus

  /**
   * Zero-based index of the note currently being targeted.
   * Advances on each successful match.
   */
  currentIndex: number

  /**
   * The active exercise. The notes array drives cursor advancement in OSMD.
   */
  exercise: {
    id: string
    title: string
    notes: Note[]
    musicXml?: string
    bpm?: number
  }

  /**
   * Ring buffer data for the last N detected notes.
   * Managed as a fixed-size array with pointers for Zero-Allocation.
   */
  detectionHistory: {
    items: Array<DetectedNote | null>
    head: number
    size: number
    maxSize: number
  }

  /**
   * How long (ms) the current note has been held in tune.
   * Resets when the note changes or the pitch drifts outside tolerance.
   */
  holdDuration: number

  /** Technique observations from the most recently accepted note. */
  lastObservations: Observation[]

  /** Number of consecutively perfect notes (within ~5 cents). */
  perfectNoteStreak: number

  /** Loop / drill mode configuration. */
  loopRegion: LoopRegion

  /** Metronome configuration for the current session. */
  metronome: MetronomeConfig

  /** Historical record of performance metrics for each note matched in the session. */
  sessionHistory: Array<{
    noteIndex: number;
    pitch: string;
    avgCents: number;
    isPerfect: boolean;
    timestamp: number;
  }>
}

// ---------------------------------------------------------------------------
// Practice events (discriminated union)
// ---------------------------------------------------------------------------

export type PracticeEvent =
  | { type: 'START'; payload?: { startIndex?: number } }
  | { type: 'STOP' }
  | { type: 'RESET' }
  | { type: 'NOTE_DETECTED'; payload: DetectedNote }
  | { type: 'HOLDING_NOTE'; payload: { duration: number } }
  | { type: 'NO_NOTE_DETECTED' }
  | { type: 'NOTE_MATCHED'; payload: { isPerfect: boolean; technique?: NoteTechnique; observations?: Observation[]; timestamp: number } }
  | { type: 'JUMP_TO_NOTE'; payload: { index: number } }
  | { type: 'UPDATE_METRONOME'; payload: Partial<MetronomeConfig> }
  | { type: 'UPDATE_LOOP_REGION'; payload: Partial<LoopRegion> }
