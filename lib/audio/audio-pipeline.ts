/**
 * AudioPipeline
 *
 * Reactive pipeline using RxJS to process audio frames.
 * Orchestrates: Hardware -> Pitch Detection -> Note Segmenter -> Event Sink.
 *
 * Zero-Allocation Contract:
 * Reuses SHARED_PITCH_FRAME and other pre-allocated objects.
 */

import { Subject, Observable, from } from 'rxjs'
import { map, tap, share } from 'rxjs/operators'
import { AudioCapturePort } from '../ports/audio.port'
import { PitchDetector } from '../pitch-detector'
import { SHARED_PITCH_FRAME, PitchFrame } from '../domain/data-structures'
import { Hertz, Cents, frequencyToMidi } from '../domain/musical-domain'
import { createActor } from 'xstate'
import { noteSegmenterMachine, NoteSegmenterEvent } from '../practice/note-segmenter'

export interface AudioPipelineConfig {
  rmsThreshold: number
  confidenceThreshold: number
}

export class AudioPipeline {
  private frameSubject = new Subject<Float32Array>()
  private detector: PitchDetector | null = null
  private segmenterActor = createActor(noteSegmenterMachine)

  /** Pre-allocated event object to avoid allocations in 60FPS loop */
  private readonly REUSABLE_EVENT: NoteSegmenterEvent = {
    type: 'FRAME',
    frame: SHARED_PITCH_FRAME as PitchFrame
  }

  /** Observable of processed PitchFrames */
  public readonly pitch$: Observable<PitchFrame>

  /** Observable of note segmenter state changes */
  public readonly segmenter$: Observable<any>

  constructor(
    private capturePort: AudioCapturePort,
    private config: AudioPipelineConfig = { rmsThreshold: 0.01, confidenceThreshold: 0.8 }
  ) {
    this.detector = new PitchDetector(this.capturePort.sampleRate)
    this.segmenterActor.start()

    this.pitch$ = this.frameSubject.pipe(
      map((buffer) => {
        const result = this.detector!.detectPitchWithValidation(buffer, this.config.rmsThreshold)

        // Zero-allocation update of SHARED_PITCH_FRAME
        SHARED_PITCH_FRAME.frequency = result.pitchHz as Hertz
        SHARED_PITCH_FRAME.confidence = result.confidence
        SHARED_PITCH_FRAME.timestamp = this.capturePort.getCurrentTime()

        // Cents calculation if pitch found
        if (result.pitchHz > 0) {
          const midiResult = frequencyToMidi(result.pitchHz as Hertz)
          if (midiResult.isOk()) {
            const fractionalMidi = midiResult.value
            const roundedMidi = Math.round(fractionalMidi)
            SHARED_PITCH_FRAME.centsDeviation = ((fractionalMidi - roundedMidi) * 100) as Cents
          }
        } else {
          SHARED_PITCH_FRAME.centsDeviation = 0 as Cents
        }

        return SHARED_PITCH_FRAME as PitchFrame
      }),
      tap(() => {
        // Use pre-allocated event object
        this.segmenterActor.send(this.REUSABLE_EVENT)
      }),
      share()
    )

    this.segmenter$ = from(this.segmenterActor).pipe(share())
  }

  /**
   * Starts the pipeline by connecting to the hardware stream.
   */
  async start(): Promise<void> {
    await this.capturePort.startStream((buffer) => {
      this.frameSubject.next(buffer)
    })
  }

  /**
   * Stops the pipeline and hardware stream.
   */
  async stop(): Promise<void> {
    await this.capturePort.stopStream()
    this.segmenterActor.stop()
  }

  /**
   * Resets the internal state (segmenter, etc).
   */
  reset(): void {
    this.segmenterActor.send({ type: 'RESET' })
  }
}
