"use client"

/**
 * ScoreViewer
 *
 * A high-performance MusicXML renderer based on OpenSheetMusicDisplay (OSMD).
 *
 * Design Decisions & Performance Optimization:
 *
 * 1. Why React does NOT control the cursor:
 *    - Reconciliation Cost: React's virtual DOM diffing is too slow for 60FPS
 *      musical synchronization. A `setState` on every note tick would trigger
 *      unnecessary component tree evaluations.
 *    - Reflow Cost: OSMD cursor movements involve direct SVG/Canvas manipulations.
 *      Letting React manage this via props would cause constant re-renders and
 *      potential layout thrashing.
 *
 * 2. Imperative API (useImperativeHandle):
 *    - Provides a direct bridge for the Musical Scheduler to trigger visual
 *      updates without entering the React render cycle.
 *    - ensures that visual feedback is sample-accurate and jitter-free.
 *
 * 3. Client-Only (Dynamic Loading):
 *    - OSMD relies on browser APIs (DOM, Canvas, WebGL). We use dynamic
 *      imports inside useEffect to remain compatible with Next.js SSR.
 *
 * 4. Zero-allocation Strategy:
 *    - The OSMD instance and current pointers are kept in `useRef` to avoid
 *      Garbage Collection (GC) pressure during active practice sessions.
 */

import type { IOSMDOptions,OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import React, { forwardRef,useEffect, useImperativeHandle, useRef } from 'react'

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
     *
     * DESIGN DECISIONS & PERFORMANCE:
     * 1. React Reconciliation Bypass: Calling these methods directly from the
     *    practice service (DSP/Scheduler) allows for 60 FPS visual updates
     *    without triggering React's Virtual DOM diffing. This is critical for
     *    maintaining a stable frame rate.
     * 2. Layout Reflow Prevention: OSMD cursor movements are optimized to
     *    avoid full browser layout recalculations where possible. By using
     *    an imperative bridge, we prevent React from unintentionally triggering
     *    unnecessary style/layout updates on the container.
     */
    useImperativeHandle(ref, () => ({
      async loadScore(musicXml: string) {
        // Handle case where OSMD might still be loading asynchronously
        if (!osmdRef.current) {
          let attempts = 0
          while (!osmdRef.current && attempts < 50) {
            await new Promise((resolve) => setTimeout(resolve, 100))
            attempts++
          }
        }

        if (!osmdRef.current || !containerRef.current) {
          throw new Error('OSMD failed to initialize in time')
        }

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
     * Dynamic import ensures the library is only loaded on the client,
     * as OSMD depends on browser-only Canvas/SVG APIs.
     */
    useEffect(() => {
      let isMounted = true

      async function initOsmd() {
        if (!containerRef.current) return

        const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay')

        if (isMounted && containerRef.current) {
          const osmd = new OpenSheetMusicDisplay(containerRef.current, OSMD_OPTIONS)
          osmdRef.current = osmd
        }
      }

      void initOsmd()

      return () => {
        isMounted = false
        osmdRef.current?.clear()
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
