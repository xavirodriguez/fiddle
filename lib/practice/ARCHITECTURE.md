# Musical Synchronization Engine Architecture

## 1. Orchestration Flow

1.  **Load**: User loads MusicXML -> `ScoreViewer` renders via OSMD.
2.  **Compile**: `TimelineSynchronizer` pre-calculates absolute `Seconds` for every note using `timeSignature`.
3.  **Transport**: `Tone.Transport` starts, driven by the shared native `AudioContext` via `ToneBridge`.
4.  **Events**: Scheduled events trigger `ScoreViewer.nextStep()` (Imperative API, bypassing React).
5.  **DSP Loop**:
    - Mic input -> `PitchDetector` -> MIDI conversion.
    - `PracticeService.processFrame()` (60 FPS hot path) calls `TimelineSynchronizer.verify()`.
    - Verification happens in O(1) using an incremental pointer and zero-allocation.
6.  **Feedback**:
    - Zustand `syncState` is updated ONLY on discrete musical changes (new note, correctness toggle).
    - `FeedbackOverlay` reads frequency/cents via `useAppStore.getState()` in a `requestAnimationFrame` loop, writing directly to DOM refs.

## 2. Data Flow Diagram

```ascii
[ Mic Input ] -> [ AudioContext ] -> [ PitchDetector ] -> [ MIDI Note ]
                                                               |
                                                               v
[ ToneBridge ] -> [ Tone.Transport ] ----------------> [ TimelineSynchronizer.verify() ]
      |                   |                                    |
      |                   v                                    v
      |            [ Scheduled Events ] ---------------> [ ScoreViewer (Imperative) ]
      |                                                        |
      +--------------------------------------------------------+-----> [ Zustand Store ]
                                                                             |
                                                                             v
                                                                    [ FeedbackOverlay ]
                                                                    (Direct DOM via RAF)
```

## 3. Temporal Flow Diagram

```ascii
Timeline (Beats):  | 1 . 2 . 3 . 4 | 2 . 2 . 3 . 4 |
                   |-------M1------|-------M2------|

Physical (Secs):   [0s]----[1s]----[2s]----[3s]----[4s]
                    |       |       |       |       |
Events:            (C4)    (D4)    (E4)    (F4)    (G4)
                    |       |       |       |       |
Cursor Sync:       [next]  [next]  [next]  [next]  [next]
                    (Direct call to ScoreViewer.nextStep)
```

## 4. Module Dependencies

```ascii
[ PracticeContainer ]
      |
      +--> [ ScoreViewer ] (OSMD + Imperative API)
      |
      +--> [ PracticeService ]
                |
                +--> [ ToneBridge ] (Context Synchronization)
                |
                +--> [ TimelineSynchronizer ] (O(1) Verification)
                |
                +--> [ AudioPipeline ] (DSP & Analysis)
                |
                +--> [ Zustand Store ] (Discrete State)
```

## 5. Logical Threads

-   **Native Audio Thread**: Master clock source (shared between Tone.js and DSP).
-   **Audio Worklet (DSP)**: High-priority off-thread pitch detection (Pitchy/Meyda).
-   **Processing Loop (60 FPS)**: `PracticeService` processing RxJS frames, verifying sync.
-   **UI Loop (RAF)**: `FeedbackOverlay` updating DOM refs for cents/frequency.
-   **React Loop (Coarse)**: High-level state changes (measure, status, target note).

## 6. Module Analysis

### ToneBridge (`lib/audio/tone-bridge.ts`)
- **Objective**: Synchronize Tone.js with the global AudioContext.
- **Responsibilities**: Shared context initialization, nominal typing for musical units.
- **Risks**: Clock drift between scheduled events and real-time capture.
- **Decision**: Force Tone.js to use the native context immediately on boot.

### ScoreViewer (`app/practice/_components/score-viewer.tsx`)
- **Objective**: Render MusicXML and provide a high-performance visual cursor.
- **Responsibilities**: OSMD management, imperative navigation API.
- **Risks**: Reflow cost and React reconciliation latency.
- **Decision**: Bypass React for cursor movement; use `useRef` and `useImperativeHandle`.

### TimelineSynchronizer (`lib/practice/timeline-synchronizer.ts`)
- **Objective**: Map musical units to physical time and verify performer accuracy.
- **Responsibilities**: Timeline compilation, O(1) sync verification.
- **Risks**: Accumulative drift and O(N) lookup costs.
- **Decision**: Pre-calculate absolute timestamps; use incremental pointer for verification.

### PracticeService (`lib/practice/practice-service.ts`)
- **Objective**: Orchestrate the entire practice lifecycle.
- **Responsibilities**: Service initialization, event routing, zero-allocation processing.
- **Risks**: Garbage collection pauses in the audio callback.
- **Decision**: Pre-allocate all event objects; throttle store updates.
