/**
 * AudioManager
 *
 * Manages the singleton AudioContext and AnalyserNode for the application.
 * All audio infrastructure (mic capture, analyser) is owned here.
 * Browser-only: never imported on the server.
 */

class AudioManager {
  private context: AudioContext | null = null
  private filter: BiquadFilterNode | null = null
  private compressor: DynamicsCompressorNode | null = null
  private analyser: AnalyserNode | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private stream: MediaStream | null = null

  /**
   * Initialises the AudioContext and requests microphone permission.
   * Safe to call multiple times — subsequent calls are no-ops if already running.
   */
  async initialize(): Promise<void> {
    if (this.context && this.context.state !== 'closed') return

    this.context = new AudioContext({
      latencyHint: 'interactive',
    })

    // Bug 6 Fix: Ensure AnalyserNode uses 0 smoothing for raw MPM signal
    this.analyser = this.context.createAnalyser()
    this.analyser.smoothingTimeConstant = 0

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false
      })
      this.sourceNode = this.context.createMediaStreamSource(this.stream)
      // Bug 6: Connect to analyser to allow raw signal extraction
      this.sourceNode.connect(this.analyser)
    } catch (err) {
      console.error('[AudioManager] Failed to acquire microphone:', err)
      throw err
    }
  }

  /**
   * Returns the AnalyserNode with 0 smoothing, or null if not yet initialized.
   */
  getAnalyser(): AnalyserNode | null {
    return this.analyser
  }

  /**
   * Returns the live AudioContext, or null if not yet initialized.
   */
  getContext(): AudioContext | null {
    return this.context
  }

  /**
   * Returns the MediaStreamSourceNode, or null if not yet initialized.
   */
  getSourceNode(): MediaStreamAudioSourceNode | null {
    return this.sourceNode
  }

  /**
   * Updates the filter frequency based on the current musical range.
   * For violin, this usually ranges from 196Hz (G3) to ~3500Hz.
   *
   * @param frequency - New cutoff frequency in Hz.
   */
  setFilterFrequency(frequency: number): void {
    if (this.filter) {
      // Smooth transition to avoid audible clicks
      const now = this.context?.currentTime ?? 0;
      this.filter.frequency.setTargetAtTime(frequency, now, 0.1);
    }
  }

  /**
   * Suspends the AudioContext to conserve resources while not in use.
   */
  async suspend(): Promise<void> {
    if (this.context?.state === 'running') {
      await this.context.suspend()
    }
  }

  /**
   * Resumes a suspended AudioContext.
   */
  async resume(): Promise<void> {
    if (this.context?.state === 'suspended') {
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
    this.context = null
  }
}

/** Singleton instance — shared across the application. */
export const audioManager = new AudioManager()
