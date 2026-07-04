'use client'

import { useMemo, useState, useTransition } from 'react'
import { checkInPlayer } from './actions'

export interface CheckInPlayerRow {
  id:         string
  name:       string
  checked_in: boolean
}

export interface CheckInCategoryGroup {
  id:      string
  name:    string
  players: CheckInPlayerRow[]
}

export default function CheckInList({ tournamentName, groups }: {
  tournamentName: string
  groups:         CheckInCategoryGroup[]
}) {
  const [checkedIn, setCheckedIn] = useState<Set<string>>(
    () => new Set(groups.flatMap(g => g.players).filter(p => p.checked_in).map(p => p.id))
  )
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError]         = useState('')
  const [query, setQuery]         = useState('')
  const [, startTransition]       = useTransition()

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groups
    return groups
      .map(g => ({ ...g, players: g.players.filter(p => p.name.toLowerCase().includes(q)) }))
      .filter(g => g.players.length > 0)
  }, [groups, query])

  function handleCheckIn(playerId: string) {
    if (checkedIn.has(playerId) || pendingId) return
    setError('')
    setPendingId(playerId)
    startTransition(async () => {
      const result = await checkInPlayer(playerId)
      setPendingId(null)
      if (!result.ok) { setError(result.error); return }
      setCheckedIn(prev => new Set(prev).add(playerId))
    })
  }

  return (
    <div className="min-h-dvh bg-[#0A0A0A] text-[#F0F0F0] px-5 py-8 space-y-6">

      <div className="text-center space-y-1.5">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#888888]">{tournamentName}</p>
        <p className="font-display text-2xl font-bold uppercase text-[#C8F135]">Check-in</p>
        <p className="text-sm text-[#888888]">Toque no seu nome para confirmar presença</p>
      </div>

      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Buscar meu nome…"
        className="w-full max-w-md mx-auto block rounded-xl px-4 py-3 text-sm font-semibold bg-[#161616] border border-[#242424] text-[#F0F0F0] placeholder:text-[#6B6B6B] focus:outline-none focus:border-[#C8F135]/50 transition-colors"
      />

      {error && <p className="text-sm font-bold text-[#FF4444] text-center">{error}</p>}

      <div className="max-w-md mx-auto space-y-5">
        {filteredGroups.map(g => (
          <section key={g.id} className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#888888] px-0.5">{g.name}</p>
            <div className="space-y-2">
              {g.players.map(p => {
                const done = checkedIn.has(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => handleCheckIn(p.id)}
                    disabled={done || pendingId === p.id}
                    className={`w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 border text-left transition-all active:scale-[0.98] ${
                      done
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-[#161616] border-[#242424] hover:border-[#C8F135]/40'
                    }`}
                  >
                    <span className="font-bold text-sm truncate">{p.name}</span>
                    <span className={`text-xs font-black uppercase tracking-wide shrink-0 ${done ? 'text-emerald-400' : 'text-[#6B6B6B]'}`}>
                      {pendingId === p.id ? '…' : done ? '✓ Confirmado' : 'Confirmar'}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}

        {filteredGroups.length === 0 && (
          <p className="text-center text-sm text-[#6B6B6B] py-8">Nenhum jogador encontrado.</p>
        )}
      </div>
    </div>
  )
}
