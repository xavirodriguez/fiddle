import * as Tone from 'tone'

import { BPM,Seconds, ToneBridge } from '../../audio/tone-bridge'
import { type AudioPlayerPort } from '../../ports/audio-player.port'

/**
 * ToneAudioPlayer
 *
 * Implements AudioPlayerPort using Tone.js for high-precision musical timing.
 */
export class ToneAudioPlayer implements AudioPlayerPort {
  private synth: Tone.PolySynth
  private clickLoop: Tone.Loop | null = null

  constructor() {
    this.synth = new Tone.PolySynth(Tone.Synth).toDestination()
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
    this.synth.releaseAll()
    this.stopMetronome()
    Tone.getTransport().cancel()
  }

  async cleanup(): Promise<void> {
    this.stopAll()
    this.synth.dispose()
    this.clickLoop?.dispose()
  }

  /**
   * Schedules a callback at a specific musical time.
   */
  scheduleEvent(callback: (time: number) => void, time: string | number): number {
    return Tone.getTransport().schedule(callback, time)
  }

  clearEvent(id: number): void {
    Tone.getTransport().clear(id)
  }
}

export const toneAudioPlayer = new ToneAudioPlayer()
