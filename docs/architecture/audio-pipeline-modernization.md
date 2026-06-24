# Musical Audio Pipeline Architecture

## Reactive Flow

The system uses an RxJS-based pipeline for real-time audio processing, ensuring zero-allocation in the hot path (60 FPS).

```
RawPitchEvent (from AudioWorklet/Worker)
        ↓
  [AudioPipeline]
        ↓
  .pipe(
    tap(NoteSegmenter)   // XState: SILENCE ↔ NOTE (Debouncing)
    filter(isNoteState)  // Gate: Only proceed if a note is active
    map(MusicalNote)     // Core: Hz → Note Name, Cents Deviation
    tap(TechniqueAgent)  // Statistics: Stability, Vibrato, Trends
  )
        ↓
   SHARED_PITCH_FRAME    // Zero-allocation singleton emission
        ↓
   [EventSink / UI]
```

## Core Components

- **PitchDetector (lib/pitch-detector.ts)**: Unified wrapper for `pitchy` (YIN) and `meyda` (Spectral features). Includes an internal noise gate.
- **AudioPipeline (lib/audio-pipeline.ts)**: Orchestrates the reactive flow using RxJS.
- **ToneAudioPlayer (lib/infrastructure/audio/tone-audio-player.ts)**: Implements `AudioPlayerPort` using `tone.js`. Manages metronome, scheduling, and note playback.
- **CaptureProcessor (public/worklets/CaptureProcessor.js)**: High-performance `AudioWorkletProcessor` running on the audio thread.

## Zero-Allocation Strategy

- **Singletons**: `SHARED_PITCH_FRAME` and `SHARED_TECHNIQUE_METRICS` are mutated in-place.
- **Buffers**: `FixedRingBuffer` (delegating to `mnemonist.CircularBuffer`) reuses pre-allocated typed arrays.
- **Worklets**: DSP is offloaded to the audio thread; heavy detection is gated by RMS.
