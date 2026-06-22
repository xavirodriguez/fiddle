/**
 * PracticeService v2
 *
 * High-precision practice orchestration.
 */

import { AudioCapturePort } from '../ports/audio.port';
import { BufferPool } from './buffer-pool';
import { practiceMachine } from './practice-machine';
import { createActor } from 'xstate';
import { lerp, Hertz } from '../domain/musical-domain';
import { SHARED_PITCH_FRAME } from '../domain/data-structures';

export class PracticeServiceV2 {
  private adapter: AudioCapturePort;
  private pool: BufferPool;
  private worker: Worker | null = null;
  private actor = createActor(practiceMachine);

  private smoothedFrequency = 0;
  private readonly SMOOTHING_FACTOR = 0.2;

  constructor(adapter: AudioCapturePort) {
    this.adapter = adapter;
    this.pool = new BufferPool(2048);
  }

  async start() {
    await this.adapter.initialize();
    this.worker = new Worker('/workers/PitchWorker.js');

    this.worker.onmessage = (e) => {
      const { result, buffer } = e.data;
      // ELITE RECLAMATION: Reclaim the returned buffer to avoid detached buffer crash
      this.pool.reclaim(buffer);
      this.handleWorkerResult(result);
    };

    this.actor.start();

    await this.adapter.startStream((frame) => {
      this.processFrame(frame);
    });
  }

  private processFrame(frame: Float32Array) {
    if (!this.worker) return;

    const availableBuffer = this.pool.getAvailableBuffer();
    availableBuffer.set(frame);

    this.worker.postMessage({
      buffer: availableBuffer,
      sampleRate: this.adapter.sampleRate
    }, [availableBuffer.buffer]);

    this.pool.switch();
  }

  private handleWorkerResult(result: any) {
    if (result.frequency > 0 && result.confidence > 0.7) {
      if (this.smoothedFrequency === 0) {
        this.smoothedFrequency = result.frequency;
      } else {
        this.smoothedFrequency = lerp(this.smoothedFrequency, result.frequency, this.SMOOTHING_FACTOR);
      }

      SHARED_PITCH_FRAME.frequency = this.smoothedFrequency as Hertz;
      SHARED_PITCH_FRAME.confidence = result.confidence;
      SHARED_PITCH_FRAME.timestamp = this.getCurrentAudioTime();

      this.actor.send({
        type: 'PITCH_DETECTED',
        frame: SHARED_PITCH_FRAME
      });
    } else {
      this.actor.send({ type: 'PITCH_LOST' });
    }
  }

  private getCurrentAudioTime(): number {
    return this.adapter.getCurrentTime();
  }

  async stop() {
    await this.adapter.stopStream();
    this.worker?.terminate();
    this.actor.stop();
  }

  setTarget(midi: number) {
    this.actor.send({ type: 'SET_TARGET', midi });
  }
}
