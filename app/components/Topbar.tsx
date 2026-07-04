'use client'

import { usePathname } from 'next/navigation'
import { useTopbar } from './TopbarContext'
import BackLink from './BackLink'

/** Map pathname → static fallback title when no page calls useSetTopbar */
const STATIC_TITLES: Record<string, string> = {
  '/admin':                   'Torneios',
  '/admin/leagues':           'Ligas',
  '/admin/leagues/new':       'Nova Liga',
  '/admin/registrations/new': 'Nova Inscrição',
  '/admin/tournaments/new':   'Novo Torneio',
}

function deriveFallback(pathname: string): string {
  if (STATIC_TITLES[pathname]) return STATIC_TITLES[pathname]
  if (pathname.startsWith('/admin/tournaments/') && pathname.endsWith('/matches'))  return 'Partidas'
  if (pathname.startsWith('/admin/tournaments/') && pathname.endsWith('/ranking'))  return 'Ranking'
  if (pathname.startsWith('/admin/tournaments/') && pathname.endsWith('/tv-admin')) return 'TV Admin'
  if (pathname.startsWith('/admin/tournaments/'))   return 'Torneio'
  if (pathname.startsWith('/admin/leagues/'))       return 'Liga'
  if (pathname.startsWith('/admin/registrations/')) return 'Inscrições'
  if (pathname.startsWith('/registrations/'))       return 'Inscrições'
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
        {pathname !== '/admin' && !pathname.startsWith('/admin/leagues/new') && !pathname.startsWith('/admin/tournaments/new') && (
          <BackLink
            href={getParentHref(pathname)}
            label={getParentLabel(pathname)}
            className="text-xs font-bold shrink-0 hidden xl:flex hover:opacity-80 text-[color:var(--bt-subtle)]"
          />
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
  if (pathname.startsWith('/admin/tournaments/') && pathname !== '/admin/tournaments/new') return '/admin'
  if (pathname.startsWith('/admin/leagues/')     && pathname !== '/admin/leagues/new')     return '/admin/leagues'
  if (pathname.startsWith('/admin/registrations/'))                                          return '/admin'
  return '/admin'
}

function getParentLabel(pathname: string): string {
  if (pathname.startsWith('/admin/tournaments/') && pathname !== '/admin/tournaments/new') return 'Torneios'
  if (pathname.startsWith('/admin/leagues/')     && pathname !== '/admin/leagues/new')     return 'Ligas'
  if (pathname.startsWith('/admin/registrations/'))                                          return 'Torneios'
  return 'Torneios'
}
