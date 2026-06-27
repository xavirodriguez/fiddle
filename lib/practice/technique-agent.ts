import { CircularBuffer } from 'mnemonist';

import { type PitchFrame, VIOLIN_TOLERANCE_CENTS } from '../domain/data-structures';
import { type Observation, SHARED_TECHNIQUE_METRICS,type TechniqueMetrics } from '../technique-types';

/**
 * SessionReport
 *
 * Summary of the practice session's technical performance.
 */
export interface SessionReport {
  bestNote: string | null;
  worstNote: string | null;
  averageCentsDeviation: number;
  totalNotesMatched: number;
}

/**
 * TechniqueAgent
 *
 * Analyzes a window of PitchFrames to extract musical technique insights.
 * Optimized for performance using Mnemonist and Simple-Statistics.
 */
export class TechniqueAgent {
  private readonly windowSize: number;
  private readonly centsBuffer: CircularBuffer<number>;
  private readonly rmsBuffer: CircularBuffer<number>;

  // Pre-allocated arrays for Simple-Statistics compatibility without per-frame allocation
  private readonly centsArray: Float64Array;
  private readonly rmsArray: Float64Array;

  // Session-wide statistics
  private readonly sessionNoteData = new Map<string, { sumCents: number; count: number }>();

  constructor(windowSize = 30) {
    this.windowSize = windowSize;
    this.centsBuffer = new CircularBuffer(Float64Array, windowSize);
    this.rmsBuffer = new CircularBuffer(Float32Array, windowSize);
    this.centsArray = new Float64Array(windowSize);
    this.rmsArray = new Float64Array(windowSize);
  }

  /**
   * Processes a new frame and returns metrics if the window is full.
   * Uses SHARED_TECHNIQUE_METRICS to avoid object allocation.
   */
  analyze(
    frame: PitchFrame,
    rms: number,
    spectralFlatness: number,
    spectralCentroid: number
  ): TechniqueMetrics | null {
    this.centsBuffer.push(frame.centsDeviation);
    this.rmsBuffer.push(rms);

    if (this.centsBuffer.size < this.windowSize) {
      return null;
    }

    // Copy to pre-allocated arrays for ss compatibility
    this.centsBuffer.forEach((val, i) => {
      this.centsArray[i] = val;
    });
    this.rmsBuffer.forEach((val, i) => {
      this.rmsArray[i] = val;
    });

    // 1. Pitch Stability Analysis
    const variance = this.calculateVariance(this.centsArray);
    const stdDev = Math.sqrt(variance);

    // 2. RMS (Volume) Stability
    const rmsVariance = this.calculateVariance(this.rmsArray);

    // 3. Pitch Trend Analysis (Linear Regression slope)
    const pitchTrend = this.calculateSlope(this.centsArray);

    // 4. Vibrato Analysis
    let minCents = Infinity;
    let maxCents = -Infinity;
    for (let i = 0; i < this.windowSize; i++) {
      const val = this.centsArray[i];
      if (val < minCents) minCents = val;
      if (val > maxCents) maxCents = val;
    }
    const depth = maxCents - minCents;
    const rate = this.calculateVibratoRate(this.centsArray);

    // Update shared instance
    const m = SHARED_TECHNIQUE_METRICS;
    m.pitchVariance = variance;
    m.pitchStdDev = stdDev;
    m.pitchTrend = pitchTrend;
    m.isStable = stdDev < VIOLIN_TOLERANCE_CENTS;
    m.vibratoDepth = depth;
    m.vibratoRate = rate;
    m.rmsStability = Math.max(0, 1 - rmsVariance * 100);
    m.spectralFlatness = spectralFlatness;
    m.spectralCentroid = spectralCentroid;

    return m;
  }

  /**
   * Generates a list of observations based on current metrics.
   * Note: This potentially allocates Observations, so it should be called
   * on discrete events (like note matched) or throttled, not at 60fps.
   */
  generateObservations(metrics: TechniqueMetrics, timestamp: number): Observation[] {
    const obs: Observation[] = [];

    // 1. Intonation
    if (Math.abs(metrics.pitchStdDev) > VIOLIN_TOLERANCE_CENTS) {
      obs.push({
        category: 'intonation',
        severity: 'warning',
        message: 'Afinación inestable',
        timestamp,
      });
    }

    // 2. Timbre / Tone
    // Spectral Flatness: 0 (pure tone) to 1 (white noise)
    // For violin, a very flat signal (>0.4) often indicates excessive air or scratching.
    if (metrics.spectralFlatness > 0.4) {
      obs.push({
        category: 'tone',
        severity: 'info',
        message: 'Tono con aire',
        timestamp,
      });
    }

    // Spectral Centroid: "Brightness"
    // High centroid (>2000Hz) for low notes might mean excessive "metallic" sound.
    if (metrics.spectralCentroid > 2500) {
      obs.push({
        category: 'tone',
        severity: 'info',
        message: 'Sonido brillante/metálico',
        timestamp,
      });
    }

    // 3. Vibrato
    if (metrics.vibratoDepth > 10 && metrics.vibratoRate > 4 && metrics.vibratoRate < 7) {
      obs.push({
        category: 'vibrato',
        severity: 'info',
        message: 'Buen vibrato',
        timestamp,
      });
    } else if (metrics.vibratoDepth > 15 && metrics.vibratoRate > 8) {
      obs.push({
        category: 'vibrato',
        severity: 'warning',
        message: 'Vibrato demasiado rápido/nervioso',
        timestamp,
      });
    }

    return obs;
  }

  /**
   * Calculates vibrato rate using zero-crossings of the detrended signal.
   * Simplified: assumes ~60fps processing.
   */
  private calculateVibratoRate(data: Float64Array): number {
    const n = data.length;
    if (n < 2) return 0;

    let mean = 0;
    for (let i = 0; i < n; i++) mean += data[i];
    mean /= n;

    let crossings = 0;
    let prevVal = data[0] - mean;

    for (let i = 1; i < n; i++) {
      const currentVal = data[i] - mean;
      if (prevVal * currentVal < 0) {
        crossings++;
      }
      prevVal = currentVal;
    }

    // Rate = crossings / (2 * duration)
    // Assuming 60fps, duration = n / 60
    return (crossings * 60) / (2 * n);
  }

  private calculateVariance(data: Float64Array): number {
    const n = data.length;
    if (n < 2) return 0;
    let mean = 0;
    for (let i = 0; i < n; i++) mean += data[i];
    mean /= n;
    let sumSqDiff = 0;
    for (let i = 0; i < n; i++) {
      const diff = data[i] - mean;
      sumSqDiff += diff * diff;
    }
    return sumSqDiff / (n - 1); // Sample variance
  }

  /**
   * Compiles a recommendation based on session performance.
   */
  getRecommendation(): string {
    const report = this.getSessionReport();
    if (report.totalNotesMatched === 0) return 'Sigue practicando para obtener feedback.';

    if (report.averageCentsDeviation < 5) {
      return '¡Excelente afinación! Prueba a aumentar el tempo o trabajar en el vibrato.';
    }

    const worstNote = report.worstNote ?? '';
    if (worstNote) {
      return `Tu nota más desafiada es ${worstNote}. Intenta practicar escalas que la incluyan.`;
    }

    return 'Buen progreso. Mantén la estabilidad en las notas largas.';
  }

  /**
   * Manual linear regression slope for uniform sampling.
   */
  private calculateSlope(data: Float64Array): number {
    const n = data.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = data[i];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }

    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) return 0;

    return (n * sumXY - sumX * sumY) / denominator;
  }

  /**
   * Records the result of a matched note to track session-wide progress.
   */
  recordNoteResult(noteName: string, avgCents: number): void {
    const absCents = Math.abs(avgCents);
    const existing = this.sessionNoteData.get(noteName) ?? { sumCents: 0, count: 0 };
    existing.sumCents += absCents;
    existing.count += 1;
    this.sessionNoteData.set(noteName, existing);
  }

  /**
   * Compiles a report of the current practice session.
   */
  getSessionReport(): SessionReport {
    let bestNote: string | null = null;
    let worstNote: string | null = null;
    let minError = Infinity;
    let maxError = -Infinity;
    let totalCents = 0;
    let totalCount = 0;

    this.sessionNoteData.forEach((data, note) => {
      const avgError = data.sumCents / data.count;
      totalCents += data.sumCents;
      totalCount += data.count;

      if (avgError < minError) {
        minError = avgError;
        bestNote = note;
      }

      if (avgError > maxError) {
        maxError = avgError;
        worstNote = note;
      }
    });

    return {
      bestNote,
      worstNote,
      averageCentsDeviation: totalCount > 0 ? totalCents / totalCount : 0,
      totalNotesMatched: totalCount,
    };
  }

  clear(): void {
    this.centsBuffer.clear();
    this.rmsBuffer.clear();
    this.sessionNoteData.clear();
  }
}
