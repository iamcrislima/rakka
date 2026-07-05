'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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

export default function CheckInList({ tournamentId, tournamentName, groups }: {
  tournamentId:   string
  tournamentName: string
  groups:         CheckInCategoryGroup[]
}) {
  const router = useRouter()
  const singleGroup = groups.length === 1 ? groups[0] : null

  // Step 1 — category selection. Skipped automatically when there's only
  // one category (or the legacy "Jogadores" catch-all group) — nothing to
  // choose between in that case.
  const [selectedId, setSelectedId] = useState<string | null>(singleGroup?.id ?? null)
  const selectedGroup = groups.find(g => g.id === selectedId) ?? null

  // Same mechanism as Modo TV: a realtime subscription on `players` for this
  // tournament, refreshing the server-fetched `groups` prop on any change —
  // plus a 60s fallback poll in case realtime drops. This is what makes a
  // check-in confirmed on one phone disappear from every other open screen
  // (and this same screen, if the tap happened elsewhere) without a manual
  // reload.
  const refresh = useCallback(() => { router.refresh() }, [router])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`checkin-${tournamentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `tournament_id=eq.${tournamentId}` },
        refresh,
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tournamentId, refresh])

  useEffect(() => {
    const id = setInterval(refresh, 60_000)
    return () => clearInterval(id)
  }, [refresh])

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
//
// Checked-in players are never rendered here at all (not just marked ✓) —
// once confirmed, a name has nothing left to do in this list, and leaving it
// visible only invites someone tapping it again or a friend hunting for a
// name that's already gone. The list is derived straight from `group.players`
// on every render (refreshed via realtime/poll above), plus a short-lived
// local set for the tap that's still in flight on THIS device.

const CONFIRMATION_DISMISS_MS = 2200

function PlayerList({ tournamentName, group, onBack }: {
  tournamentName: string
  group:          CheckInCategoryGroup
  onBack?:        () => void
}) {
  const [pendingId, setPendingId]   = useState<string | null>(null)
  const [error, setError]           = useState('')
  const [query, setQuery]           = useState('')
  const [optimistic, setOptimistic] = useState<Set<string>>(new Set())
  const [confirmedName, setConfirmedName] = useState<string | null>(null)
  const [, startTransition]         = useTransition()

  // Drop stale optimistic entries once the real data catches up (avoids the
  // set growing forever across re-renders from other players checking in).
  useEffect(() => {
    setOptimistic(prev => {
      const stillNeeded = [...prev].filter(id => !group.players.find(p => p.id === id)?.checked_in)
      return stillNeeded.length === prev.size ? prev : new Set(stillNeeded)
    })
  }, [group.players])

  const remaining = useMemo(
    () => group.players.filter(p => !p.checked_in && !optimistic.has(p.id)),
    [group.players, optimistic],
  )

  const doneCount = group.players.length - remaining.length

  const filteredPlayers = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return remaining
    return remaining.filter(p => p.name.toLowerCase().includes(q))
  }, [remaining, query])

  function handleCheckIn(player: CheckInPlayerRow) {
    if (pendingId) return
    setError('')
    setPendingId(player.id)
    startTransition(async () => {
      const result = await checkInPlayer(player.id)
      setPendingId(null)
      if (!result.ok) { setError(result.error); return }
      setOptimistic(prev => new Set(prev).add(player.id))
      setConfirmedName(player.name)
      setTimeout(() => setConfirmedName(null), CONFIRMATION_DISMISS_MS)
    })
  }

  if (confirmedName) {
    return (
      <div className="min-h-dvh bg-[#0A0A0A] text-[#F0F0F0] px-5 py-8 flex flex-col items-center justify-center text-center gap-3 animate-fade-in">
        <span className="text-5xl leading-none">✓</span>
        <p className="font-display text-2xl font-bold uppercase text-[#C8F135]">Check-in confirmado!</p>
        <p className="text-lg font-bold">{confirmedName}</p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-[#0A0A0A] text-[#F0F0F0] px-5 py-8 space-y-6">

      <div className="text-center space-y-1.5">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#888888]">{tournamentName}</p>
        <p className="font-display text-2xl font-bold uppercase text-[#C8F135]">Check-in</p>
        <p className="text-sm text-[#888888]">Toque no seu nome para confirmar presença</p>
      </div>

      <div className="max-w-md mx-auto space-y-3">
        <div className="flex items-center justify-between gap-2">
          {onBack ? (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-xs font-bold text-[#888888] hover:text-[#F0F0F0] transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 19l-7-7 7-7" />
              </svg>
              {group.name} — trocar categoria
            </button>
          ) : <span />}
          <span className="text-xs font-black text-[#6B6B6B] uppercase tracking-wide tabular-nums shrink-0">
            {doneCount}/{group.players.length} confirmados
          </span>
        </div>

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
        {filteredPlayers.map(p => (
          <button
            key={p.id}
            onClick={() => handleCheckIn(p)}
            disabled={pendingId === p.id}
            className="w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 border text-left transition-all active:scale-[0.98] bg-[#161616] border-[#242424] hover:border-[#C8F135]/40 disabled:opacity-50"
          >
            <span className="font-bold text-sm truncate">{p.name}</span>
            <span className="text-xs font-black uppercase tracking-wide shrink-0 text-[#6B6B6B]">
              {pendingId === p.id ? '…' : 'Confirmar'}
            </span>
          </button>
        ))}

        {filteredPlayers.length === 0 && remaining.length === 0 && (
          <p className="text-center text-sm text-[#6B6B6B] py-8">🎉 Todo mundo já confirmou presença!</p>
        )}
        {filteredPlayers.length === 0 && remaining.length > 0 && (
          <p className="text-center text-sm text-[#6B6B6B] py-8">Nenhum jogador encontrado com esse filtro.</p>
        )}
      </div>
    </div>
  )
}
