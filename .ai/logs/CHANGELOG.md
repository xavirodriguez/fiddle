# AI Project Memory - CHANGELOG

## [2026-06-21]

### Added
- **Domain Nominal Types:** Added branded types for `Hertz`, `Cents`, and `MidiNote` in `lib/domain/musical-domain.ts` to ensure type safety across the system.
- **Factory Functions:** Implemented `makeHertz`, `makeCents`, and `makeMidiNote` with strict validation to prevent invalid musical magnitudes.
- **Error Handling:** Created `lib/errors/app-error.ts` with basic error hierarchy and codes (`DATA_VALIDATION_ERROR`, `NOTE_PARSING_FAILED`).
- **Tests:** Added comprehensive unit tests for musical domain types in `lib/domain/musical-domain.test.ts`.
- **Repository Hygiene:** Added `.gitignore` to prevent tracking of `node_modules` and other artifacts.

### Changed
- Updated `.ai/tasks/TODO.md` marking task 1.1 as complete.
