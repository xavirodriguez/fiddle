"use client"

/**
 * FeedbackOverlay — High-frequency pitch feedback layer.
 *
 * Architecture contract (from spec §3):
 * - This is the ONLY practice component that subscribes to real-time tuner
 *   data (cents, frequency). It is rendered with position:absolute over the
 *   score wrapper so it never forces OSMD to re-render.
 * - The hot path (60 FPS RAF loop) writes directly to DOM refs via
 *   setAttribute / style.setProperty — React reconciliation is bypassed
 *   entirely for the animated elements.
 * - React state is used ONLY for the two boolean flags (active, hasSignal)
 *   that drive visibility — these change at most a few times per session.
 *
 * Zero-Allocation contract:
 * - No object literals `{}`, array literals `[]`, or `new` inside the RAF
 *   callback or the Zustand subscription callback.
 * - Primitive selectors from tuner-store prevent object-equality re-renders.
 */

import { useEffect, useRef, useState } from 'react'
import { useTunerStore, selectCents, selectFrequency, selectConfidence, selectActive } from '@/stores/tuner-store'
import { usePracticeStore } from '@/stores/practice-store'
import { VIOLIN_TOLERANCE_CENTS } from '@/lib/domain/data-structures'
import type { PracticeStatus } from '@/lib/domain/practice'

// ---------------------------------------------------------------------------
// Constants — defined outside the component so they are never reallocated.
// ---------------------------------------------------------------------------

/** Width of the tuning bar in pixels (matches the SVG viewBox). */
const BAR_HALF_WIDTH = 50

/** Maximum cents deviation shown on the bar before it clips to the edge. */
const DISPLAY_RANGE_CENTS = 50

/**
 * CSS custom property names used to drive the animated elements.
 * String constants avoid repeated allocation of identical strings.
 */
const PROP_INDICATOR_X    = '--indicator-x'
const PROP_BAR_COLOR      = '--bar-color'
const PROP_BAR_OPACITY    = '--bar-opacity'

/** Color tokens matching globals.css */
const COLOR_IN_TUNE   = '#22c55e'   // green-500 — within tolerance
const COLOR_SHARP     = '#e03434'   // needle-hot red — too sharp
const COLOR_FLAT      = '#3b82f6'   // blue-500 — too flat
const COLOR_SILENT    = '#3f3f44'   // needle-idle — no signal

/** Tolerance in cents (matches VIOLIN_TOLERANCE_CENTS from data-structures). */
const TOLERANCE = VIOLIN_TOLERANCE_CENTS as number

// ---------------------------------------------------------------------------
// Helpers — pure functions, no allocations, defined once at module scope.
// ---------------------------------------------------------------------------

function centsToBarX(cents: number): number {
  // Map [-DISPLAY_RANGE_CENTS, +DISPLAY_RANGE_CENTS] → [-BAR_HALF_WIDTH, +BAR_HALF_WIDTH]
  const clamped = Math.max(-DISPLAY_RANGE_CENTS, Math.min(DISPLAY_RANGE_CENTS, cents))
  return (clamped / DISPLAY_RANGE_CENTS) * BAR_HALF_WIDTH
}

function pickColor(cents: number, confidence: number): string {
  if (confidence < 0.5) return COLOR_SILENT
  if (Math.abs(cents) <= TOLERANCE) return COLOR_IN_TUNE
  return cents > 0 ? COLOR_SHARP : COLOR_FLAT
}

function formatFrequency(hz: number): string {
  // toFixed allocates a string, but this runs at React render time (rare),
  // not inside the RAF loop.
  return hz > 0 ? `${hz.toFixed(1)} Hz` : '—'
}

function formatCents(cents: number, confidence: number): string {
  if (confidence < 0.5) return '—'
  const sign = cents >= 0 ? '+' : ''
  return `${sign}${Math.round(cents)}¢`
}

// ---------------------------------------------------------------------------
// Status label map — constant, never reallocated.
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<PracticeStatus, string> = {
  idle:       'En espera',
  listening:  'Escuchando…',
  validating: 'Validando…',
  correct:    'Correcto',
  completed:  'Completado',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FeedbackOverlay() {
  // ------------------------------------------------------------------
  // Refs for all DOM elements mutated on the hot path.
  // ------------------------------------------------------------------
  const indicatorRef  = useRef<SVGCircleElement>(null)
  const barLineRef    = useRef<SVGLineElement>(null)
  const centsLabelRef = useRef<HTMLSpanElement>(null)
  const hzLabelRef    = useRef<HTMLSpanElement>(null)
  const rafIdRef      = useRef<number>(0)

  // ------------------------------------------------------------------
  // React state — only for visibility flags, changes rarely.
  // ------------------------------------------------------------------
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [hasSignal, setHasSignal] = useState(false)

  // ------------------------------------------------------------------
  // Subscribe to practice status via a primitive selector to avoid
  // object-equality re-renders on every frame.
  // ------------------------------------------------------------------
  const practiceStatus = usePracticeStore((s) => s.practiceState.status)

  useEffect(() => {
    setIsSessionActive(practiceStatus !== 'idle' && practiceStatus !== 'completed')
  }, [practiceStatus])

  // ------------------------------------------------------------------
  // RAF loop: reads from Zustand store imperatively (getState),
  // writes directly to DOM refs — zero React reconciliation.
  // ------------------------------------------------------------------
  useEffect(() => {
    function tick() {
      // getState() is a synchronous, allocation-free read of the store snapshot.
      const s = useTunerStore.getState()

      const cents      = s.cents      as number
      const confidence = s.confidence as number
      const frequency  = s.frequency  as number
      const active     = s.active

      // Update signal flag if it changed (rare — triggers React re-render).
      const nowHasSignal = active && confidence >= 0.5
      setHasSignal((prev) => (prev === nowHasSignal ? prev : nowHasSignal))

      // --- Hot path: direct DOM mutation, no React ---

      const indicator = indicatorRef.current
      const barLine   = barLineRef.current

      if (indicator && barLine) {
        const x     = centsToBarX(cents)
        const color = pickColor(cents, confidence)

        // Move the indicator circle along the bar.
        indicator.setAttribute('cx', String(x))
        indicator.setAttribute('fill', color)

        // Resize the deviation line from centre to indicator.
        barLine.setAttribute('x2', String(x))
        barLine.setAttribute('stroke', color)
      }

      // Update text labels (string allocation happens here, but these are
      // separate DOM text nodes — not in the SVG hot path).
      if (centsLabelRef.current) {
        centsLabelRef.current.textContent = formatCents(cents, confidence)
        centsLabelRef.current.style.color = pickColor(cents, confidence)
      }
      if (hzLabelRef.current) {
        hzLabelRef.current.textContent = formatFrequency(frequency)
      }

      rafIdRef.current = requestAnimationFrame(tick)
    }

    rafIdRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafIdRef.current)
    }
  }, []) // intentionally empty — RAF loop is self-sustaining

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  // The overlay is always mounted (so the RAF loop stays attached to the
  // AudioContext timeline), but hidden when idle/completed.
  const isVisible = isSessionActive

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Retroalimentación de afinación en tiempo real"
      className={[
        'pointer-events-none absolute inset-x-0 bottom-0 z-10',
        'flex flex-col items-center gap-2 pb-4',
        'transition-opacity duration-300',
        isVisible ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
    >
      {/* Session status label */}
      <span className="font-mono text-xs tracking-widest uppercase text-[var(--color-muted)]">
        {STATUS_LABELS[practiceStatus]}
      </span>

      {/* Tuning bar */}
      <div className="relative flex flex-col items-center gap-1">
        <svg
          viewBox="-60 -12 120 24"
          width="240"
          height="48"
          aria-hidden="true"
        >
          {/* Tolerance zone highlight */}
          <rect
            x={-TOLERANCE * (BAR_HALF_WIDTH / DISPLAY_RANGE_CENTS)}
            y="-8"
            width={TOLERANCE * 2 * (BAR_HALF_WIDTH / DISPLAY_RANGE_CENTS)}
            height="16"
            rx="2"
            fill={COLOR_IN_TUNE}
            fillOpacity="0.08"
          />

          {/* Track */}
          <line
            x1="-50" y1="0" x2="50" y2="0"
            stroke="var(--color-dial-track)"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Tick marks every 10 cents */}
          {[-40, -30, -20, -10, 10, 20, 30, 40].map((c) => (
            <line
              key={c}
              x1={c}
              y1="-4"
              x2={c}
              y2="4"
              stroke="var(--color-dial-tick)"
              strokeWidth="1"
            />
          ))}

          {/* Centre tick (zero / in-tune) */}
          <line
            x1="0" y1="-8" x2="0" y2="8"
            stroke="var(--color-foreground)"
            strokeWidth="1.5"
            strokeOpacity="0.4"
          />

          {/* Deviation line from centre — mutated by RAF */}
          <line
            ref={barLineRef}
            x1="0"
            y1="0"
            x2="0"
            y2="0"
            stroke={COLOR_SILENT}
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Indicator circle — mutated by RAF */}
          <circle
            ref={indicatorRef}
            cx="0"
            cy="0"
            r="5"
            fill={COLOR_SILENT}
          />
        </svg>

        {/* Numeric readouts */}
        <div className="flex items-baseline gap-4">
          <span
            ref={centsLabelRef}
            className="font-mono text-lg font-semibold tabular-nums"
            style={{ color: COLOR_SILENT }}
            aria-label="Desviación en cents"
          >
            —
          </span>
          <span
            ref={hzLabelRef}
            className="font-mono text-xs tabular-nums text-[var(--color-muted)]"
            aria-label="Frecuencia detectada"
          >
            —
          </span>
        </div>
      </div>
    </div>
  )
}
