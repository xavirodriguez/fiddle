import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AudioPipeline, RawPitchEvent } from './audio-pipeline'

describe('AudioPipeline', () => {
  let pipeline: AudioPipeline;

  beforeEach(() => {
    pipeline = new AudioPipeline()
  })

  it('should process frames and emit pitch events when in NOTE state', async () => {
    const events: any[] = [];
    // Note: We are subscribing to a stream that emits the SAME object.
    // To test history we would need to clone, but here we just check the latest state.
    pipeline.pitchFrame$.subscribe(frame => events.push(frame.frequency));

    const rawEvent: RawPitchEvent = {
      pitchHz: 440,
      confidence: 0.9,
      rms: 0.1,
      spectralFlatness: 0.1,
      spectralCentroid: 1000,
      timestamp: 1.0
    };

    pipeline.push(rawEvent); // 1
    pipeline.push(rawEvent); // 2
    pipeline.push(rawEvent); // 3
    pipeline.push(rawEvent); // 4 -> NOTE
    pipeline.push(rawEvent); // 5 -> Emit

    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toBe(440);
  })

  it('should calculate centsDeviation correctly', async () => {
    let capturedCents = -100;
    pipeline.pitchFrame$.subscribe(frame => {
        capturedCents = frame.centsDeviation;
    });

    const rawEvent: RawPitchEvent = {
      pitchHz: 441, // Slightly sharp from A4 (440Hz)
      confidence: 0.9,
      rms: 0.1,
      spectralFlatness: 0.1,
      spectralCentroid: 1000,
      timestamp: 1.0
    };

    for(let i=0; i<10; i++) pipeline.push(rawEvent);

    expect(capturedCents).toBeGreaterThan(0);
    expect(capturedCents).toBeLessThan(10);
  })

  it('should include technique metrics after window is full', async () => {
    let techniquePresent = false;
    pipeline.pitchFrame$.subscribe(frame => {
        if (frame.technique) techniquePresent = true;
    });

    const rawEvent: RawPitchEvent = {
      pitchHz: 440,
      confidence: 0.9,
      rms: 0.1,
      spectralFlatness: 0.1,
      spectralCentroid: 1000,
      timestamp: 1.0
    };

    for (let i = 0; i < 40; i++) {
        pipeline.push(rawEvent);
    }

    expect(techniquePresent).toBe(true);
  })
})
