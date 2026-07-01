# Gotchas & Technical Hurdles

- **AudioWorklet & SharedArrayBuffer:** Note that message passing between the Worklet and Main thread must use structured cloning or Transferable objects. While small messages are fast with structured cloning, large data buffers MUST be transferred to avoid GC pressure.
- **Tone.js & AudioContext:** Tone.js must be explicitly synchronized with the global `AudioContext` provided by `AudioManager`.
- **Zero-Allocation Ring Buffers:** Re-using `SHARED_PITCH_FRAME` and `SHARED_TECHNIQUE_METRICS` is mandatory, but subscribers must copy values if they need to hold them across multiple frames (which they shouldn't in the hot path).
