import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AudioPipeline } from './audio-pipeline'
import { AudioCapturePort } from '../ports/audio.port'
import { firstValueFrom, take, toArray } from 'rxjs'

describe('AudioPipeline', () => {
  let mockCapturePort: any

  beforeEach(() => {
    mockCapturePort = {
      sampleRate: 44100,
      initialize: vi.fn().mockResolvedValue(undefined),
      startStream: vi.fn(),
      stopStream: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      getCurrentTime: vi.fn().mockReturnValue(1.0),
    }
  })

  it('should process frames and emit pitch events', async () => {
    const pipeline = new AudioPipeline()

    const pitchPromise = firstValueFrom(pipeline.pitchFrame$)

    // We need to push multiple frames to get past the segmenter's debounce logic
    for (let i = 0; i < 15; i++) {
      pipeline.push({
        pitchHz: 440,
        confidence: 0.9,
        rms: 0.1,
        spectralFlatness: 0.1,
        spectralCentroid: 1000,
        timestamp: 1.0 + i * 0.01,
      })
    }

    const frame = await pitchPromise
    expect(frame).toBeDefined()
    expect(frame.timestamp).toBeGreaterThanOrEqual(1.0)
    expect(frame.frequency).toBe(440)
  })

  it('should cleanup segmenter actor on destroy()', () => {
    const pipeline = new AudioPipeline()
    // Accessing private for test verification
    const stopSpy = vi.spyOn((pipeline as any).segmenter, 'stop')

    pipeline.destroy()
    expect(stopSpy).toHaveBeenCalled()
  })
})
