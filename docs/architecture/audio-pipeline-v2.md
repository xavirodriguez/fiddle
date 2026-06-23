# Audio Pipeline Architecture (Violin Mentor)

## Overview
The audio system is designed for ultra-low latency and zero garbage collection (GC) pressure in the hot path (60 FPS). It follows a Hexagonal Architecture, separating DSP infrastructure from domain logic.

## Components

### 1. AudioWorklet (The Hot Path)
- **File**: `public/worklets/CaptureProcessor.js`
- **Responsibility**: Captures raw PCM data, performs pitch detection (`pitchy`) and spectral analysis (`meyda`).
- **Optimization**: Runs on a dedicated audio thread. Zero allocation. Uses shared memory structures for results.

### 2. Audio Capture Adapter
- **File**: `lib/infrastructure/audio/web-audio-adapter.ts`
- **Responsibility**: Manages the `AudioContext`, microphone stream, and `AudioWorkletNode` lifecycle.
- **Data Flow**: Receives detection results from the Worklet and pushes them to the RxJS Pipeline.

### 3. Reactive Pipeline
- **File**: `lib/audio/audio-pipeline.ts`
- **Responsibility**: Filters and transforms raw pitch events into domain `PitchFrame` objects using RxJS.
- **Optimization**: Zero allocation. Mutates `SHARED_PITCH_FRAME` in-place.

### 4. Orchestration Service
- **File**: `lib/practice/practice-service.ts`
- **Responsibility**: Subscribes to the Reactive Pipeline, updates stores (throtled), and manages session state via XState.
- **Timing**: Synchronized with `Tone.Transport` and `AudioContext.currentTime`.

### 5. Audio Playback
- **File**: `lib/infrastructure/audio/tone-audio-player.ts`
- **Responsibility**: High-precision metronome and reference note playback using `tone.js`.

## Data Flow Diagram

```text
[ Microphone ]
      ↓
[ Web Audio Graph (Filter/Compressor) ]
      ↓
[ AudioWorkletProcessor (pitchy + meyda) ]  <-- Thread: Audio
      ↓ (MessagePort)
[ WebAudioAdapter ]                         <-- Thread: Main
      ↓
[ RxJS AudioPipeline (filter/tap) ]         <-- Zero Allocation
      ↓
[ PracticeService ]                         <-- Logic & Store Updates
      ↓
[ UI (Zustand) ]                            <-- Throttled 10Hz
```

## Performance Metrics
- **DSP Threading**: Heavy math moved to `AudioWorklet` (100% off-loaded from main thread).
- **GC Pressure**: ~0 bytes allocated per frame in the detection loop.
- **Timing Accuracy**: Sub-millisecond precision via `Tone.Transport`.
