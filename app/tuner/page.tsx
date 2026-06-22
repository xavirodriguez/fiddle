import type { Metadata } from 'next'
import { TunerDial } from './_components/tuner-dial'

export const metadata: Metadata = {
  title: 'Tuner — Violin Mentor',
  description: 'Real-time chromatic tuner with cents deviation display.',
}

export default function TunerPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 px-4">
      {/* Header */}
      <header className="mb-8 text-center">
        <h1 className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-muted)]">
          Tuner
        </h1>
      </header>

      {/* Dial — client component */}
      <TunerDial />

      {/* Footer hint */}
      <p className="mt-10 font-mono text-[10px] uppercase tracking-widest text-[var(--color-dial-label)]">
        Press Start and play a note
      </p>
    </main>
  )
}
