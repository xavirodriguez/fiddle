import { CircularBuffer } from 'mnemonist';

import { type PitchFrame, VIOLIN_TOLERANCE_CENTS } from '../domain/data-structures';
import { type NoteTechnique,type Observation, type SessionReport, SHARED_TECHNIQUE_METRICS,type TechniqueMetrics } from '../technique-types';

/**
 * TechniqueAgent
 *
 * Analyzes a window of PitchFrames to extract musical technique insights.
 * Optimized for performance using Mnemonist and manual DSP to ensure ZERO ALLOCATION.
 * All math is inlined to avoid library-induced object allocations or overhead.
 */
export class TechniqueAgent {
  private readonly windowSize: number;
  private readonly centsBuffer: CircularBuffer<number>;
  private readonly rmsBuffer: CircularBuffer<number>;

  // Pre-allocated arrays for single-pass analysis
  private readonly centsArray: Float64Array;
  private readonly rmsArray: Float64Array;

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

    const n = this.windowSize;
    let sumCents = 0;
    let sumRms = 0;

    // 1. Transfer buffer data and calculate means
    for (let i = 0; i < n; i++) {
      const c = this.centsBuffer.get(i) ?? 0;
      const r = this.rmsBuffer.get(i) ?? 0;
      this.centsArray[i] = c;
      this.rmsArray[i] = r;
      sumCents += c;
      sumRms += r;
    }

    const meanCents = sumCents / n;
    const meanRms = sumRms / n;

    // 2. Variance & Trend Analysis
    let sumSqDiffCents = 0;
    let sumSqDiffRms = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < n; i++) {
      const valC = this.centsArray[i];
      const diffC = valC - meanCents;
      const diffR = this.rmsArray[i] - meanRms;
      sumSqDiffCents += diffC * diffC;
      sumSqDiffRms += diffR * diffR;

      // Linear Regression (Trend)
      sumXY += i * valC;
      sumX2 += i * i;
    }

    const varianceCents = sumSqDiffCents / (n - 1);
    const stdDevCents = Math.sqrt(varianceCents);
    const varianceRms = sumSqDiffRms / (n - 1);

    // Slope calculation: m = (nΣxy - ΣxΣy) / (nΣx² - (Σx)²)
    const sumX = (n * (n - 1)) / 2;
    const denominator = n * sumX2 - sumX * sumX;
    const pitchTrend = denominator === 0 ? 0 : (n * sumXY - sumX * sumCents) / denominator;

    // 3. Vibrato Analysis (Depth and Crossings)
    let minCents = Infinity;
    let maxCents = -Infinity;
    let crossings = 0;
    let prevVal = this.centsArray[0] - meanCents;

    for (let i = 1; i < n; i++) {
      const val = this.centsArray[i];
      if (val < minCents) minCents = val;
      if (val > maxCents) maxCents = val;

      const currentVal = val - meanCents;
      if (prevVal * currentVal < 0) crossings++;
      prevVal = currentVal;
    }

    const vibratoDepth = maxCents - minCents;
    const vibratoRate = (crossings * 60) / (2 * n); // Assuming 60fps

    // 4. Update shared instance (ZERO ALLOCATION)
    const m = SHARED_TECHNIQUE_METRICS;
    m.pitchVariance = varianceCents;
    m.pitchStdDev = stdDevCents;
    m.pitchTrend = pitchTrend;
    m.isStable = stdDevCents < VIOLIN_TOLERANCE_CENTS;
    m.vibratoDepth = vibratoDepth;
    m.vibratoRate = vibratoRate;
    m.rmsStability = Math.max(0, 1 - varianceRms * 100);
    m.spectralFlatness = spectralFlatness;
    m.spectralCentroid = spectralCentroid;

    return m;
  }

  generateObservations(metrics: TechniqueMetrics, timestamp: number): Observation[] {
    const obs: Observation[] = [];
    if (Math.abs(metrics.pitchStdDev) > VIOLIN_TOLERANCE_CENTS) {
      obs.push({ category: 'intonation', severity: 'warning', message: 'Afinación inestable', timestamp });
    }
    if (metrics.spectralFlatness > 0.4) {
      obs.push({ category: 'tone', severity: 'info', message: 'Tono con aire', timestamp });
    }
    if (metrics.spectralCentroid > 2500) {
      obs.push({ category: 'tone', severity: 'info', message: 'Sonido brillante/metálico', timestamp });
    }
    if (metrics.vibratoDepth > 10 && metrics.vibratoRate > 4 && metrics.vibratoRate < 7) {
      obs.push({ category: 'vibrato', severity: 'info', message: 'Buen vibrato', timestamp });
    }
    return obs;
  }

  /**
   * Calculates a SessionReport based on session history.
   */
  calculateSessionReport(history: Array<{ pitch: string; avgCents: number; isPerfect: boolean }>): SessionReport {
    if (history.length === 0) {
      return {
        bestNote: null,
        bestNoteAccuracy: 100,
        worstNote: null,
        worstNoteAccuracy: 0,
        overallStability: 0,
        recommendation: 'Comienza a practicar para recibir recomendaciones.'
      };
    }

    let bestNote = history[0].pitch;
    let bestAcc = Math.abs(history[0].avgCents);
    let worstNote = history[0].pitch;
    let worstAcc = Math.abs(history[0].avgCents);
    let perfectCount = 0;

    for (const entry of history) {
      const acc = Math.abs(entry.avgCents);
      if (acc < bestAcc) {
        bestAcc = acc;
        bestNote = entry.pitch;
      }
      if (acc > worstAcc) {
        worstAcc = acc;
        worstNote = entry.pitch;
      }
      if (entry.isPerfect) perfectCount++;
    }

    const report: SessionReport = {
      bestNote,
      bestNoteAccuracy: bestAcc,
      worstNote,
      worstNoteAccuracy: worstAcc,
      overallStability: perfectCount / history.length,
      recommendation: ''
    };

    report.recommendation = this.getRecommendation(report);
    return report;
  }

  /**
   * Generates a human-readable recommendation based on aggregate session metrics.
   */
  getRecommendation(report: SessionReport): string {
    if (report.overallStability < 0.5) {
      return 'Enfócate en mantener el arco constante y una presión estable.';
    }
    if (report.worstNoteAccuracy > 15) {
      return `La nota ${report.worstNote} necesita más precisión. Practica escalas lentamente.`;
    }
    if (report.bestNoteAccuracy < 5 && report.overallStability > 0.8) {
      return '¡Excelente estabilidad! Prueba a aumentar el tempo del ejercicio.';
    }
    return 'Buen progreso. Mantén la concentración en la afinación de las notas agudas.';
  }

  clear(): void {
    this.centsBuffer.clear();
    this.rmsBuffer.clear();
  }
}
