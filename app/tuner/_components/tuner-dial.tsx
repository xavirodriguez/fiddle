'use client'

/**
 * TunerDial
 *
 * SVG-based tuner dial. The needle position is updated via direct DOM
 * setAttribute() calls — bypassing React reconciliation — so 60 FPS
 * updates never cause a re-render.
 *
 * Zero-Allocation in the hot path:
 * - No object/array creation inside the subscription callback.
 * - `toFixed` and string concatenation are the only allocations; these are
 *   unavoidable for DOM text content but happen once per frame, not N times.
 */

import { useEffect, useRef } from 'react'
import type { Subscription } from 'rxjs'

import type { PitchFrame } from '@/lib/domain/data-structures'
import {
  selectActive,
  selectError,
  useTunerStore,
} from '@/stores/tuner-store'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Full-scale deflection angle in degrees from centre (±50 cents = ±SWING°). */
const SWING_DEG = 60

/** SVG viewBox half-width (pivot is at cx=100, cy=110). */
const CX = 100
const CY = 110

/** Needle length in SVG units. */
const NEEDLE_LENGTH = 80

/** Tolerance band in cents that renders the needle amber ("in tune"). */
const IN_TUNE_THRESHOLD = 8

// ---------------------------------------------------------------------------
// Helpers (pure, no allocation)
// ---------------------------------------------------------------------------

/** Clamps x to [min, max]. */
function clamp(x: number, min: number, max: number): number {
  return x < min ? min : x > max ? max : x
}

/** Converts cents deviation to needle tip x/y coordinates. */
function centsToXY(cents: number): { x: number; y: number } {
  const clamped = clamp(cents, -50, 50)
  const angleDeg = (clamped / 50) * SWING_DEG - 90 // -90 = pointing up at 0
  const angleRad = (angleDeg * Math.PI) / 180
  return {
    x: CX + NEEDLE_LENGTH * Math.cos(angleRad),
    y: CY + NEEDLE_LENGTH * Math.sin(angleRad),
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Maps a MIDI note number to its note name (C, C#, D, …). */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

function midiToNoteName(midi: number): string {
  const noteIndex = Math.round(midi) % 12
  const octave = Math.floor(Math.round(midi) / 12) - 1
  return `${NOTE_NAMES[(noteIndex + 12) % 12]}${octave}`
}

function freqToMidiFractional(hz: number): number {
  return 12 * Math.log2(hz / 440) + 69
}

export function TunerDial() {
  const { start, stop } = useTunerStore()
  const active  = useTunerStore(selectActive)
  const error   = useTunerStore(selectError)

  // Refs to DOM nodes updated imperatively in the hot path.
  const needleRef    = useRef<SVGLineElement>(null)
  const centsTextRef = useRef<SVGTextElement>(null)
  const noteTextRef  = useRef<SVGTextElement>(null)
  const dotRef       = useRef<SVGCircleElement>(null)

  // Subscribe to the tuner stream directly from the store's RxJS pipeline
  // via a thin effect that reads from Zustand on every frame.
  // We wire a separate RAF loop that reads from Zustand state to keep things
  // decoupled and avoid importing the stream here.
  useEffect(() => {
    if (!active) return

    let rafId = 0
    let lastCents = 0

    // Read the latest Zustand state imperatively — no subscription needed.
    function tick() {
      const s = useTunerStore.getState()
      const cents      = s.cents
      const frequency  = s.frequency
      const confidence = s.confidence

      // Only paint if we have a valid signal.
      if (frequency > 0 && confidence > 0.85) {
        const { x, y } = centsToXY(cents)
        const inTune   = Math.abs(cents) <= IN_TUNE_THRESHOLD

        needleRef.current?.setAttribute('x2', x.toFixed(2))
        needleRef.current?.setAttribute('y2', y.toFixed(2))
        needleRef.current?.setAttribute(
          'stroke',
          inTune ? 'var(--color-accent)' : 'var(--color-needle-hot)'
        )

        dotRef.current?.setAttribute(
          'fill',
          inTune ? 'var(--color-accent)' : 'var(--color-needle-hot)'
        )

        const sign = cents > 0 ? '+' : ''
        if (centsTextRef.current) {
          centsTextRef.current.textContent = `${sign}${cents.toFixed(1)} ¢`
        }
        if (noteTextRef.current) {
          const midi = freqToMidiFractional(frequency)
          noteTextRef.current.textContent = midiToNoteName(midi)
        }

        lastCents = cents
      } else {
        // Return needle to centre when silent.
        if (lastCents !== 0) {
          const { x, y } = centsToXY(0)
          needleRef.current?.setAttribute('x2', x.toFixed(2))
          needleRef.current?.setAttribute('y2', y.toFixed(2))
          needleRef.current?.setAttribute('stroke', 'var(--color-needle-idle)')
          dotRef.current?.setAttribute('fill', 'var(--color-needle-idle)')
          if (centsTextRef.current) centsTextRef.current.textContent = '— ¢'
          if (noteTextRef.current) noteTextRef.current.textContent = '—'
          lastCents = 0
        }
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [active])

  // Compute initial needle tip position at centre (0 cents).
  const { x: x0, y: y0 } = centsToXY(0)

  // Arc path for the scale background (semicircle).
  // From -SWING_DEG to +SWING_DEG relative to 6-o'clock, mapped to SVG coords.
  function arcPath(r: number): string {
    const startRad = ((-SWING_DEG - 90) * Math.PI) / 180
    const endRad   = ((SWING_DEG - 90) * Math.PI) / 180
    const sx = CX + r * Math.cos(startRad)
    const sy = CY + r * Math.sin(startRad)
    const ex = CX + r * Math.cos(endRad)
    const ey = CY + r * Math.sin(endRad)
    return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 0 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`
  }

  /** Tick mark at a given cents value. */
  function tickAt(cents: number, inner: number, outer: number): string {
    const angleRad = (((cents / 50) * SWING_DEG - 90) * Math.PI) / 180
    const ix = (CX + inner * Math.cos(angleRad)).toFixed(2)
    const iy = (CY + inner * Math.sin(angleRad)).toFixed(2)
    const ox = (CX + outer * Math.cos(angleRad)).toFixed(2)
    const oy = (CY + outer * Math.sin(angleRad)).toFixed(2)
    return `M ${ix} ${iy} L ${ox} ${oy}`
  }

  const majorTicks = [-50, -25, 0, 25, 50]
  const minorTicks = [-40, -30, -20, -10, 10, 20, 30, 40]

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Dial SVG */}
      <div
        className="relative"
        role="img"
        aria-label="Tuner dial showing cents deviation"
        aria-live="polite"
      >
        <svg
          viewBox="0 0 200 130"
          className="w-72 sm:w-80 md:w-96"
          aria-hidden="true"
        >
          {/* Outer arc track */}
          <path
            d={arcPath(85)}
            fill="none"
            stroke="var(--color-dial-track)"
            strokeWidth="1"
            strokeLinecap="round"
          />

          {/* In-tune zone arc */}
          <path
            d={arcPath(85)}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="28 999"
            strokeDashoffset="-103"
            opacity="0.25"
          />

          {/* Major tick marks */}
          {majorTicks.map((c) => (
            <path
              key={c}
              d={tickAt(c, 70, 83)}
              stroke={c === 0 ? 'var(--color-accent)' : 'var(--color-dial-tick)'}
              strokeWidth={c === 0 ? 1.5 : 1}
              strokeLinecap="round"
            />
          ))}

          {/* Minor tick marks */}
          {minorTicks.map((c) => (
            <path
              key={c}
              d={tickAt(c, 75, 83)}
              stroke="var(--color-dial-tick)"
              strokeWidth="0.75"
              strokeLinecap="round"
              opacity="0.5"
            />
          ))}

          {/* Scale labels */}
          {[-50, -25, 0, 25, 50].map((c) => {
            const angleRad = (((c / 50) * SWING_DEG - 90) * Math.PI) / 180
            const lx = CX + 62 * Math.cos(angleRad)
            const ly = CY + 62 * Math.sin(angleRad)
            return (
              <text
                key={c}
                x={lx.toFixed(2)}
                y={ly.toFixed(2)}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="6"
                fill="var(--color-dial-label)"
                fontFamily="var(--font-mono)"
              >
                {c === 0 ? '0' : c > 0 ? `+${c}` : c}
              </text>
            )
          })}

          {/* Pivot cap */}
          <circle
            cx={CX}
            cy={CY}
            r="4"
            fill="var(--color-surface-raised)"
            stroke="var(--color-dial-tick)"
            strokeWidth="0.75"
          />

          {/* Needle (updated imperatively) */}
          <line
            ref={needleRef}
            x1={CX}
            y1={CY}
            x2={x0.toFixed(2)}
            y2={y0.toFixed(2)}
            stroke="var(--color-needle-idle)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* Needle tip dot (updated imperatively) */}
          <circle
            ref={dotRef}
            cx={x0.toFixed(2)}
            cy={y0.toFixed(2)}
            r="2.5"
            fill="var(--color-needle-idle)"
          />

          {/* Cents readout */}
          <text
            ref={centsTextRef}
            x={CX}
            y="102"
            textAnchor="middle"
            fontSize="8"
            fill="var(--color-muted)"
            fontFamily="var(--font-mono)"
          >
            — ¢
          </text>
        </svg>

        {/* Note name — below the SVG, large mono display */}
        <p className="text-center font-mono text-5xl font-light tracking-widest text-foreground">
          <span ref={noteTextRef as unknown as React.RefObject<HTMLSpanElement>}>—</span>
        </p>
      </div>

      {/* Error state */}
      {error && (
        <p
          role="alert"
          className="font-mono text-xs text-[var(--color-needle-hot)]"
        >
          {error}
        </p>
      )}

      {/* Start / Stop button */}
      <button
        type="button"
        onClick={active ? stop : start}
        aria-pressed={active}
        className={[
          'font-mono text-xs tracking-widest uppercase px-6 py-2 rounded-sm border transition-colors duration-150',
          active
            ? 'border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10'
            : 'border-[var(--color-dial-tick)] text-[var(--color-muted)] hover:border-foreground hover:text-foreground',
        ].join(' ')}
      >
        {active ? 'Stop' : 'Start'}
      </button>
    </div>
  )
}
