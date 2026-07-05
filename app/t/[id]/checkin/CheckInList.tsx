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
  const singleGroup = groups.length === 1 ? groups[0] : null

  // Step 1 — category selection. Skipped automatically when there's only
  // one category (or the legacy "Jogadores" catch-all group) — nothing to
  // choose between in that case.
  const [selectedId, setSelectedId] = useState<string | null>(singleGroup?.id ?? null)
  const selectedGroup = groups.find(g => g.id === selectedId) ?? null

  if (!selectedGroup) {
    return <CategoryPicker tournamentName={tournamentName} groups={groups} onSelect={setSelectedId} />
  }

  return (
    <PlayerList
      tournamentName={tournamentName}
      group={selectedGroup}
      onBack={groups.length > 1 ? () => setSelectedId(null) : undefined}
    />
  )
}

// ── Step 1 — category selection ──────────────────────────────

function CategoryPicker({ tournamentName, groups, onSelect }: {
  tournamentName: string
  groups:         CheckInCategoryGroup[]
  onSelect:       (id: string) => void
}) {
  return (
    <div className="min-h-dvh bg-[#0A0A0A] text-[#F0F0F0] px-5 py-8 space-y-6">
      <div className="text-center space-y-1.5">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#888888]">{tournamentName}</p>
        <p className="font-display text-2xl font-bold uppercase text-[#C8F135]">Check-in</p>
        <p className="text-sm text-[#888888]">Qual é a sua categoria?</p>
      </div>

      <div className="max-w-md mx-auto space-y-2.5">
        {groups.map(g => {
          const done = g.players.filter(p => p.checked_in).length
          return (
            <button
              key={g.id}
              onClick={() => onSelect(g.id)}
              className="w-full flex items-center justify-between gap-3 rounded-2xl px-5 py-4 border border-[#242424] bg-[#161616] hover:border-[#C8F135]/40 text-left transition-all active:scale-[0.98]"
            >
              <span className="font-bold text-base">{g.name}</span>
              <span className="text-xs font-black text-[#6B6B6B] uppercase tracking-wide shrink-0">
                {done}/{g.players.length} confirmados →
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Step 2 — full tappable player list, optional search filter ──

function PlayerList({ tournamentName, group, onBack }: {
  tournamentName: string
  group:          CheckInCategoryGroup
  onBack?:        () => void
}) {
  const [checkedIn, setCheckedIn] = useState<Set<string>>(
    () => new Set(group.players.filter(p => p.checked_in).map(p => p.id))
  )
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError]         = useState('')
  const [query, setQuery]         = useState('')
  const [, startTransition]       = useTransition()

  // The search box is a convenience filter on top of the always-visible
  // full list — never a gate you have to type through to see anyone.
  const filteredPlayers = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return group.players
    return group.players.filter(p => p.name.toLowerCase().includes(q))
  }, [group.players, query])

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

      <div className="max-w-md mx-auto space-y-3">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-bold text-[#888888] hover:text-[#F0F0F0] transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 19l-7-7 7-7" />
            </svg>
            {group.name} — trocar categoria
          </button>
        )}

        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filtrar por nome (opcional)…"
          className="w-full rounded-xl px-4 py-3 text-sm font-semibold bg-[#161616] border border-[#242424] text-[#F0F0F0] placeholder:text-[#6B6B6B] focus:outline-none focus:border-[#C8F135]/50 transition-colors"
        />
      </div>

      {error && <p className="text-sm font-bold text-[#FF4444] text-center">{error}</p>}

      <div className="max-w-md mx-auto space-y-2">
        {filteredPlayers.map(p => {
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

        {filteredPlayers.length === 0 && (
          <p className="text-center text-sm text-[#6B6B6B] py-8">Nenhum jogador encontrado com esse filtro.</p>
        )}
      </div>
    </div>
  )
}
