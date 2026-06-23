# Musical Synchronization Engine Architecture

## 1. Orchestration Flow

1.  **Load**: User loads MusicXML -> `ScoreViewer` renders via OSMD.
2.  **Compile**: `TimelineSynchronizer` pre-calculates absolute `Seconds` for every note.
3.  **Transport**: `Tone.Transport` starts, driven by the shared `AudioContext`.
4.  **Events**: Scheduled events trigger `ScoreViewer.nextStep()` (Imperative, No React Render).
5.  **DSP Loop**:
    - Mic input -> `PitchDetector` -> MIDI conversion.
    - `TimelineSynchronizer.verify()` compares MIDI against active event in O(1).
6.  **Feedback**:
    - Store is updated ONLY when state changes (Correct -> Incorrect, or Measure change).
    - `FeedbackOverlay` renders only on these state changes.

## 2. Data Flow Diagram

```ascii
[ Mic Input ] -> [ PitchDetector ] -> [ MIDI Note ]
                                          |
                                          v
[ AudioContext ] -> [ Tone.Transport ] -> [ TimelineSynchronizer.verify() ]
      |                   |                       |
      |                   v                       v
      |            [ Scheduled Events ] -> [ ScoreViewer (Imperative) ]
      |                                           |
      +-------------------------------------------+-----> [ Practice Store ]
                                                                |
                                                                v
                                                       [ React UI (Feedback) ]
```

## 3. Temporal Flow Diagram

```ascii
Timeline (Beats):  | 1 . 2 . 3 . 4 | 2 . 2 . 3 . 4 |
                   |-------M1------|-------M2------|

Physical (Secs):   [0s]----[1s]----[2s]----[3s]----[4s]
                    |       |       |       |       |
Events:            (C4)    (D4)    (E4)    (F4)    (G4)
                    |       |       |       |       |
Cursor Sync:       [->]    [->]    [->]    [->]    [->]
```

## 4. Module Dependencies

```ascii
[ PracticeContainer ]
      |
      +--> [ ScoreViewer ] (OSMD)
      |
      +--> [ PracticeService ]
                |
                +--> [ ToneBridge ] (Shared Context)
                |
                +--> [ TimelineSynchronizer ] (O(1) Logic)
                |
                +--> [ PitchDetector ] (DSP)
                |
                +--> [ PracticeStore ] (Zustand)
```

## 5. Logical Threads

-   **Audio Thread (Native)**: Clock source, shared by Tone.js and DSP.
-   **Processing Loop (RAF)**: Pitch detection and sync verification at 60 FPS.
-   **Visual Thread (React)**: High-level UI updates and feedback overlays.
-   **Imperative Thread (OSMD)**: Zero-allocation cursor movement on top of SVG/Canvas.
