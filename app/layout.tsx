import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const _inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Violin Mentor',
  description: 'Real-time pitch feedback and practice sessions for violin.',
}

export const viewport: Viewport = {
  themeColor: '#0e0e0f',
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="bg-[var(--color-background)]">
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
