import * as ss from 'simple-statistics';
import { PitchFrame } from '../domain/data-structures';
import { Cents } from '../domain/musical-domain';

/**
 * TechniqueMetrics
 *
 * Quantitative analysis of a note's performance.
 */
export interface TechniqueMetrics {
  pitchVariance: number;
  pitchStdDev: number;
  isStable: boolean;
  vibratoDepth: number; // In cents
  vibratoRate: number;  // In Hz (simplified)
  rmsStability: number;
}

/**
 * TechniqueAgent
 *
 * Analyzes a window of PitchFrames to extract musical technique insights.
 */
export class TechniqueAgent {
  private readonly windowSize: number;
  private centsBuffer: number[] = [];
  private rmsBuffer: number[] = [];

  constructor(windowSize = 30) {
    this.windowSize = windowSize;
  }

  /**
   * Processes a new frame and returns metrics if the window is full.
   */
  analyze(frame: PitchFrame, rms: number): TechniqueMetrics | null {
    this.centsBuffer.push(frame.centsDeviation);
    this.rmsBuffer.push(rms);

    if (this.centsBuffer.length > this.windowSize) {
      this.centsBuffer.shift();
      this.rmsBuffer.shift();
    }

    if (this.centsBuffer.length < this.windowSize) {
      return null;
    }

    // 1. Pitch Stability Analysis
    const variance = ss.variance(this.centsBuffer);
    const stdDev = ss.standardDeviation(this.centsBuffer);

    // 2. RMS (Volume) Stability
    const rmsVariance = ss.variance(this.rmsBuffer);

    // 3. Vibrato Analysis (Simplified: use range as depth proxy)
    const minCents = ss.min(this.centsBuffer);
    const maxCents = ss.max(this.centsBuffer);
    const depth = maxCents - minCents;

    return {
      pitchVariance: variance,
      pitchStdDev: stdDev,
      isStable: stdDev < 15, // Using VIOLIN_TOLERANCE_CENTS as baseline
      vibratoDepth: depth,
      vibratoRate: 0, // Would require FFT or zero-crossing on the buffer
      rmsStability: 1 - Math.min(rmsVariance * 100, 1),
    };
  }

  clear(): void {
    this.centsBuffer = [];
    this.rmsBuffer = [];
  }
}
