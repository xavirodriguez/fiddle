import { err,ok, type Result } from 'neverthrow';

import { type WorkerInputMessage } from './pitch-worker.types';
import { AppError, ERROR_CODES } from '../../errors/app-error';
import { audioManager } from '../audio-manager';
import { type AudioCapturePort, type AudioDeviceEvent } from '../../ports/audio.port';

/**
 * WebAudioAdapter
 *
 * Implementación de AudioCapturePort utilizando la API de Web Audio Nativa.
 * Configura un grafo de audio optimizado para violín con Zero-Allocation en mente.
 * Comparte el AudioContext y MediaStream gestionados por el AudioManager.
 */
export class WebAudioAdapter implements AudioCapturePort {
  private filter: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private eventCallbacks: Map<AudioDeviceEvent, Array<(data?: unknown) => void>> = new Map();

  constructor() {}

  /**
   * Inicializa el grafo de audio usando el contexto de AudioManager.
   * Cumple con la regla de No Throw.
   */
  async initialize(): Promise<Result<void, AppError>> {
    try {
      // Garantizar que AudioManager esté inicializado
      await audioManager.initialize();
      const ctx = audioManager.getContext();
      const source = audioManager.getSourceNode();

      if (!ctx || !source) {
        return err(new AppError({
          message: 'No se pudo obtener el contexto de audio del AudioManager',
          code: ERROR_CODES.HARDWARE_NOT_FOUND,
        }));
      }

      // Carga del procesador en el hilo de audio
      await ctx.audioWorklet.addModule('/worklets/CaptureProcessor.js');

      // Filtro Biquad Adaptativo (Rango Violín G3-E7)
      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'bandpass';
      this.filter.frequency.value = 1416; // Centro inicial
      this.filter.Q.value = 0.5;

      // Compresor para suavizar ataques
      this.compressor = ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -24;
      this.compressor.knee.value = 30;
      this.compressor.ratio.value = 12;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;

      source.connect(this.filter);
      this.filter.connect(this.compressor);

      this.emit('statechange', 'initialized');
      return ok(undefined);
    } catch (e) {
      const appError = new AppError({
        message: e instanceof Error ? e.message : 'Error al inicializar WebAudioAdapter',
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
    const ctx = audioManager.getContext();
    if (this.filter && ctx) {
      this.filter.frequency.setTargetAtTime(hz, ctx.currentTime, 0.1);
    }
  }

  async startStream(onFrame: (data: Float64Array) => void): Promise<Result<void, AppError>> {
    const ctx = audioManager.getContext();
    if (!ctx || !this.compressor) {
      const initResult = await this.initialize();
      if (initResult.isErr()) return initResult;
    }

    const currentCtx = audioManager.getContext();
    if (!currentCtx || !this.compressor) {
      return err(new AppError({
        message: 'AudioContext no inicializado',
        code: ERROR_CODES.INTERNAL_ERROR,
      }));
    }

    const comp = this.compressor;


    try {
      if (!currentCtx) {
        return err(new AppError({
          message: 'AudioContext no inicializado',
          code: ERROR_CODES.INTERNAL_ERROR,
        }));
      }

      if (currentCtx.state === 'suspended') {
        await currentCtx.resume();
      }

      this.workletNode = new AudioWorkletNode(currentCtx, 'capture-processor');
      this.workletNode.port.onmessage = (event: MessageEvent<Float64Array>) => {
        const data = event.data;
        if (data.length === 6) {
          onFrame(data);
        }
      };

      // Notify the worklet about the sample rate
      this.workletNode.port.postMessage({
        type: 'init',
        sampleRate: currentCtx.sampleRate
      } satisfies WorkerInputMessage);

      comp.connect(this.workletNode);
      // Not connecting to destination: the worklet is an analyzer, not a generator.
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

    if (this.compressor) {
      this.compressor.disconnect();
    }

    if (this.filter) {
      this.filter.disconnect();
    }

    // Desconectar del source global del AudioManager para evitar acumulación de nodos
    const source = audioManager.getSourceNode();
    if (source && this.filter) {
      source.disconnect(this.filter);
    }

    this.emit('statechange', 'stopped');
  }

  on(event: AudioDeviceEvent, callback: (data?: unknown) => void): void {
    let callbacks = this.eventCallbacks.get(event);
    if (!callbacks) {
      callbacks = [];
      this.eventCallbacks.set(event, callbacks);
    }
    callbacks.push(callback);
  }

  private emit(event: AudioDeviceEvent, data?: unknown): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }

  get sampleRate(): number {
    return audioManager.getContext()?.sampleRate ?? 44100;
  }

  getCurrentTime(): number {
    return audioManager.getContext()?.currentTime ?? 0;
  }
}
