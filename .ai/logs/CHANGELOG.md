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
- Implementación de AMDF (Average Magnitude Difference Function) en `PitchDetector` para mitigar errores de octava en el violín (Tarea 2.3).
- Método `setFilterFrequency` en `AudioManager` para filtros adaptativos durante la práctica (Tarea 2.2).
- Test de integración de señal sintética para validar detección de fundamental con armónicos fuertes (Tarea 3.2).

### Changed
- Consolidación de `NoteSegmenter` utilizando XState v5 `setup`, eliminando redundancias y mejorando el debouncing (Tarea 6.3).

### Fixed
- Corrección de bug en el contador de frames de `NoteSegmenter`.
- Mejora de rendimiento moviendo el procesamiento pesado DSP después de la puerta de ruido (Noise Gate).
- Corrección de importaciones y tipos en `FixedRingBuffer` y `AudioPipeline`.
