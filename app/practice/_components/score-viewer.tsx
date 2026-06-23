"use client"

/**
 * ScoreViewer
 *
 * A high-performance MusicXML renderer based on OpenSheetMusicDisplay (OSMD).
 *
 * Design Decisions:
 * 1. Imperative API: Exposes methods via useImperativeHandle to avoid
 *    React re-renders on every cursor movement (60 FPS).
 * 2. Performance: Minimizes DOM reflows by managing cursor state internally.
 * 3. Client-Only: Designed for Next.js App Router, requiring dynamic loading.
 * 4. Zero-allocation: Reuses the OSMD instance to avoid GC pressure.
 */

import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react'
import { OpenSheetMusicDisplay, IOSMDOptions } from 'opensheetmusicdisplay'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoreViewerRef {
  loadScore: (musicXml: string) => Promise<void>
  nextStep: () => void
  resetCursor: () => void
  moveToMeasure: (measureIndex: number) => void
  getCurrentNoteIndex: () => number
}

interface ScoreViewerProps {
  onReady?: (totalNotes: number) => void
  onError?: (error: Error) => void
  className?: string
}

// ---------------------------------------------------------------------------
// OSMD Constants
// ---------------------------------------------------------------------------

const OSMD_OPTIONS: IOSMDOptions = {
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
      type: 0,
      color: '#3b82f6', // Tailwind blue-500
      alpha: 0.3,
      follow: true,
    },
  ],
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ScoreViewer = forwardRef<ScoreViewerRef, ScoreViewerProps>(
  ({ onReady, onError, className }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)
    const currentNoteIndexRef = useRef<number>(0)

    /**
     * Expose imperative API to parents.
     */
    useImperativeHandle(ref, () => ({
      async loadScore(musicXml: string) {
        if (!osmdRef.current || !containerRef.current) return

        try {
          await osmdRef.current.load(musicXml)
          osmdRef.current.render()
          osmdRef.current.cursor.show()

          // Calculate total notes
          let totalNotes = 0
          const cursor = osmdRef.current.cursor
          cursor.reset()
          while (!cursor.Iterator.EndReached) {
            totalNotes++
            cursor.next()
          }
          cursor.reset()
          currentNoteIndexRef.current = 0

          onReady?.(totalNotes)
        } catch (err) {
          onError?.(err instanceof Error ? err : new Error('Failed to load score'))
        }
      },

      nextStep() {
        const osmd = osmdRef.current
        if (!osmd || osmd.cursor.Iterator.EndReached) return

        osmd.cursor.next()
        currentNoteIndexRef.current++
      },

      resetCursor() {
        const osmd = osmdRef.current
        if (!osmd) return

        osmd.cursor.reset()
        currentNoteIndexRef.current = 0
      },

      moveToMeasure(measureIndex: number) {
        const osmd = osmdRef.current
        if (!osmd) return

        // OSMD doesn't have a direct "jump to measure" for the cursor that is
        // reliable across all versions, so we reset and advance.
        // This is still faster than a full React re-render.
        osmd.cursor.reset()
        currentNoteIndexRef.current = 0

        while (!osmd.cursor.Iterator.EndReached &&
               osmd.cursor.Iterator.CurrentMeasureIndex < measureIndex) {
          osmd.cursor.next()
          currentNoteIndexRef.current++
        }
      },

      getCurrentNoteIndex() {
        return currentNoteIndexRef.current
      }
    }))

    /**
     * Initialize OSMD instance on mount.
     */
    useEffect(() => {
      if (!containerRef.current) return

      const osmd = new OpenSheetMusicDisplay(containerRef.current, OSMD_OPTIONS)
      osmdRef.current = osmd

      return () => {
        osmd.clear()
        osmdRef.current = null
      }
    }, [])

    return (
      <div
        ref={containerRef}
        className={className}
        style={{ width: '100%', height: '100%', minHeight: '300px' }}
      />
    )
  }
)

ScoreViewer.displayName = 'ScoreViewer'
