"use client"

/**
 * PracticeContainer — Smart orchestrator.
 *
 * Wires the toolbar controls to the Zustand practice store and renders the
 * sheet music area. OSMD is loaded lazily via `next/dynamic` so it never
 * blocks the initial page paint.
 */

import dynamic from 'next/dynamic'
import { useEffect,useRef, useState } from 'react'

import { loadAsync } from '@/lib/persistence/persistence-core'
import { type SessionHistory,SessionHistorySchema } from '@/lib/persistence/storage-types'
import { audioManager } from '@/lib/infrastructure/audio-manager'
import { practiceService } from '@/lib/practice/practice-service'
import { useAppStore } from '@/stores/app-store'

import { AnalyticsDashboard } from './analytics-dashboard'
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

  const [showAnalytics, setShowAnalytics] = useState(false)
  const [history, setHistory] = useState<SessionHistory | null>(null)

  useEffect(() => {
    if (showAnalytics || practiceState.status === 'completed') {
      const loadHistory = async () => {
        const data = await loadAsync('violin-session-history', SessionHistorySchema)
        if (data) setHistory(data)
      }
      void loadHistory()
    }
  }, [showAnalytics, practiceState.status])

  const isPlaying = practiceState.status !== 'idle' && practiceState.status !== 'completed'
  const isLoopEnabled = practiceState.loopRegion?.isEnabled ?? false

  const handleTogglePlay = () => {
    const toggle = async () => {
      if (isPlaying) {
        practiceService.stop()
        internalUpdate({ type: 'STOP' })
      } else {
        await audioManager.initialize()
        await practiceService.initialize(practiceState.exercise, (_event) => {
          scoreRef.current?.nextStep()
        })
        await practiceService.start()
        internalUpdate({ type: 'START' })
      }
    }
    toggle().catch((error: unknown) => {
      console.error('[PracticeContainer] Toggle play failed:', error)
    })
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

  function handleScoreReady(_totalNotes: number) {
    // Reserved for future use: e.g. update store boundary, enable nav buttons.
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
        onShowAnalytics={() => setShowAnalytics(!showAnalytics)}
        isShowingAnalytics={showAnalytics}
      />

      {/*
        The score wrapper is `relative` so FeedbackOverlay (position:absolute)
        stacks on top of OSMD without affecting its layout. SheetMusicWrapper
        is React.memo'd and never re-renders due to tuner updates because it
        receives no pitch props — FeedbackOverlay owns all real-time data.
      */}
      <div className="relative flex flex-1 overflow-hidden bg-background">
        {(showAnalytics || practiceState.status === 'completed') ? (
          <div className="absolute inset-0 z-50 overflow-auto bg-background/95 backdrop-blur-sm">
             <div className="mx-auto max-w-4xl pt-8 pb-16">
               <div className="flex items-center justify-between px-6 mb-4">
                 <h2 className="text-2xl font-bold">
                   {practiceState.status === 'completed' ? '¡Sesión Completada!' : 'Analíticas Globales'}
                 </h2>
                 {practiceState.status === 'completed' && (
                    <button
                      onClick={handleReset}
                      className="text-sm px-4 py-2 bg-primary text-primary-foreground rounded-md"
                    >
                      Nueva Sesión
                    </button>
                 )}
               </div>
               <AnalyticsDashboard sessions={history?.sessions ?? []} />
             </div>
          </div>
        ) : null}

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
