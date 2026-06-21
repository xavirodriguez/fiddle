/**
 * Port for audio playback.
 *
 * @remarks
 * This interface abstracts the playback of musical notes or audio samples,
 * allowing for different implementations (e.g., Web Audio API, sample-based,
 * or synthetic).
 *
 * @public
 */
export interface AudioPlayerPort {
  /**
   * Plays a single note at a specific frequency for a given duration.
   *
   * @param frequency - The frequency in Hz.
   * @param durationMs - The duration in milliseconds.
   * @param volume - The volume level (0.0 to 1.0).
   * @returns A promise that resolves when the note starts playing or finishes.
   */
  playNote(frequency: number, durationMs: number, volume?: number): Promise<void>

  /**
   * Stops all currently playing audio.
   */
  stopAll(): void

  /**
   * Cleans up any resources used by the player.
   */
  cleanup(): Promise<void>
}
