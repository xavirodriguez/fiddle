"use client"

/**
 * PracticeContainer — Smart orchestrator.
 *
 * Wires the toolbar controls to the Zustand practice store and renders the
 * sheet music area. OSMD is loaded lazily via `next/dynamic` so it never
 * blocks the initial page paint.
 */

import dynamic from 'next/dynamic'
import { usePracticeStore } from '@/stores/practice-store'
import { PracticeToolbar } from './practice-toolbar'
import { FeedbackOverlay } from './feedback-overlay'

// ---------------------------------------------------------------------------
// Lazy OSMD wrapper — loaded only on the client, no SSR.
// The heavy opensheetmusicdisplay bundle is split into its own chunk.
// ---------------------------------------------------------------------------

const SheetMusicWrapper = dynamic(
  () =>
    import('./sheet-music-wrapper').then((mod) => ({ default: mod.SheetMusicWrapper })),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Cargando partitura…</p>
      </div>
    ),
  },
)

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PracticeContainer() {
  const practiceState = usePracticeStore((s) => s.practiceState)
  const nextNote = usePracticeStore((s) => s.nextNote)
  const prevNote = usePracticeStore((s) => s.prevNote)
  const internalUpdate = usePracticeStore((s) => s.internalUpdate)

  const isPlaying = practiceState.status !== 'idle' && practiceState.status !== 'completed'
  const isLoopEnabled = practiceState.loopRegion?.isEnabled ?? false

  function handleTogglePlay() {
    if (isPlaying) {
      internalUpdate({ type: 'STOP' })
    } else {
      internalUpdate({ type: 'START' })
    }
  }

  function handleReset() {
    internalUpdate({ type: 'RESET' })
  }

  function handleToggleLoop() {
    internalUpdate({
      type: 'UPDATE_LOOP_REGION',
      payload: { isEnabled: !isLoopEnabled },
    })
  }

  function handleScoreReady(totalNotes: number) {
    // Reserved for future use: e.g. update store boundary, enable nav buttons.
    void totalNotes
  }

  function handleScoreError(error: Error) {
    console.error('[PracticeContainer] OSMD load error:', error)
  }

  return (
    <div className="flex h-full w-full flex-col">
      <PracticeToolbar
        isPlaying={isPlaying}
        isLoopEnabled={isLoopEnabled}
        onTogglePlay={handleTogglePlay}
        onReset={handleReset}
        onPrevNote={prevNote}
        onNextNote={nextNote}
        onToggleLoop={handleToggleLoop}
      />

      {/*
        The score wrapper is `relative` so FeedbackOverlay (position:absolute)
        stacks on top of OSMD without affecting its layout. SheetMusicWrapper
        is React.memo'd and never re-renders due to tuner updates because it
        receives no pitch props — FeedbackOverlay owns all real-time data.
      */}
      <div className="relative flex flex-1 overflow-hidden bg-background">
        <SheetMusicWrapper
          musicXml={null}
          cursorIndex={practiceState.currentIndex}
          onReady={handleScoreReady}
          onError={handleScoreError}
        />
        <FeedbackOverlay />
      </div>
    </div>
  )
}
