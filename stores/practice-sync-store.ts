import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

/**
 * PracticeSyncState
 *
 * High-performance store for synchronizing the UI with the audio engine.
 */
interface PracticeSyncState {
  currentMeasure: number;
  currentMidiTarget: number;
  isCorrectPitch: boolean;
  setTargetNote: (measure: number, midi: number) => void;
  setPitchFeedback: (correct: boolean) => void;
}

export const usePracticeSyncStore = create<PracticeSyncState>()(
  immer((set) => ({
    currentMeasure: 0,
    currentMidiTarget: 0,
    isCorrectPitch: false,
    setTargetNote: (measure, midi) =>
      set((state) => {
        state.currentMeasure = measure;
        state.currentMidiTarget = midi;
      }),
    setPitchFeedback: (correct) =>
      set((state) => {
        if (state.isCorrectPitch !== correct) {
          state.isCorrectPitch = correct;
        }
      }),
  }))
);
