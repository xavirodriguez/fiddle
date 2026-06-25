"use client"

import { ChevronLeft, ChevronRight, Play, Repeat,RotateCcw, Square } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PracticeToolbarProps {
  /** Whether a practice session is currently active. */
  readonly isPlaying: boolean
  /** Whether the loop / drill mode is enabled. */
  readonly isLoopEnabled: boolean
  /** Called when the user presses the Play / Stop toggle. */
  readonly onTogglePlay: () => void
  /** Called when the user presses the Reset button. */
  readonly onReset: () => void
  /** Called when the user presses the Previous Note button. */
  readonly onPrevNote: () => void
  /** Called when the user presses the Next Note button. */
  readonly onNextNote: () => void
  /** Called when the user toggles loop / drill mode. */
  readonly onToggleLoop: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * PracticeToolbar — "Dumb" presentational component.
 *
 * Receives all state and callbacks via props; owns no internal state.
 * Renders the control strip at the top of the practice panel.
 */
export function PracticeToolbar({
  isPlaying,
  isLoopEnabled,
  onTogglePlay,
  onReset,
  onPrevNote,
  onNextNote,
  onToggleLoop,
}: PracticeToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Controles de práctica"
      className="flex h-14 w-full items-center gap-2 border-b border-border bg-background px-4"
    >
      {/* Play / Stop */}
      <button
        type="button"
        onClick={onTogglePlay}
        aria-label={isPlaying ? 'Detener práctica' : 'Iniciar práctica'}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {isPlaying ? (
          <Square className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Play className="h-4 w-4" aria-hidden="true" />
        )}
      </button>

      {/* Reset */}
      <button
        type="button"
        onClick={onReset}
        aria-label="Reiniciar ejercicio"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
      </button>

      <div className="mx-2 h-6 w-px bg-border" aria-hidden="true" />

      {/* Previous Note */}
      <button
        type="button"
        onClick={onPrevNote}
        aria-label="Nota anterior"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>

      {/* Next Note */}
      <button
        type="button"
        onClick={onNextNote}
        aria-label="Nota siguiente"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>

      <div className="mx-2 h-6 w-px bg-border" aria-hidden="true" />

      {/* Loop / Drill Mode */}
      <button
        type="button"
        onClick={onToggleLoop}
        aria-label={isLoopEnabled ? 'Desactivar modo bucle' : 'Activar modo bucle'}
        aria-pressed={isLoopEnabled}
        className={[
          'inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isLoopEnabled
            ? 'border-foreground bg-foreground text-background'
            : 'border-border bg-background text-foreground hover:bg-muted',
        ].join(' ')}
      >
        <Repeat className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
