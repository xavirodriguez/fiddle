import { Result, ok, err } from 'neverthrow'
import { AppError, ERROR_CODES } from '../../errors/app-error'
import { AudioCapturePort, AudioDeviceEvent } from '../../ports/audio.port'

/**
 * WebAudioAdapter
 *
 * Implements AudioCapturePort using native Web Audio API.
 */
export class WebAudioAdapter implements AudioCapturePort {
  private audioContext: AudioContext | null = null
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private filter: BiquadFilterNode | null = null
  private compressor: DynamicsCompressorNode | null = null
  private workletNode: AudioWorkletNode | null = null
  private eventCallbacks: Map<AudioDeviceEvent, ((data?: unknown) => void)[]> = new Map()

  constructor() {}

  async initialize(): Promise<void> {
    const result = await this.initializeSafe()
    if (result.isErr()) {
      this.emit('error', result.error)
      throw result.error
    }
  }

  private async initializeSafe(): Promise<Result<void, AppError>> {
    if (this.audioContext) return ok(undefined)

    try {
      this.audioContext = new AudioContext()

      // Load the worklet from public
      await this.audioContext.audioWorklet.addModule('/worklets/CaptureProcessor.js')

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })

      const source = this.audioContext.createMediaStreamSource(this.stream)
      this.source = source

      const filter = this.audioContext.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 1400
      filter.Q.value = 0.5
      this.filter = filter

      const compressor = this.audioContext.createDynamicsCompressor()
      compressor.threshold.value = -24
      compressor.knee.value = 30
      compressor.ratio.value = 12
      compressor.attack.value = 0.003
      compressor.release.value = 0.25
      this.compressor = compressor

      source.connect(filter)
      filter.connect(compressor)

      this.emit('statechange', 'initialized')
      return ok(undefined)
    } catch (e) {
      return err(
        new AppError({
          message: e instanceof Error ? e.message : 'Unknown hardware error',
          code: ERROR_CODES.DATA_VALIDATION_ERROR,
        })
      )
    }
  }

  public updateFilterFrequency(hz: number): void {
    if (this.filter && this.audioContext) {
      this.filter.frequency.setTargetAtTime(hz, this.audioContext.currentTime, 0.1)
    }
  }

  async startStream(onFrame: (frame: Float32Array) => void): Promise<void> {
    if (!this.audioContext || !this.compressor) {
      await this.initialize()
    }

    const ctx = this.audioContext
    const comp = this.compressor

    if (!ctx || !comp) {
      throw new AppError({
        message: 'Audio system not properly initialized',
        code: ERROR_CODES.DATA_VALIDATION_ERROR,
      })
    }

    if (ctx.state === 'suspended') {
      await ctx.resume()
    }

    const workletNode = new AudioWorkletNode(ctx, 'capture-processor')
    workletNode.port.onmessage = (event) => {
      onFrame(event.data)
    }

    comp.connect(workletNode)
    workletNode.connect(ctx.destination)

    this.workletNode = workletNode
    this.emit('statechange', 'streaming')
  }

  async stopStream(): Promise<void> {
    if (this.workletNode) {
      this.workletNode.disconnect()
      this.workletNode = null
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.suspend()
    }

    this.emit('statechange', 'stopped')
  }

  on(event: AudioDeviceEvent, callback: (data?: unknown) => void): void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, [])
    }
    this.eventCallbacks.get(event)!.push(callback)
  }

  private emit(event: AudioDeviceEvent, data?: unknown): void {
    const callbacks = this.eventCallbacks.get(event)
    if (callbacks) {
      callbacks.forEach(cb => cb(data))
    }
  }

  get sampleRate(): number {
    return this.audioContext?.sampleRate || 44100
  }

  getCurrentTime(): number {
    return this.audioContext?.currentTime || 0
  }
}
