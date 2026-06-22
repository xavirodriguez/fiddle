import * as Tone from "tone";
import { err, ok, Result } from "neverthrow";

export type Seconds = number & { readonly __brand: unique symbol };
export type BPM = number & { readonly __brand: unique symbol };

/**
 * Initializes the Tone.js bridge by linking it to the native AudioContext.
 * This ensures that accompaniment and metronome are perfectly synced with the DSP pipeline.
 */
export const initializeToneBridge = (nativeContext: AudioContext): Result<typeof Tone, Error> => {
  try {
    // Force Tone to consume the existing native pipeline
    if (Tone.getContext().rawContext !== nativeContext) {
      const toneContext = new Tone.Context(nativeContext);
      Tone.setContext(toneContext);
    }
    return ok(Tone);
  } catch (error) {
    return err(error instanceof Error ? error : new Error("Unknown error while linking Tone.js"));
  }
};
