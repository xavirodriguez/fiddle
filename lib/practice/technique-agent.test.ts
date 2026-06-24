import { describe, it, expect, beforeEach } from 'vitest';
import { TechniqueAgent } from './technique-agent';
import { PitchFrame } from '../domain/data-structures';
import { Hertz, Cents } from '../domain/musical-domain';

describe('TechniqueAgent', () => {
  let agent: TechniqueAgent;
  const WINDOW_SIZE = 5;

  beforeEach(() => {
    agent = new TechniqueAgent(WINDOW_SIZE);
  });

  const createFrame = (cents: number): PitchFrame => ({
    frequency: 440 as Hertz,
    centsDeviation: cents as Cents,
    confidence: 1,
    timestamp: Date.now() / 1000,
  });

  it('should return null until the window is full', () => {
    for (let i = 0; i < WINDOW_SIZE - 1; i++) {
      expect(agent.analyze(createFrame(0), 0.1)).toBeNull();
    }
    expect(agent.analyze(createFrame(0), 0.1)).not.toBeNull();
  });

  it('should calculate stability correctly for a stable note', () => {
    for (let i = 0; i < WINDOW_SIZE - 1; i++) {
      agent.analyze(createFrame(2), 0.1);
    }
    const metrics = agent.analyze(createFrame(2), 0.1);
    expect(metrics?.isStable).toBe(true);
    expect(metrics?.pitchStdDev).toBe(0);
    expect(metrics?.pitchTrend).toBe(0);
  });

  it('should detect instability', () => {
    agent.analyze(createFrame(0), 0.1);
    agent.analyze(createFrame(20), 0.1);
    agent.analyze(createFrame(-20), 0.1);
    agent.analyze(createFrame(40), 0.1);
    const metrics = agent.analyze(createFrame(-40), 0.1);

    expect(metrics?.isStable).toBe(false);
    expect(metrics?.pitchStdDev).toBeGreaterThan(15);
  });

  it('should calculate linear trend (slope)', () => {
    // Upward trend: 0, 2, 4, 6, 8 cents
    agent.analyze(createFrame(0), 0.1);
    agent.analyze(createFrame(2), 0.1);
    agent.analyze(createFrame(4), 0.1);
    agent.analyze(createFrame(6), 0.1);
    const metrics = agent.analyze(createFrame(8), 0.1);

    expect(metrics?.pitchTrend).toBeCloseTo(2); // 2 cents per frame
  });

  it('should calculate RMS stability', () => {
    // Constant volume
    for (let i = 0; i < WINDOW_SIZE - 1; i++) {
      agent.analyze(createFrame(0), 0.5);
    }
    let metrics = agent.analyze(createFrame(0), 0.5);
    expect(metrics?.rmsStability).toBe(1);

    // Fluctuating volume
    agent.analyze(createFrame(0), 0.1);
    agent.analyze(createFrame(0), 0.9);
    agent.analyze(createFrame(0), 0.1);
    agent.analyze(createFrame(0), 0.9);
    metrics = agent.analyze(createFrame(0), 0.1);
    expect(metrics?.rmsStability).toBeLessThan(1);
  });
});
