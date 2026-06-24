import * as ss from 'simple-statistics';
import { PitchFrame, VIOLIN_TOLERANCE_CENTS } from '../domain/data-structures';
import { CircularBuffer } from 'mnemonist';

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
};

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

  constructor(windowSize = 30) {
    this.windowSize = windowSize;
    this.centsBuffer = new CircularBuffer(Float64Array, windowSize);
    this.rmsBuffer = new CircularBuffer(Float64Array, windowSize);
    this.centsArray = new Float64Array(windowSize);
    this.rmsArray = new Float64Array(windowSize);
  }

  /**
   * Processes a new frame and returns metrics if the window is full.
   * Uses SHARED_TECHNIQUE_METRICS to avoid object allocation.
   */
  analyze(frame: PitchFrame, rms: number): TechniqueMetrics | null {
    this.centsBuffer.push(frame.centsDeviation);
    this.rmsBuffer.push(rms);

    if (this.centsBuffer.size < this.windowSize) {
      return null;
    }

    // Copy to pre-allocated typed arrays for ss performance
    // CircularBuffer iterates from oldest to newest, which is what we need for trend.
    this.centsBuffer.forEach((val, i) => {
      this.centsArray[i] = val;
    });
    this.rmsBuffer.forEach((val, i) => {
      this.rmsArray[i] = val;
    });

    // 1. Pitch Stability Analysis
    const variance = ss.variance(this.centsArray);
    const stdDev = ss.standardDeviation(this.centsArray);

    // 2. RMS (Volume) Stability
    const rmsVariance = ss.variance(this.rmsArray);

    // 3. Pitch Trend Analysis (Linear Regression slope)
    // ss.linearRegression needs [[x, y]], which allocates.
    // We use a manual zero-allocation slope calculation for uniform x=[0...n-1].
    const pitchTrend = this.calculateSlope(this.centsArray);

    // 4. Vibrato Analysis (Simplified: use range as depth proxy)
    const minCents = ss.min(this.centsArray);
    const maxCents = ss.max(this.centsArray);
    const depth = maxCents - minCents;

    // Update shared instance
    const m = SHARED_TECHNIQUE_METRICS;
    m.pitchVariance = variance;
    m.pitchStdDev = stdDev;
    m.pitchTrend = pitchTrend;
    m.isStable = stdDev < VIOLIN_TOLERANCE_CENTS;
    m.vibratoDepth = depth;
    m.vibratoRate = 0; // Future: extract from autocovariance/FFT
    m.rmsStability = Math.max(0, 1 - rmsVariance * 100);

    return m;
  }

  /**
   * Manual linear regression slope for uniform sampling.
   * m = (n*sum(xy) - sum(x)*sum(y)) / (n*sum(x^2) - (sum(x))^2)
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

  clear(): void {
    this.centsBuffer.clear();
    this.rmsBuffer.clear();
  }
}
