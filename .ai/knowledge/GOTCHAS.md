# Project Gotchas

## Audio Context Synchronization
Tone.js does not automatically use the native `AudioContext` used by other Web Audio nodes. It is mandatory to use `ToneBridge` to ensure `Tone.setContext` is called with the application's master `AudioContext` to avoid clock drift and "context not started" errors.

## Zero-Allocation in Reducers
While `immer` allows for "mutable-like" code, frequent updates to large arrays (like `detectionHistory`) still incur overhead. We use `FixedRingBuffer` internally and synchronize it with the state draft carefully to minimize object creation during high-frequency events.
