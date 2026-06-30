import { CircularBuffer } from 'mnemonist'

import { type PitchFrame, VIOLIN_TOLERANCE_CENTS } from '../domain/data-structures';
import { type NoteTechnique,type Observation, type SessionReport as DomainSessionReport, SHARED_TECHNIQUE_METRICS,type TechniqueMetrics } from '../technique-types';

/**
 * InternalSessionTracker
 *
 * Tracks historical data for the current session (internal state).
 */
interface InternalSessionTracker {
  bestNote: string | null;
  bestNoteCents: number;
  worstNote: string | null;
  worstNoteCents: number;
  averageStability: number;
  noteCount: number;
}

/**
 * TechniqueAgent
 *
 * Analyzes a window of PitchFrames to extract musical technique insights.
 * Optimized for performance using Mnemonist and manual DSP to ensure ZERO ALLOCATION.
 * All math is inlined to avoid library-induced object allocations or overhead.
 */
export class TechniqueAgent {
  private readonly windowSize: number
  private readonly centsBuffer: CircularBuffer<number>
  private readonly rmsBuffer: CircularBuffer<number>
  private readonly timestampBuffer: CircularBuffer<number>

  // Pre-allocated arrays for single-pass analysis
  private readonly centsArray: Float64Array
  private readonly rmsArray: Float64Array

  private sessionTracker: InternalSessionTracker = {
    bestNote: null,
    bestNoteCents: Infinity,
    worstNote: null,
    worstNoteCents: 0,
    averageStability: 0,
    noteCount: 0,
  }

  constructor(windowSize = 30) {
    this.windowSize = windowSize
    this.centsBuffer = new CircularBuffer(Float64Array, windowSize)
    this.rmsBuffer = new CircularBuffer(Float32Array, windowSize)
    this.timestampBuffer = new CircularBuffer(Float64Array, windowSize)
    this.centsArray = new Float64Array(windowSize)
    this.rmsArray = new Float64Array(windowSize)
  }

  /**
   * Processes a new frame and returns metrics.
   * Uses SHARED_TECHNIQUE_METRICS to avoid object allocation.
   */
  analyze(
    frame: PitchFrame,
    rms: number,
    spectralFlatness: number,
    spectralCentroid: number,
  ): TechniqueMetrics | null {
    this.centsBuffer.push(frame.centsDeviation)
    this.rmsBuffer.push(rms)
    this.timestampBuffer.push(frame.timestamp)

    if (this.centsBuffer.size < this.windowSize) {
      return null
    }

    const n = this.centsBuffer.size
    let sumCents = 0
    let sumRms = 0

    // 1. Transfer buffer data and calculate means
    for (let i = 0; i < n; i++) {
      const c = this.centsBuffer.get(i) ?? 0
      const r = this.rmsBuffer.get(i) ?? 0
      this.centsArray[i] = c
      this.rmsArray[i] = r
      sumCents += c
      sumRms += r
    }

    const meanCents = sumCents / n
    const meanRms = sumRms / n

    // 2. Variance & Trend Analysis
    let sumSqDiffCents = 0
    let sumSqDiffRms = 0
    let sumXY = 0
    let sumX2 = 0

    for (let i = 0; i < n; i++) {
      const valC = this.centsArray[i]
      const diffC = valC - meanCents
      const diffR = this.rmsArray[i] - meanRms
      sumSqDiffCents += diffC * diffC
      sumSqDiffRms += diffR * diffR

      // Linear Regression (Trend)
      sumXY += i * valC
      sumX2 += i * i
    }

    const varianceCents = sumSqDiffCents / (n - 1)
    const stdDevCents = Math.sqrt(varianceCents)
    const varianceRms = sumSqDiffRms / (n - 1)

    // Slope calculation: m = (nΣxy - ΣxΣy) / (nΣx² - (Σx)²)
    const sumX = (n * (n - 1)) / 2
    const denominator = n * sumX2 - sumX * sumX
    const pitchTrend = denominator === 0 ? 0 : (n * sumXY - sumX * sumCents) / denominator

    // 3. Vibrato Analysis (Depth and Crossings)
    let minCents = Infinity
    let maxCents = -Infinity
    let crossings = 0
    let prevVal = this.centsArray[0] - meanCents

    for (let i = 1; i < n; i++) {
      const val = this.centsArray[i]
      if (val < minCents) minCents = val
      if (val > maxCents) maxCents = val

      const currentVal = val - meanCents
      if (prevVal * currentVal < 0) crossings++
      prevVal = currentVal
    }

    const vibratoDepth = maxCents - minCents

    // Calculate actual rate based on timestamps in the sliding window
    const firstTimestamp = this.timestampBuffer.get(0) ?? 0
    const lastTimestamp = this.timestampBuffer.get(n - 1) ?? 0
    const duration = lastTimestamp - firstTimestamp
    const vibratoRate = duration > 0 ? crossings / (2 * duration) : 0

    // 4. Bow Stability (based on RMS variance)
    // varianceRms is already calculated. High variance means unstable bowing.
    const bowStability = Math.max(0, 1 - Math.sqrt(varianceRms) * 20) // Normalized 0-1

    // 5. Update shared instance (ZERO ALLOCATION)
    const m = SHARED_TECHNIQUE_METRICS
    m.pitchVariance = varianceCents
    m.pitchStdDev = stdDevCents
    m.pitchTrend = pitchTrend
    m.isStable = stdDevCents < VIOLIN_TOLERANCE_CENTS
    m.vibratoDepth = vibratoDepth
    m.vibratoRate = vibratoRate
    m.rmsStability = bowStability
    m.spectralFlatness = spectralFlatness
    m.spectralCentroid = spectralCentroid

    return m
  }

  /**
   * Generates observations for a specific technique snapshot.
   * NOTE: This should NOT be called in the per-frame hot-path to avoid allocations.
   * It is intended for discrete feedback events (e.g., when a note is matched).
   */
  generateObservations(metrics: TechniqueMetrics, timestamp: number): Observation[] {
    const obs: Observation[] = []
    if (Math.abs(metrics.pitchStdDev) > VIOLIN_TOLERANCE_CENTS) {
      obs.push({ category: 'intonation', severity: 'warning', message: 'Afinación inestable', timestamp })
    }
    if (metrics.spectralFlatness > 0.4) {
      obs.push({ category: 'tone', severity: 'info', message: 'Tono con aire', timestamp })
    }
    if (metrics.spectralCentroid > 2500) {
      obs.push({ category: 'tone', severity: 'info', message: 'Sonido brillante/metálico', timestamp })
    }
    if (metrics.vibratoDepth > 10 && metrics.vibratoRate > 4 && metrics.vibratoRate < 7) {
      obs.push({ category: 'vibrato', severity: 'info', message: 'Buen vibrato', timestamp })
    }
    if (metrics.rmsStability < 0.6) {
      obs.push({ category: 'bowing', severity: 'warning', message: 'Arqueo inestable', timestamp })
    }
    return obs
  }

  /**
   * Updates session statistics with a newly completed note.
   */
  recordNote(noteName: string, avgCents: number, stability: number): void {
    const absCents = Math.abs(avgCents);
    const r = this.sessionTracker;

    if (absCents < r.bestNoteCents) {
      r.bestNote = noteName
      r.bestNoteCents = absCents
    }

    if (absCents > r.worstNoteCents) {
      r.worstNote = noteName
      r.worstNoteCents = absCents
    }

    r.averageStability = (r.averageStability * r.noteCount + stability) / (r.noteCount + 1)
    r.noteCount++
  }

  /**
   * Generates a unique collection of observations for a specific technique snapshot.
   */

  getSessionReport(): Readonly<SessionReport & { noteCount: number; bestNoteCents: number; worstNoteCents: number }> {
    const r = this.sessionTracker;
    return {
      bestNote: r.bestNote,
      bestNoteCents: r.bestNoteCents,
      worstNote: r.worstNote,
      worstNoteCents: r.worstNoteCents,
      averageStability: r.averageStability,
      noteCount: r.noteCount,
    };
  }

  getRecommendation(): string {
    const r = this.sessionTracker;
    if (r.noteCount === 0) return 'Comienza a tocar para recibir recomendaciones.';

    if (r.averageStability < 0.7) {
      return 'Enfócate en mantener el arco constante y la presión uniforme.'
    }

    if (r.worstNoteCents > 15) {
      return `La nota ${r.worstNote ?? ''} está dándote problemas. Intenta practicarla lentamente.`
    }

    if (r.bestNoteCents < 5 && r.averageStability > 0.9) {
      return '¡Excelente técnica! Intenta añadir vibrato para mayor expresividad.'
    }

    return 'Sigue así, mantén la concentración en la afinación.'
  }

  clear(): void {
    this.centsBuffer.clear()
    this.rmsBuffer.clear()
    this.timestampBuffer.clear()
  }

  resetSession(): void {
    this.sessionTracker = {
      bestNote: null,
      bestNoteCents: Infinity,
      worstNote: null,
      worstNoteCents: 0,
      averageStability: 0,
      noteCount: 0,
    }
  }
}
