import * as Tone from 'tone'

import { BPM,Seconds, ToneBridge } from '../../audio/tone-bridge'
import { type AudioPlayerPort } from '../../ports/audio-player.port'

/**
 * ToneAudioPlayer
 *
 * Implements AudioPlayerPort using Tone.js for high-precision musical timing.
 */
export class ToneAudioPlayer implements AudioPlayerPort {
  private _synth: Tone.PolySynth | null = null
  private clickLoop: Tone.Loop | null = null

  private get synth(): Tone.PolySynth {
    if (!this._synth) {
      this._synth = new Tone.PolySynth(Tone.Synth).toDestination()
    }
    return this._synth
  }

  async playNote(frequency: number, durationMs: number, volume = 0.5): Promise<void> {
    await ToneBridge.initialize()

    this.synth.volume.value = Tone.gainToDb(volume)
    const durationSec = durationMs / 1000

    this.synth.triggerAttackRelease(frequency, durationSec, Tone.now())
  }

  /**
   * Starts a metronome click loop.
   * @param bpm Beats per minute.
   */
  startMetronome(bpm: number): void {
    if (this.clickLoop) {
      this.clickLoop.stop()
      this.clickLoop.dispose()
    }

    const click = new Tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 2,
      envelope: {
        attack: 0.0006,
        decay: 0.1,
        sustain: 0
      }
    }).toDestination()

    this.clickLoop = new Tone.Loop((time) => {
      click.triggerAttackRelease('C4', '32n', time)
    }, '4n')

    Tone.getTransport().bpm.value = bpm
    this.clickLoop.start(0)
  }

  stopMetronome(): void {
    if (this.clickLoop) {
      this.clickLoop.stop()
    }
    Tone.getTransport().stop()
  }

  stopAll(): void {
    if (this._synth) {
      this._synth.releaseAll()
    }
    this.stopMetronome()
    Tone.getTransport().cancel()
  }

  async cleanup(): Promise<void> {
    this.stopAll()
    this._synth?.dispose()
    this.clickLoop?.dispose()
  }

  /**
   * Schedules a callback at a specific musical time.
   */
  scheduleEvent(callback: (time: number) => void, time: string | number | Seconds): number {
    return Tone.getTransport().schedule(callback, time)
  }

  clearEvent(id: number): void {
    Tone.getTransport().clear(id)
  }

  /**
   * Play a reference note at a given frequency.
   */
  playReference(frequency: number, volume = 0.3): void {
    this.synth.volume.value = Tone.gainToDb(volume);
    this.synth.triggerAttack(frequency, Tone.now());
  }

  /**
   * Stop reference note playback.
   */
  stopReference(): void {
    this.synth.releaseAll();
  }
}

export const toneAudioPlayer = new ToneAudioPlayer()
