"use client"

/**
 * SheetMusicWrapper
 *
 * Manages the full lifecycle of an OpenSheetMusicDisplay (OSMD) instance
 * using React's imperative escape hatch (useRef + useEffect).
 *
 * Design decisions:
 * - Wrapped in React.memo to prevent re-renders driven by parent state
 *   changes that are irrelevant to the score (e.g. pitch detection updates).
 * - OSMD is imported at module level here because this file is already
 *   loaded lazily via `next/dynamic` in PracticeContainer, so the heavy
 *   library never blocks the initial page load.
 * - The cursor is controlled imperatively through the `cursorIndex` prop:
 *   when the value changes, the effect moves the OSMD cursor to that note.
 *   No React state is stored inside this component for cursor position.
 *
 * Architecture note: sits in the UI / Presentation layer. It communicates
 * upward only via callbacks, never importing from stores directly.
 */

import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import React, { useEffect, useRef } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SheetMusicWrapperProps {
  /**
   * Raw MusicXML string (not a URL). Pass `null` to show the empty state.
   * Changing this value triggers a full OSMD reload.
   */
  readonly musicXml: string | null

  /**
   * The zero-based index of the note the cursor should point to.
   * When this changes the effect calls `cursor.next()` / `cursor.previous()`
   * until the internal OSMD cursor reaches the matching position.
   */
  readonly cursorIndex: number

  /**
   * Called once OSMD has rendered the score, passing back the total note
   * count so the container can clamp navigation boundaries.
   */
  readonly onReady?: (totalNotes: number) => void

  /**
   * Called when OSMD encounters an unrecoverable load error.
   */
  readonly onError?: (error: Error) => void
}

// ---------------------------------------------------------------------------
// OSMD render options (defined outside component — constant reference)
// ---------------------------------------------------------------------------

const OSMD_OPTIONS = {
  autoResize: true,
  drawTitle: false,
  drawComposer: false,
  drawLyricist: false,
  drawSubtitle: false,
  drawCredits: false,
  drawPartNames: false,
  drawingParameters: 'compacttight',
  renderSingleHorizontalStaffline: false,
  pageFormat: 'Endless',
  cursorsOptions: [
    {
      type: 0, // Standard cursor
      color: '#3b82f6', // Tailwind blue-500
      alpha: 0.3,
      follow: true,
    },
  ],
} as const

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function SheetMusicWrapperInner({
  musicXml,
  cursorIndex,
  onReady,
  onError,
}: SheetMusicWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)
  const internalIndexRef = useRef<number>(0)
  const isLoadedRef = useRef<boolean>(false)

  // -------------------------------------------------------------------------
  // Effect 1: OSMD lifecycle — create, load, render, destroy
  // Runs only when `musicXml` changes.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false

    async function loadScore() {
      if (!container) return

      // Dispose previous instance cleanly
      if (osmdRef.current) {
        try {
          osmdRef.current.clear()
        } catch {
          // OSMD may throw on clear if the DOM was already removed; safe to ignore
        }
        osmdRef.current = null
        isLoadedRef.current = false
        internalIndexRef.current = 0
      }

      if (!musicXml) return

      try {
        const osmd = new OpenSheetMusicDisplay(container, OSMD_OPTIONS as Record<string, unknown>)
        osmdRef.current = osmd

        await osmd.load(musicXml)

        if (cancelled) return

        osmd.render()
        isLoadedRef.current = true

        // Initialise cursor at position 0
        osmd.cursor.reset()
        osmd.cursor.show()
        internalIndexRef.current = 0

        // Count notes by iterating the cursor (reset it afterwards)
        let totalNotes = 0
        const countCursor = osmd.cursor
        countCursor.reset()
        while (!countCursor.Iterator.EndReached) {
          totalNotes++
          countCursor.next()
        }
        countCursor.reset()
        countCursor.show()

        onReady?.(totalNotes)
      } catch (err) {
        if (!cancelled) {
          onError?.(err instanceof Error ? err : new Error(String(err)))
        }
      }
    }

    void loadScore()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicXml])

  // -------------------------------------------------------------------------
  // Effect 2: Cursor synchronisation
  // Moves the OSMD cursor to match `cursorIndex` whenever it changes.
  // Uses a step-by-step approach (next/previous) to avoid internal OSMD
  // bugs with absolute positioning.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const osmd = osmdRef.current
    if (!osmd || !isLoadedRef.current) return

    const cursor = osmd.cursor
    const current = internalIndexRef.current
    const delta = cursorIndex - current

    if (delta === 0) return

    if (delta > 0) {
      for (let i = 0; i < delta; i++) {
        if (!cursor.Iterator.EndReached) cursor.next()
      }
    } else {
      // OSMD cursor does not natively support backwards movement.
      // Reset to 0 and advance to the target index.
      cursor.reset()
      cursor.show()
      for (let i = 0; i < cursorIndex; i++) {
        if (!cursor.Iterator.EndReached) cursor.next()
      }
    }

    internalIndexRef.current = cursorIndex
  }, [cursorIndex])

  // -------------------------------------------------------------------------
  // Cleanup on unmount
  // -------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (osmdRef.current) {
        try {
          osmdRef.current.clear()
        } catch {
          // safe to ignore
        }
        osmdRef.current = null
        isLoadedRef.current = false
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      aria-label="Partitura musical"
      role="img"
      className="h-full w-full overflow-y-auto px-4 py-6"
    />
  )
}

export const SheetMusicWrapper = React.memo(SheetMusicWrapperInner)
SheetMusicWrapper.displayName = 'SheetMusicWrapper'
