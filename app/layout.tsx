import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Beach Tennis Manager',
  description: 'Manage amateur beach tennis tournaments',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <header className="bg-sky-600 text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow">
          <span className="text-xl">🎾</span>
          <span className="font-bold text-lg tracking-tight">Beach Tennis Manager</span>
        </header>
        <main className="max-w-lg mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  )
}
