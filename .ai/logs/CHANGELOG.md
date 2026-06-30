# AI Project Memory - CHANGELOG

## [2026-06-21]

### Added
- **Domain Nominal Types:** Added branded types for `Hertz`, `Cents`, and `MidiNote` (Task 1.1).
- **Tuning Calibration:** Added `TuningConfig` and `DEFAULT_TUNING` to support variable A4 reference frequencies (Task 1.2).
- **Pitch Math:** Implemented `frequencyToMidi` and `midiToFrequency` converters with calibration support (Task 1.2).
- **Domain Abstractions:** Defined `PitchFrame` interface in `lib/domain/data-structures.ts` for microtonal analysis (Task 1.3).
- **Audio Infrastructure Ports:** Defined `AudioCapturePort` and `PitchDetectorWorkerPort` (Task 2.1).
- **Strict Domain Tests:** Added strict unit tests for extreme violin frequencies and microtonal precision (Task 3.1).
- **Master Audio Clock:** Refactored `PracticeService` to use `AudioContext.currentTime` for all timing (Task 4.1).
- **Zero-Allocation Hot Path:** Implemented shared mutable instances for `MusicalNote` and `PitchFrame` to prevent GC in 60FPS loop (Task 4.2).
- **Signal Smoothing:** Added `lerp` utility and frequency smoothing logic to `PracticeService` (Task 4.3).
- **Persistence Schemas:** Defined Zod schemas for `PracticeSessionRecord` and `Calibration` (Task 5.1).
- **Asynchronous Persistence:** Implemented non-blocking `saveAsync` and `loadAsync` in `lib/persistence/persistence-core.ts` (Task 5.2).

### Added
- **NoteSegmenter:** Added XState machine for robust note onset/offset detection with debouncing (Task 6.3).
- **AudioPipeline:** Implemented RxJS-based reactive audio processing pipeline (Task 6.3).
- **Unit Tests:** Added tests for `NoteSegmenter` and `AudioPipeline`.
- **Technique Analysis:** Integrated `simple-statistics` for stability and trend analysis in `TechniqueAgent` (Task 6.4).
- **Advanced DSP:** Optimized `PitchDetector` with `pitchy` and `meyda` for zero-allocation performance (Task 6.4).

### Changed
- **PracticeService:** Refactored to use `AudioPipeline` instead of manual RAF loop.
- **Project Metadata:** Cleaned up `.ai/tasks/DONE.md` and consolidated project rules in `.ai/agents/RULES.md`.

## [CURRENT]

### Added
- **Modernized Audio Engine:** Migration of pitch detection (Pitchy MPM) and spectral analysis (Meyda) to `AudioWorklet` for zero-latency performance (Phase 3).
- **Intelligent Technique Agent:** Advanced analysis of vibrato (Hz/cents) and bow stability (RMS variance) using sliding windows and pre-allocated buffers (Phase 7).
- **Session Reporting:** Automatic tracking of "Best Note" and "Worst Note" based on cumulative intonation accuracy.
- **RxJS Audio Pipeline:** Centralized reactive flow `RawPitchEvent -> NoteSegmenter -> TechniqueAgent` with `debounceTime` for stable UI feedback.
- **Tone.js Integration:** Sample-accurate metronome and musical scheduling synchronized with the global `AudioContext` clock.

### Changed
- **Architecture Unification:** Refactored `AudioManager` to be the singleton source of the `AudioContext` and `MediaStream` for the entire application.
- **Zero-Allocation Enforcement:** Strict elimination of per-frame object/array creation in the audio hot-path using buffer pools and shared singletons.
- **Tuner Stream Refactor:** `TunerStream` now consumes processed frames from the centralized `AudioPipeline`.

### Fixed
- Fixed memory leaks in the Web Audio graph by properly disconnecting nodes from the shared source.
- Resolved circular dependencies between `WebAudioAdapter` and `AudioPipeline`.
- Optimized messaging between Worklet and Main thread using buffer pools and minimal structured cloning.
- Resolved type conflicts in `TechniqueAgent` regarding `SessionReport` and internal tracking.

### Added
- **Analytics Domain:** Created `lib/domain/analytics.ts` for long-term progress tracking and session aggregation.
- **Data Export:** Implemented `lib/persistence/export-adapter.ts` for JSON/CSV data portability.
- **Session History Persistence:** Integrated automatic session recording into `app-store.ts`.

### Removed
- **Legacy DSP:** Complete removal of manual YIN implementation and redundant `pitch-detector.ts` (Phase 3 requirement).
