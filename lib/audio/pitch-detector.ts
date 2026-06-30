import { type Observable } from 'rxjs'

import { type PitchFrame } from '../domain/data-structures'
import { audioPipeline } from './audio-pipeline'

/**
 * PitchDetector
 *
 * Unified adapter that wraps the reactive audio pipeline.
 * Provides a stable public interface for external consumers (like UI or practice logic)
 * while abstracting away the internal RxJS and hardware complexities.
 */
export class PitchDetector {
  /**
   * The processed stream of valid pitch frames.
   */
  public readonly pitchFrame$: Observable<PitchFrame> = audioPipeline.pitchFrame$

  /**
   * Debounced stream for stable observations (useful for UI/Feedback).
   */
  public readonly stablePitchFrame$: Observable<PitchFrame> = audioPipeline.stablePitchFrame$

  /**
   * Initializes the hardware and starts the detection pipeline.
   */
  public async start(): Promise<void> {
    const result = await audioPipeline.init()
    if (result.isErr()) {
      throw result.error
    }
  }

  /**
   * Stops the hardware stream and cleans up resources.
   */
  public async stop(): Promise<void> {
    await audioPipeline.stop()
  }

  /**
   * Returns the sample rate of the active audio context.
   */
  public get sampleRate(): number {
    return audioPipeline.getAdapter().sampleRate
  }
}

/** Singleton instance for application-wide use. */
export const pitchDetector = new PitchDetector()
