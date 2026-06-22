"use client"

/**
 * PracticeContainer — "Smart" orchestrator component (stub for Paso 1).
 *
 * This shell wires the toolbar to placeholder handlers so the route renders
 * without errors. Dynamic OSMD import and FeedbackOverlay will be connected
 * in subsequent steps.
 */

import { useState } from 'react'
import { PracticeToolbar } from './practice-toolbar'

export function PracticeContainer() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoopEnabled, setIsLoopEnabled] = useState(false)

  return (
    <div className="flex h-full w-full flex-col">
      <PracticeToolbar
        isPlaying={isPlaying}
        isLoopEnabled={isLoopEnabled}
        onTogglePlay={() => setIsPlaying((v) => !v)}
        onReset={() => setIsPlaying(false)}
        onPrevNote={() => {}}
        onNextNote={() => {}}
        onToggleLoop={() => setIsLoopEnabled((v) => !v)}
      />

      {/* Sheet music area — SheetMusicWrapper will mount here in Paso 2 */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-background">
        <p className="text-sm text-muted-foreground">Cargando partitura…</p>
      </div>
    </div>
  )
}
