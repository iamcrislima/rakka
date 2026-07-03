'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTopbar } from './TopbarContext'

/** Map pathname → static fallback title when no page calls useSetTopbar */
const STATIC_TITLES: Record<string, string> = {
  '/':                  'Torneios',
  '/leagues':           'Ligas',
  '/leagues/new':       'Nova Liga',
  '/registrations/new': 'Nova Inscrição',
  '/tournaments/new':   'Novo Torneio',
}

function deriveFallback(pathname: string): string {
  if (STATIC_TITLES[pathname]) return STATIC_TITLES[pathname]
  if (pathname.startsWith('/tournaments/') && pathname.endsWith('/matches'))  return 'Partidas'
  if (pathname.startsWith('/tournaments/') && pathname.endsWith('/ranking'))  return 'Ranking'
  if (pathname.startsWith('/tournaments/') && pathname.endsWith('/tv'))       return 'Modo TV'
  if (pathname.startsWith('/tournaments/') && pathname.endsWith('/tv-admin')) return 'TV Admin'
  if (pathname.startsWith('/tournaments/'))  return 'Torneio'
  if (pathname.startsWith('/leagues/'))      return 'Liga'
  if (pathname.startsWith('/registrations/')) return 'Inscrições'
  return 'Rakka'
}

export default function Topbar() {
  const { meta } = useTopbar()
  const pathname  = usePathname()

  const title    = meta.title    || deriveFallback(pathname)
  const subtitle = meta.subtitle
  const eyebrow  = meta.eyebrow

  return (
    <header
      className="hidden lg:flex items-center justify-between sticky top-0 z-20 h-[60px] px-6 shrink-0 border-b"
      style={{
        background:   'rgba(10,10,10,0.92)',
        backdropFilter: 'blur(16px)',
        borderColor:  'var(--bt-border)',
      }}
    >
      {/* Left: breadcrumb + page title */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Back crumb — show only inside sub-pages */}
        {pathname !== '/' && !pathname.startsWith('/leagues/new') && !pathname.startsWith('/tournaments/new') && (
          <Link
            href={getParentHref(pathname)}
            className="text-xs font-bold transition-colors shrink-0 hidden xl:block"
            style={{ color: 'var(--bt-subtle)' }}
          >
            ←
          </Link>
        )}

        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[9px] font-black uppercase tracking-widest mb-0.5"
               style={{ color: 'var(--bt-neon)' }}>
              {eyebrow}
            </p>
          )}
          <h1
            className="text-sm font-black leading-none truncate"
            style={{ color: 'var(--bt-text)' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-[10px] font-semibold mt-0.5 truncate"
               style={{ color: 'var(--bt-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right: actions slot (extensible in the future) */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="flex items-center px-2.5 py-1.5 rounded-full"
              style={{ background: 'var(--bt-elevated)' }}>
          <img src="/rakka-logo-mark.svg" alt="Rakka" className="h-3 w-auto" />
        </span>
      </div>
    </header>
  )
}

function getParentHref(pathname: string): string {
  if (pathname.startsWith('/tournaments/') && pathname !== '/tournaments/new') return '/'
  if (pathname.startsWith('/leagues/')     && pathname !== '/leagues/new')     return '/leagues'
  if (pathname.startsWith('/registrations/'))                                   return '/'
  return '/'
}
