"use client"

/**
 * PracticeContainer — Smart orchestrator.
 *
 * Wires the toolbar controls to the Zustand practice store and renders the
 * sheet music area. OSMD is loaded lazily via `next/dynamic` so it never
 * blocks the initial page paint.
 */

import dynamic from 'next/dynamic'
import { useEffect, useRef } from 'react'

import { audioManager } from '@/lib/infrastructure/audio-manager'
import { practiceService } from '@/lib/practice/practice-service'
import { useAppStore } from '@/stores/app-store'

import { FeedbackOverlay } from './feedback-overlay'
import { PracticeToolbar } from './practice-toolbar'
import { type ScoreViewerRef } from './score-viewer'

// ---------------------------------------------------------------------------
// Lazy ScoreViewer — loaded only on the client, no SSR.
// ---------------------------------------------------------------------------

const ScoreViewer = dynamic(
  () =>
    import('./score-viewer').then((mod) => ({ default: mod.ScoreViewer })),
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
  const practiceState = useAppStore((s) => s.practiceState)
  const nextNote = useAppStore((s) => s.nextNote)
  const prevNote = useAppStore((s) => s.prevNote)
  const internalUpdate = useAppStore((s) => s.internalUpdate)
  const scoreRef = useRef<ScoreViewerRef>(null)

  const isPlaying = practiceState.status !== 'idle' && practiceState.status !== 'completed'
  const isLoopEnabled = practiceState.loopRegion?.isEnabled ?? false

  async function handleTogglePlay() {
    if (isPlaying) {
      practiceService.stop()
      internalUpdate({ type: 'STOP' })
    } else {
      await audioManager.initialize()
      await practiceService.initialize(practiceState.exercise, (event) => {
        scoreRef.current?.nextStep()
      })
      await practiceService.start()
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
        <ScoreViewer
          ref={scoreRef}
          onReady={handleScoreReady}
          onError={handleScoreError}
        />
        <FeedbackOverlay />
      </div>
    </div>
  )
}
