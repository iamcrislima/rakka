import type { Metadata, Viewport } from 'next'
import { Inter, Barlow_Condensed } from 'next/font/google'
import AppShell from './components/AppShell'
import { TopbarProvider } from './components/TopbarContext'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
})

export const metadata: Metadata = {
  title: 'Rakka',
  description: 'Gerencie seus torneios esportivos',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${barlowCondensed.variable}`}>
      <body
        className="font-[var(--font-inter),system-ui,sans-serif] min-h-dvh"
        style={{ background: 'var(--bt-bg)' }}
      >
        <TopbarProvider>
          <AppShell>{children}</AppShell>
        </TopbarProvider>
      </body>
    </html>
  )
}
