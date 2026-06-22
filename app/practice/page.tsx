import type { Metadata } from 'next'
import { PracticeContainer } from './_components/practice-container'

export const metadata: Metadata = {
  title: 'Práctica Activa | Violin Mentor',
  description:
    'Panel de práctica activa con partitura interactiva y retroalimentación de afinación en tiempo real.',
}

/**
 * Server Component: entry point for the active practice view.
 * Renders only the static shell and metadata; all interactive logic
 * lives in the client subtree rooted at PracticeContainer.
 */
export default function PracticePage() {
  return (
    <main className="relative flex h-dvh w-full flex-col overflow-hidden bg-background">
      <PracticeContainer />
    </main>
  )
}
