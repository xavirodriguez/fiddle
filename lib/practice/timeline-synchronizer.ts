import * as Tone from "tone";
import { Seconds, BPM } from "../audio/tone-bridge";

/**
 * Represents a musical event (note) in the practice timeline.
 */
export interface MusicalEvent {
  readonly midiNote: number;
  readonly startTime: Seconds;
  readonly duration: Seconds;
  readonly measureIndex: number;
}

/**
 * TimelineSynchronizer
 *
 * Orchestrates the deterministic execution of musical events based on the Tone.js transport.
 * It pre-calculates the schedule to ensure zero-allocation during performance.
 */
export class TimelineSynchronizer {
  private events: MusicalEvent[] = [];
  private currentEventIndex: number = 0;
  private onNoteTriggerCallback?: (event: MusicalEvent) => void;

  constructor(private readonly transport: typeof Tone.Transport) {}

  /**
   * Compiles the score data into a flat timeline based on physical seconds.
   */
  public compileSchedule(rawScoreData: { notes: any[] }, bpm: BPM): void {
    this.transport.cancel();
    this.transport.bpm.value = bpm;
    this.events = [];
    this.currentEventIndex = 0;

    let accumulatedTime = 0 as Seconds;

    rawScoreData.notes.forEach((note) => {
      const durationInSeconds = (note.durationBeats * (60 / bpm)) as Seconds;

      const event: MusicalEvent = {
        midiNote: note.midi,
        startTime: accumulatedTime,
        duration: durationInSeconds,
        measureIndex: note.measure,
      };

      this.events.push(event);

      // Deterministic schedule in Tone.js transport clock
      this.transport.schedule((time) => {
        if (this.onNoteTriggerCallback) {
          // Executed exactly on the Audio thread by the native scheduler
          this.onNoteTriggerCallback(event);
        }
      }, accumulatedTime);

      accumulatedTime = (accumulatedTime + durationInSeconds) as Seconds;
    });
  }

  /**
   * Subscribes to note trigger events.
   */
  public subscribeToNotes(callback: (event: MusicalEvent) => void): void {
    this.onNoteTriggerCallback = callback;
  }

  /**
   * Starts the transport with a safety buffer.
   */
  public start(startTimeOffset: Seconds = 0 as Seconds): void {
    this.transport.start(`+0.05`, startTimeOffset);
  }

  /**
   * Stops the transport.
   */
  public stop(): void {
    this.transport.stop();
  }

  /**
   * Zero-Allocation Accuracy Verification.
   * Checks if the current frequency matches the expected MIDI note for the current time.
   */
  public verifyTargetAccuracy(currentMidi: number, currentAudioTime: number): boolean {
    if (this.events.length === 0 || this.currentEventIndex >= this.events.length) return false;

    const expectedEvent = this.events[this.currentEventIndex];

    // Temporal tolerance window
    if (currentAudioTime >= expectedEvent.startTime && currentAudioTime <= (expectedEvent.startTime + expectedEvent.duration)) {
      return currentMidi === expectedEvent.midiNote;
    }

    // If current time passed the expected note, advance pointer
    if (currentAudioTime > (expectedEvent.startTime + expectedEvent.duration)) {
      this.currentEventIndex++;
    }

    return false;
  }
}
