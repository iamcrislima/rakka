'use client'

/**
 * "Jogos ao vivo" — cross-category panorama of every court that currently
 * has a match in progress, on the main tournament page. One card per busy
 * court (not per category), since the organizer walking the venue thinks in
 * terms of "what's happening at Quadra X", not "how is category A/B doing".
 *
 * Score is read-only here on purpose — this app has no partial/live score
 * persisted anywhere (ScoreDigit inputs are local state until "Confirmar
 * resultado" is pressed), so there's nothing incremental to stream. What
 * this panel really reacts to in real time is a result actually landing —
 * the moment a match is confirmed elsewhere, its card drops off this list
 * automatically via the same realtime mechanism Modo TV uses.
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export interface LiveGameCourt {
  courtId:   string
  courtName: string
  match: {
    id:           string
    categoryId:   string | null
    categoryName: string
    startedAt:    string
    team1:        string
    team2:        string
  }
  next: {
    id:           string
    categoryName: string
    team1:        string
    team2:        string
  } | null
}

function formatElapsed(totalSecs: number): string {
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function LiveGamesPanel({ tournamentId, courts }: {
  tournamentId: string
  courts:       LiveGameCourt[]
}) {
  const router = useRouter()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const refresh = useCallback(() => { router.refresh() }, [router])

  // Same mechanism as Modo TV: realtime on `matches` for this tournament,
  // plus a 60s fallback poll in case realtime drops.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`live-games-${tournamentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournamentId}` },
        refresh,
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tournamentId, refresh])

  useEffect(() => {
    const id = setInterval(refresh, 60_000)
    return () => clearInterval(id)
  }, [refresh])

  return (
    <section className="space-y-2">
      <p className="text-[11px] font-black uppercase tracking-widest text-[#888888] px-0.5">🔴 Jogos ao vivo</p>

      {courts.length === 0 ? (
        <div className="bg-[#161616] border border-[#242424] rounded-2xl px-4 py-7 text-center">
          <p className="text-sm font-bold text-[#888888]">Nenhum jogo em andamento agora</p>
        </div>
      ) : (
        <div className="stagger grid grid-cols-1 lg:grid-cols-2 gap-3">
          {courts.map(c => {
            const elapsed = Math.max(0, Math.floor((now - new Date(c.match.startedAt).getTime()) / 1000))
            const body = (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-black text-[#F0F0F0] truncate">🏟️ {c.courtName}</span>
                  <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 shrink-0 tabular-nums">
                    🔴 {formatElapsed(elapsed)}
                  </span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#C8F135] w-fit px-2 py-0.5 rounded bg-[#C8F135]/10">
                  {c.match.categoryName}
                </span>
                <p className="text-sm font-bold text-[#F0F0F0]">
                  {c.match.team1} <span className="text-[#6B6B6B] font-normal">vs</span> {c.match.team2}
                </p>
                {c.next && (
                  <div className="pt-2 border-t border-[#242424] text-xs">
                    <span className="font-bold uppercase tracking-wide text-[#6B6B6B]">Próximo confronto nesta quadra:</span>{' '}
                    <span className="text-[#888888]">
                      {c.next.team1} vs {c.next.team2}
                      {c.next.categoryName !== c.match.categoryName && ` (${c.next.categoryName})`}
                    </span>
                  </div>
                )}
              </>
            )
            const className = "flex flex-col gap-2.5 rounded-2xl px-4 py-4 border border-red-500/20 bg-[#161616] transition-colors"
            return c.match.categoryId ? (
              <Link
                key={c.courtId}
                href={`/admin/tournaments/${tournamentId}/categories/${c.match.categoryId}?focus=${c.match.id}`}
                className={`${className} hover:border-red-500/40 active:scale-[0.99]`}
              >
                {body}
              </Link>
            ) : (
              <div key={c.courtId} className={className}>{body}</div>
            )
          })}
        </div>
      )}
    </section>
  )
}
