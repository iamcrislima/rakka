'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/',                  label: 'Torneios',   icon: '🏆', exact: true  },
  { href: '/leagues',           label: 'Ligas',      icon: '📊', exact: false },
  { href: '/registrations/new', label: 'Inscrições', icon: '📋', exact: false },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="hidden lg:flex flex-col sticky top-0 h-dvh border-r"
      style={{ background: '#0D0D0D', borderColor: 'var(--bt-border)' }}
    >
      {/* Logo */}
      <div
        className="flex items-center px-5 py-[18px] border-b shrink-0"
        style={{ borderColor: 'var(--bt-border)' }}
      >
        <img src="/rakka-logo-full.svg" alt="Rakka" className="h-6 w-auto" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 pl-3 pr-3 py-2.5 text-sm font-bold transition-all"
              style={isActive ? {
                borderLeft: '2px solid var(--bt-neon)',
                marginLeft: '-2px',
                paddingLeft: '13px',
                color: 'var(--bt-neon)',
              } : {
                borderLeft: '2px solid transparent',
                marginLeft: '-2px',
                paddingLeft: '13px',
                color: 'var(--bt-muted)',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.color = 'var(--bt-text)'
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.color = 'var(--bt-muted)'
                }
              }}
            >
              <span className="text-base leading-none w-5 text-center shrink-0">{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t shrink-0" style={{ borderColor: 'var(--bt-border)' }}>
        <p className="text-[10px] font-bold text-center" style={{ color: 'var(--bt-subtle)' }}>
          Rakka
        </p>
      </div>
    </aside>
  )
}
