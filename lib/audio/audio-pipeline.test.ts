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
    const pipeline = new AudioPipeline(mockCapturePort)

    // Simulate audio data
    const buffer = new Float32Array(2048).fill(0.1)

    // We need to trigger the callback passed to startStream
    let frameCallback: (buf: Float32Array) => void = () => {}
    mockCapturePort.startStream.mockImplementation((cb: any) => {
      frameCallback = cb
      return Promise.resolve()
    })

    await pipeline.start()

    const pitchPromise = firstValueFrom(pipeline.pitch$)
    frameCallback(buffer)

    const frame = await pitchPromise
    expect(frame).toBeDefined()
    expect(frame.timestamp).toBe(1.0)
  })

  it('should reset segmenter actor on reset()', () => {
    const pipeline = new AudioPipeline(mockCapturePort)
    // Accessing private for test verification
    const sendSpy = vi.spyOn((pipeline as any).segmenterActor, 'send')

    pipeline.reset()
    expect(sendSpy).toHaveBeenCalledWith({ type: 'RESET' })
  })
})
