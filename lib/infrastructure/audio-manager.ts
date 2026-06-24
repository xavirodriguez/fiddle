/**
 * AudioManager
 *
 * Manages the singleton AudioContext and AnalyserNode for the application.
 * All audio infrastructure (mic capture, analyser) is owned here.
 * Browser-only: never imported on the server.
 */

const FFT_SIZE = 4096
const SMOOTHING_TIME_CONSTANT = 0

class AudioManager {
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private filter: BiquadFilterNode | null = null
  private compressor: DynamicsCompressorNode | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private stream: MediaStream | null = null

  /**
   * Initialises the AudioContext and requests microphone permission.
   * Safe to call multiple times — subsequent calls are no-ops if already running.
   */
  async initialize(): Promise<void> {
    if (this.context && this.context.state !== 'closed') return

    this.context = new AudioContext()
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = FFT_SIZE
    this.analyser.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT

    // TAREA 1: Completar el Web Audio Graph (Filtros y Compresión)
    this.compressor = this.context.createDynamicsCompressor()
    this.compressor.threshold.value = -24
    this.compressor.ratio.value = 3

    this.filter = this.context.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = 3500

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      this.sourceNode = this.context.createMediaStreamSource(this.stream)

      // MediaStreamSource -> DynamicsCompressor -> BiquadFilter -> AnalyserNode
      this.sourceNode.connect(this.compressor)
      this.compressor.connect(this.filter)
      this.filter.connect(this.analyser)
    } catch (err) {
      console.error('[AudioManager] Failed to acquire microphone:', err)
      throw err
    }
  }

  /**
   * Returns the live AudioContext, or null if not yet initialized.
   */
  getContext(): AudioContext | null {
    return this.context
  }

  /**
   * Returns the AnalyserNode connected to the microphone, or null if not ready.
   */
  getAnalyser(): AnalyserNode | null {
    return this.analyser
  }

  /**
   * Suspends the AudioContext to conserve resources while not in use.
   */
  async suspend(): Promise<void> {
    if (this.context && this.context.state === 'running') {
      await this.context.suspend()
    }
  }

  /**
   * Resumes a suspended AudioContext.
   */
  async resume(): Promise<void> {
    if (this.context && this.context.state === 'suspended') {
      await this.context.resume()
    }
  }

  /**
   * Tears down the AudioContext and releases the microphone stream.
   */
  async dispose(): Promise<void> {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.sourceNode?.disconnect()
    this.compressor?.disconnect()
    this.filter?.disconnect()
    await this.context?.close()
    this.stream = null
    this.sourceNode = null
    this.compressor = null
    this.filter = null
    this.analyser = null
    this.context = null
  }
}

/** Singleton instance — shared across the application. */
export const audioManager = new AudioManager()
