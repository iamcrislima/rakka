import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { generateGroupMatches } from '@/lib/match-generator'
import type { Tournament, Player } from '@/types'
import StartGroupStageButton from './StartGroupStageButton'

const STATUS_CONFIG: Record<string, { label: string; bg: string }> = {
  draft:        { label: 'Rascunho',     bg: 'bg-slate-400' },
  group_stage:  { label: 'Fase de grupos', bg: 'bg-sky-500' },
  finals:       { label: 'Finais',       bg: 'bg-amber-500' },
  done:         { label: 'Encerrado',    bg: 'bg-emerald-500' },
}

async function getData(id: string) {
  const [{ data: t }, { data: players }, { data: matches }] = await Promise.all([
    supabase.from('tournaments').select('*').eq('id', id).single(),
    supabase.from('players').select('*').eq('tournament_id', id).order('position'),
    supabase.from('matches').select('id').eq('tournament_id', id),
  ])
  return {
    tournament: t as Tournament | null,
    players: (players ?? []) as Player[],
    matchCount: (matches ?? []).length,
  }
}

function PlayerChip({ player }: { player: Player }) {
  const initial = player.name[0]?.toUpperCase() ?? '?'
  const isGroupA = player.position <= 4
  return (
    <div className="flex items-center gap-2 bg-white/80 rounded-xl px-3 py-2">
      <div className={`w-7 h-7 rounded-full text-white text-xs font-black flex items-center justify-center shrink-0 ${isGroupA ? 'bg-sky-500' : 'bg-violet-500'}`}>
        {initial}
      </div>
      <span className="text-sm font-semibold text-slate-700 truncate">{player.name}</span>
    </div>
  )
}

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tournament, players, matchCount } = await getData(id)
  if (!tournament) notFound()

  const cfg     = STATUS_CONFIG[tournament.status] ?? STATUS_CONFIG.draft
  const groupA  = players.filter(p => p.position <= 4)
  const groupB  = players.filter(p => p.position >= 5)
  const canStart = tournament.status === 'draft' && players.length === 8

  return (
    <div className="space-y-5">

      {/* Back */}
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-sky-600">
        ← Torneios
      </Link>

      {/* Banner */}
      <div className="bg-gradient-to-br from-[#0F2044] to-[#1D4ED8] rounded-2xl p-5 text-white space-y-3">
        <div className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${cfg.bg} text-white`}>
          {cfg.label}
        </div>
        <h1 className="text-2xl font-black leading-tight">{tournament.name}</h1>
        <p className="text-xs text-white/50">
          {players.length}/8 jogadores · {matchCount} partida{matchCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Groups */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Grupo A', color: 'sky', list: groupA, badge: 'bg-sky-500' },
          { label: 'Grupo B', color: 'violet', list: groupB, badge: 'bg-violet-500' },
        ].map(g => (
          <div key={g.label} className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 space-y-2">
            <div className="flex items-center gap-1.5">
              <span className={`w-5 h-5 rounded text-white text-[10px] font-black flex items-center justify-center ${g.badge}`}>
                {g.label.slice(-1)}
              </span>
              <span className="text-xs font-bold text-slate-500">{g.label}</span>
            </div>
            <div className="space-y-1.5">
              {g.list.map(p => <PlayerChip key={p.id} player={p} />)}
              {g.list.length === 0 && (
                <p className="text-xs text-slate-300 px-1">Sem jogadores</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {canStart && (
          <StartGroupStageButton
            tournamentId={tournament.id}
            players={players}
            matchSeeds={generateGroupMatches(players)}
          />
        )}

        {matchCount > 0 && (
          <>
            <Link
              href={`/tournaments/${id}/matches`}
              className="flex items-center gap-4 bg-white rounded-2xl px-4 py-4 shadow-sm border border-slate-100 active:bg-slate-50 active:scale-[0.99] transition-transform"
            >
              <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-2xl shrink-0">🏸</div>
              <div>
                <p className="font-bold text-slate-800">Partidas</p>
                <p className="text-xs text-slate-400">{matchCount} jogos gerados</p>
              </div>
              <span className="ml-auto text-slate-300 text-lg">›</span>
            </Link>

            <Link
              href={`/tournaments/${id}/ranking`}
              className="flex items-center gap-4 bg-white rounded-2xl px-4 py-4 shadow-sm border border-slate-100 active:bg-slate-50 active:scale-[0.99] transition-transform"
            >
              <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-2xl shrink-0">🏆</div>
              <div>
                <p className="font-bold text-slate-800">Ranking</p>
                <p className="text-xs text-slate-400">Ver classificação ao vivo</p>
              </div>
              <span className="ml-auto text-slate-300 text-lg">›</span>
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
