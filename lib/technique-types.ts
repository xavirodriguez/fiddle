/**
 * Technique Types
 *
 * Domain types for violin technique analysis.
 * Pure types — no external dependencies.
 */

// ---------------------------------------------------------------------------
// Observation
// ---------------------------------------------------------------------------

/** Possible categories of technique feedback. */
export type ObservationCategory =
  | 'intonation'
  | 'tone'
  | 'rhythm'
  | 'bowing'
  | 'vibrato'

/** Severity level for a technique observation. */
export type ObservationSeverity = 'info' | 'warning' | 'error'

/**
 * A single technique observation produced during note evaluation.
 * Immutable once created.
 */
export interface Observation {
  readonly category: ObservationCategory
  readonly severity: ObservationSeverity
  /** Human-readable description of the observation. */
  readonly message: string
  /** AudioContext.currentTime when this was recorded. */
  readonly timestamp: number
}

// ---------------------------------------------------------------------------
// NoteTechnique
// ---------------------------------------------------------------------------

/**
 * TechniqueMetrics
 *
 * Quantitative analysis of a note's performance.
 * Designed to be POJO-serializable for Zustand/Persistence.
 */
export interface TechniqueMetrics {
  pitchVariance: number;
  pitchStdDev: number;
  pitchTrend: number; // Slope of linear regression (cents/frame)
  isStable: boolean;
  vibratoDepth: number; // In cents
  vibratoRate: number; // In Hz (simplified)
  rmsStability: number;
  spectralFlatness: number;
  spectralCentroid: number;
}

/**
 * Pre-allocated shared object to avoid GC pressure in the hot path.
 * @internal
 */
export const SHARED_TECHNIQUE_METRICS: TechniqueMetrics = {
  pitchVariance: 0,
  pitchStdDev: 0,
  pitchTrend: 0,
  isStable: false,
  vibratoDepth: 0,
  vibratoRate: 0,
  rmsStability: 0,
  spectralFlatness: 0,
  spectralCentroid: 0,
};

/**
 * Aggregate technique data for a single matched note.
 * Placeholder shape — will be enriched as the analysis engine evolves.
 */
export interface NoteTechnique {
  /** Average cents deviation over the hold duration. */
  averageCents: number
  /** Peak deviation during the hold. */
  peakCents: number
  /** RMS volume during the hold (0–1). */
  rmsVolume: number
  /** Whether the note was held long enough without pitch drift. */
  isSustained: boolean
}
