import { err,ok, type Result } from 'neverthrow';

import { AppError, ERROR_CODES } from '../../errors/app-error';
import { type AudioCapturePort, type AudioDeviceEvent } from '../../ports/audio.port';

/**
 * WebAudioAdapter
 *
 * Implementación de AudioCapturePort utilizando la API de Web Audio Nativa.
 * Configura un grafo de audio optimizado para violín con Zero-Allocation en mente.
 */
export class WebAudioAdapter implements AudioCapturePort {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private eventCallbacks: Map<AudioDeviceEvent, Array<(data?: unknown) => void>> = new Map();

  constructor() {}

  /**
   * Inicializa el contexto de audio. Cumple con la regla de No Throw.
   */
  async initialize(): Promise<Result<void, AppError>> {
    if (this.audioContext) return ok(undefined);

    try {
      this.audioContext = new AudioContext({
        latencyHint: 'interactive',
      });

      // Carga del procesador en el hilo de audio
      await this.audioContext.audioWorklet.addModule('/worklets/CaptureProcessor.js');

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      this.source = this.audioContext.createMediaStreamSource(this.stream);

      // Filtro Biquad Adaptativo (Rango Violín G3-E7)
      this.filter = this.audioContext.createBiquadFilter();
      this.filter.type = 'bandpass';
      this.filter.frequency.value = 1416; // Centro inicial
      this.filter.Q.value = 0.5;

      // Compresor para suavizar ataques
      this.compressor = this.audioContext.createDynamicsCompressor();
      this.compressor.threshold.value = -24;
      this.compressor.knee.value = 30;
      this.compressor.ratio.value = 12;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;

      this.source.connect(this.filter);
      this.filter.connect(this.compressor);

      this.emit('statechange', 'initialized');
      return ok(undefined);
    } catch (e) {
      const appError = new AppError({
        message: e instanceof Error ? e.message : 'Error de hardware de audio',
        code: ERROR_CODES.DATA_VALIDATION_ERROR,
      });
      this.emit('error', appError);
      return err(appError);
    }
  }

  /**
   * Ajusta dinámicamente la frecuencia del filtro biquad.
   */
  public updateFilterFrequency(hz: number): void {
    if (this.filter && this.audioContext) {
      this.filter.frequency.setTargetAtTime(hz, this.audioContext.currentTime, 0.1);
    }
  }

  async startStream(onFrame: (frame: Float32Array) => void): Promise<Result<void, AppError>> {
    if (!this.audioContext || !this.compressor) {
      const initResult = await this.initialize();
      if (initResult.isErr()) return initResult;
    }

    const ctx = this.audioContext!;
    const comp = this.compressor!;

    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      this.workletNode = new AudioWorkletNode(ctx, 'capture-processor');
      this.workletNode.port.onmessage = (event) => {
        onFrame(event.data);
      };

      comp.connect(this.workletNode);
      this.emit('statechange', 'streaming');
      return ok(undefined);
    } catch (e) {
      return err(new AppError({
        message: e instanceof Error ? e.message : 'Error al iniciar stream',
        code: ERROR_CODES.DATA_VALIDATION_ERROR,
      }));
    }
  }

  async stopStream(): Promise<void> {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.suspend();
    }

    this.emit('statechange', 'stopped');
  }

  on(event: AudioDeviceEvent, callback: (data?: unknown) => void): void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event)!.push(callback);
  }

  private emit(event: AudioDeviceEvent, data?: unknown): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }

  get sampleRate(): number {
    return this.audioContext?.sampleRate || 44100;
  }

  getCurrentTime(): number {
    return this.audioContext?.currentTime || 0;
  }
}
