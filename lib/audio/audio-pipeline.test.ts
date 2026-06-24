import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AudioPipeline } from './audio-pipeline'
import { AudioCapturePort } from '../ports/audio.port'
import { firstValueFrom, take, toArray } from 'rxjs'

describe('AudioPipeline', () => {
  it('should process frames and emit pitch events when note is detected', async () => {
    const pipeline = new AudioPipeline()

    const pitchPromise = firstValueFrom(pipeline.pitchFrame$)

    // We need to send enough events to trigger the NOTE state in the segmenter
    // noteSegmenterMachine usually needs multiple frames of confidence
    for (let i = 0; i < 10; i++) {
      pipeline.push({
        pitchHz: 440,
        confidence: 0.9,
        rms: 0.1,
        spectralFlatness: 0.1,
        spectralCentroid: 1000,
        timestamp: Date.now() / 1000,
      })
    }

    const frame = await pitchPromise
    expect(frame).toBeDefined()
    // It emits the SHARED_PITCH_FRAME which has a 'frequency' property (branded Hertz)
    expect((frame as any).frequency).toBe(440)
  })

  it('should stop segmenter on destroy()', () => {
    const pipeline = new AudioPipeline()
    const stopSpy = vi.spyOn((pipeline as any).segmenter, 'stop')

    pipeline.destroy()
    expect(stopSpy).toHaveBeenCalled()
  })
})
