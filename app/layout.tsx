import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Beach Tennis Manager',
  description: 'Gerencie torneios de beach tennis',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="font-[var(--font-inter),system-ui,sans-serif] bg-[#EFF6FF] min-h-dvh">

        {/* Gradient header */}
        <header className="sticky top-0 z-20 bg-gradient-to-r from-[#0F2044] to-[#1E40AF] px-4 py-3.5 flex items-center gap-2.5 shadow-lg">
          <span className="text-2xl leading-none">🎾</span>
          <span className="font-black text-white text-lg tracking-tight">Beach Tennis</span>
          <span className="ml-auto text-xs text-white/50 font-medium">Manager</span>
        </header>

        <main className="max-w-md mx-auto px-4 py-5 pb-10">
          {children}
        </main>

      </body>
    </html>
  )
}
