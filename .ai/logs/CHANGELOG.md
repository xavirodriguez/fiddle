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

### Changed
- Updated `.ai/tasks/TODO.md` marking completed tasks.
