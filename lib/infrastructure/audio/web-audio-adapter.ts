import { err, ok, type Result } from 'neverthrow'

import { AppError, ERROR_CODES } from '../../errors/app-error'
import { type AudioCapturePort, type AudioDeviceEvent } from '../../ports/audio.port'
import { audioManager } from '../audio-manager'
import { type WorkerInputMessage } from './pitch-worker.types'

/**
 * WebAudioAdapter
 *
 * Implementación de AudioCapturePort utilizando la API de Web Audio Nativa.
 * Configura un grafo de audio optimizado para violín con Zero-Allocation en mente.
 * Comparte el AudioContext y MediaStream gestionados por el AudioManager.
 */
export class WebAudioAdapter implements AudioCapturePort {
  private filter: BiquadFilterNode | null = null
  private compressor: DynamicsCompressorNode | null = null
  private workletNode: AudioWorkletNode | null = null
  private eventCallbacks: Map<AudioDeviceEvent, Array<(data?: unknown) => void>> = new Map()

  constructor() {}

  /**
   * Inicializa el grafo de audio usando el contexto de AudioManager.
   * Cumple con la regla de No Throw.
   */
  async initialize(): Promise<Result<void, AppError>> {
    try {
      // Garantizar que AudioManager esté inicializado
      await audioManager.initialize()
      const ctx = audioManager.getContext()
      const source = audioManager.getSourceNode()

      if (!ctx || !source) {
        return err(
          new AppError({
            message: 'No se pudo obtener el contexto de audio del AudioManager',
            code: ERROR_CODES.HARDWARE_NOT_FOUND,
          }),
        )
      }

      // Carga del procesador en el hilo de audio
      await ctx.audioWorklet.addModule('/worklets/CaptureProcessor.js')

      // Filtro Biquad Adaptativo (Rango Violín G3-E7)
      // Usamos bandpass para aislar la fundamental y reducir armónicos/ruido.
      this.filter = ctx.createBiquadFilter()
      this.filter.type = 'bandpass'
      this.filter.frequency.value = 440 // A4 como base
      this.filter.Q.value = 1.0 // Q moderado para no matar la señal si hay vibrato

      // Compresor para suavizar ataques agresivos y estabilizar la señal (Task 2.2)
      this.compressor = ctx.createDynamicsCompressor()
      this.compressor.threshold.setValueAtTime(-24, ctx.currentTime)
      this.compressor.knee.setValueAtTime(30, ctx.currentTime)
      this.compressor.ratio.setValueAtTime(12, ctx.currentTime)
      this.compressor.attack.setValueAtTime(0.003, ctx.currentTime)
      this.compressor.release.setValueAtTime(0.25, ctx.currentTime)

      source.connect(this.filter)
      this.filter.connect(this.compressor)

      this.emit('statechange', 'initialized')
      return ok(undefined)
    } catch (e) {
      const appError = new AppError({
        message: e instanceof Error ? e.message : 'Error al inicializar WebAudioAdapter',
        code: ERROR_CODES.DATA_VALIDATION_ERROR,
      })
      this.emit('error', appError)
      return err(appError)
    }
  }

  /**
   * Ajusta dinámicamente la frecuencia del filtro biquad (Task 2.2).
   * Aumenta el Q cuando hay una nota objetivo para mayor selectividad.
   */
  public updateFilterFrequency(hz: number, isTargeted: boolean = true): void {
    const ctx = audioManager.getContext()
    if (this.filter && ctx) {
      const targetQ = isTargeted ? 2.0 : 0.7
      this.filter.frequency.setTargetAtTime(hz, ctx.currentTime, 0.05)
      this.filter.Q.setTargetAtTime(targetQ, ctx.currentTime, 0.05)
    }
  }

  async startStream(onFrame: (data: Float64Array) => void): Promise<Result<void, AppError>> {
    const ctx = audioManager.getContext()
    if (!ctx || !this.compressor) {
      const initResult = await this.initialize()
      if (initResult.isErr()) return initResult
    }

    const currentCtx = audioManager.getContext()
    if (!currentCtx || !this.compressor) {
      return err(
        new AppError({
          message: 'AudioContext no inicializado',
          code: ERROR_CODES.INTERNAL_ERROR,
        }),
      )
    }

    const comp = this.compressor

    try {
      if (!currentCtx) {
        return err(
          new AppError({
            message: 'AudioContext no inicializado',
            code: ERROR_CODES.INTERNAL_ERROR,
          }),
        )
      }

      if (currentCtx.state === 'suspended') {
        await currentCtx.resume()
      }

      this.workletNode = new AudioWorkletNode(currentCtx, 'capture-processor')
      this.workletNode.port.onmessage = (event: MessageEvent<Float64Array>) => {
        const data = event.data
        if (data.length === 6) {
          onFrame(data)
          // Task 2.3: Devolver el buffer al pool del Worklet (Transferable Objects)
          if (this.workletNode) {
            this.workletNode.port.postMessage(data, [data.buffer])
          }
        }
      }

      // Notify the worklet about the sample rate
      this.workletNode.port.postMessage({
        type: 'init',
        sampleRate: currentCtx.sampleRate,
      } satisfies WorkerInputMessage)

      comp.connect(this.workletNode)
      // Not connecting to destination: the worklet is an analyzer, not a generator.
      this.emit('statechange', 'streaming')
      return ok(undefined)
    } catch (e) {
      return err(
        new AppError({
          message: e instanceof Error ? e.message : 'Error al iniciar stream',
          code: ERROR_CODES.DATA_VALIDATION_ERROR,
        }),
      )
    }
  }

  async stopStream(): Promise<void> {
    if (this.workletNode) {
      this.workletNode.disconnect()
      this.workletNode = null
    }

    if (this.compressor) {
      this.compressor.disconnect()
    }

    if (this.filter) {
      this.filter.disconnect()
    }

    // Desconectar del source global del AudioManager para evitar acumulación de nodos
    const source = audioManager.getSourceNode()
    if (source && this.filter) {
      source.disconnect(this.filter)
    }

    this.emit('statechange', 'stopped')
    return Promise.resolve()
  }

  on(event: AudioDeviceEvent, callback: (data?: unknown) => void): void {
    let callbacks = this.eventCallbacks.get(event)
    if (!callbacks) {
      callbacks = []
      this.eventCallbacks.set(event, callbacks)
    }
    callbacks.push(callback)
  }

  private emit(event: AudioDeviceEvent, data?: unknown): void {
    const callbacks = this.eventCallbacks.get(event)
    if (callbacks) {
      callbacks.forEach((cb) => cb(data))
    }
  }

  get sampleRate(): number {
    return audioManager.getContext()?.sampleRate ?? 44100
  }

  getCurrentTime(): number {
    return audioManager.getContext()?.currentTime ?? 0
  }
}
