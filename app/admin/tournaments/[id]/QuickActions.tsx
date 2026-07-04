'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export interface QuickActionSpec {
  key:      string
  icon:     string
  label:    string
  primary?: boolean
  /** Direct link — used when there's no ambiguity about where to go. */
  href?:    string
  /** Opens in a new tab — for destinations (Modo TV, Cerimônia) meant to run
   *  on a separate physical screen while the organizer keeps working here. */
  newTab?:  boolean
  /** Category picker — used when more than one category could be the target. */
  options?: { id: string; name: string; href: string }[]
}

export default function QuickActions({ actions }: { actions: QuickActionSpec[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(a => <QuickAction key={a.key} action={a} />)}
    </div>
  )
}

function QuickAction({ action }: { action: QuickActionSpec }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const baseClasses = `inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors active:scale-[0.97] ${
    action.primary
      ? 'bg-[#C8F135] text-[#0A0A0A] hover:bg-[#D4F54A]'
      : 'bg-[#161616] border border-[#242424] text-[#F0F0F0] hover:border-[#3a3a3a]'
  }`

  if (action.href) {
    return (
      <Link
        href={action.href}
        className={baseClasses}
        target={action.newTab ? '_blank' : undefined}
        rel={action.newTab ? 'noopener noreferrer' : undefined}
      >
        <span className="leading-none">{action.icon}</span>{action.label}
      </Link>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)} className={baseClasses}>
        <span className="leading-none">{action.icon}</span>{action.label}
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-2 w-56 bg-[#161616] border border-[#242424] rounded-2xl overflow-hidden shadow-xl shadow-black/40">
          <p className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[#888888] border-b border-[#242424]">
            Qual categoria?
          </p>
          {action.options?.map(o => (
            <Link
              key={o.id}
              href={o.href}
              className="flex items-center px-4 py-3 text-sm font-bold text-[#F0F0F0] hover:bg-[#1C1C1C] transition-colors"
              onClick={() => setOpen(false)}
            >
              {o.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
