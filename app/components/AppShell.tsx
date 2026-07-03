'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

/** Routes that bypass the admin shell and render full-page */
function isPublicRoute(pathname: string) {
  return pathname.startsWith('/t/')
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (isPublicRoute(pathname)) {
    return <>{children}</>
  }

  return (
    <div className="lg:grid lg:grid-cols-[240px_1fr] min-h-dvh">

      {/* Sidebar (desktop only) */}
      <Sidebar />

      {/* Main column */}
      <div className="flex flex-col min-h-dvh min-w-0">

        {/* Topbar (desktop only, 60px) */}
        <Topbar />

        {/* Mobile header */}
        <header
          className="lg:hidden sticky top-0 z-30 backdrop-blur-md border-b border-white/5"
          style={{ background: 'rgba(10,10,10,0.95)' }}
        >
          <div className="px-4 py-3 flex items-center gap-2.5">
            <div className="flex-1 min-w-0">
              <img src="/rakka-logo-mark.svg" alt="Rakka" className="h-6 w-auto" />
            </div>
            <nav className="flex items-center gap-1 ml-auto">
              <Link
                href="/admin"
                className="text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--bt-muted)' }}
              >
                Torneios
              </Link>
              <Link
                href="/admin/leagues"
                className="text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--bt-muted)' }}
              >
                Ligas
              </Link>
            </nav>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 lg:px-8 py-5 lg:py-6 pb-12">
          {children}
        </main>

      </div>
    </div>
  )
}
