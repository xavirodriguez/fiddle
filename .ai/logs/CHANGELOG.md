# AI Project Memory - CHANGELOG

## [2026-06-21]

### Added
- **Domain Nominal Types:** Added branded types for `Hertz`, `Cents`, and `MidiNote` in `lib/domain/musical-domain.ts` to ensure type safety across the system.
- **Factory Functions:** Implemented `makeHertz`, `makeCents`, and `makeMidiNote` with strict validation to prevent invalid musical magnitudes.
- **Error Handling:** Created `lib/errors/app-error.ts` with basic error hierarchy and codes (`DATA_VALIDATION_ERROR`, `NOTE_PARSING_FAILED`).
- **Tests:** Added comprehensive unit tests for musical domain types in `lib/domain/musical-domain.test.ts`.
- **Repository Hygiene:** Added `.gitignore` to prevent tracking of `node_modules` and other artifacts.
- **Tuning Calibration:** Added `TuningConfig` and `DEFAULT_TUNING` to support variable A4 reference frequencies (Task 1.2).
- **Pitch Math:** Implemented `frequencyToMidi` and `midiToFrequency` converters with calibration support (Task 1.2).
- **Domain Abstractions:** Defined `PitchFrame` interface in `lib/domain/data-structures.ts` for microtonal analysis (Task 1.3).
- **Audio Infrastructure Ports:** Defined `AudioCapturePort` and `PitchDetectorWorkerPort` in `lib/ports/audio.port.ts` (Task 2.1).
- **Strict Domain Tests:** Added strict unit tests for extreme violin frequencies and microtonal precision (Task 3.1).

### Changed
- Updated `.ai/tasks/TODO.md` marking tasks 1.1, 1.2, 1.3, 2.1 and 3.1 as complete.
