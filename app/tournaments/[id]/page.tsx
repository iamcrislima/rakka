import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { generateGroupMatches, generateKnockoutSeeds } from '@/lib/match-generator'
import { computeRanking } from '@/lib/ranking'
import type { Tournament, Player, Match } from '@/types'
import StartGroupStageButton from './StartGroupStageButton'
import ShuffleGroupsButton from './ShuffleGroupsButton'
import GenerateFinalsButton from './GenerateFinalsButton'

const STATUS_CONFIG: Record<string, { label: string; bg: string }> = {
  draft:        { label: 'Rascunho',       bg: 'bg-slate-400' },
  group_stage:  { label: 'Fase de grupos', bg: 'bg-sky-500' },
  finals:       { label: 'Finais',         bg: 'bg-amber-500' },
  done:         { label: 'Encerrado',      bg: 'bg-emerald-500' },
}

async function getData(id: string) {
  const [{ data: t }, { data: players }, { data: matches }] = await Promise.all([
    supabase.from('tournaments').select('*').eq('id', id).single(),
    supabase.from('players').select('*').eq('tournament_id', id).order('position'),
    supabase.from('matches').select('*').eq('tournament_id', id),
  ])
  return {
    tournament: t as Tournament | null,
    players:    (players ?? []) as Player[],
    matches:    (matches ?? []) as Match[],
  }
}

function PlayerChip({ player }: { player: Player }) {
  const isGroupA = player.position <= 4
  return (
    <div className="flex items-center gap-2 bg-white/80 rounded-xl px-3 py-2">
      <div className={`w-7 h-7 rounded-full text-white text-xs font-black flex items-center justify-center shrink-0 ${isGroupA ? 'bg-sky-500' : 'bg-violet-500'}`}>
        {player.name[0]?.toUpperCase() ?? '?'}
      </div>
      <span className="text-sm font-semibold text-slate-700 truncate">{player.name}</span>
    </div>
  )
}

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }    = await params
  const { tournament, players, matches } = await getData(id)
  if (!tournament) notFound()

  const cfg        = STATUS_CONFIG[tournament.status] ?? STATUS_CONFIG.draft
  const groupA     = players.filter(p => p.position <= 4)
  const groupB     = players.filter(p => p.position >= 5)
  const matchCount = matches.length

  // Group stage state
  const groupMatches = matches.filter(m => m.stage === 'group_a' || m.stage === 'group_b')
  const allGroupDone = groupMatches.length === 6 && groupMatches.every(m => m.status === 'done')
  const hasFinalsMatches = matches.some(m => m.stage === 'final' || m.stage === 'consolation_final')

  // Finals seeds (computed server-side from rankings)
  const finalsSeeds = (() => {
    if (!allGroupDone || hasFinalsMatches) return null
    const rankA = computeRanking(groupA, matches.filter(m => m.stage === 'group_a'))
    const rankB = computeRanking(groupB, matches.filter(m => m.stage === 'group_b'))
    if (rankA.length < 4 || rankB.length < 4) return null
    return generateKnockoutSeeds(
      rankA.map(s => s.player),
      rankB.map(s => s.player),
    )
  })()

  const canStart = tournament.status === 'draft' && players.length === 8

  return (
    <div className="space-y-5">

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
          { label: 'Grupo A', list: groupA, badge: 'bg-sky-500' },
          { label: 'Grupo B', list: groupB, badge: 'bg-violet-500' },
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
              {g.list.length === 0 && <p className="text-xs text-slate-300 px-1">Sem jogadores</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Finals composition preview */}
      {finalsSeeds && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-black text-amber-700 uppercase tracking-wide">⚡ Composição das finais</p>
          {finalsSeeds.map(s => {
            const playerMap = Object.fromEntries(players.map(p => [p.id, p]))
            const t1p1 = playerMap[s.team1_p1]?.name ?? '?'
            const t1p2 = playerMap[s.team1_p2]?.name ?? '?'
            const t2p1 = playerMap[s.team2_p1]?.name ?? '?'
            const t2p2 = playerMap[s.team2_p2]?.name ?? '?'
            const label = s.stage === 'final' ? '🏆 Final' : '🥉 Consolação'
            return (
              <div key={s.stage} className="space-y-1">
                <p className="text-[11px] font-bold text-amber-600">{label}</p>
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex-1">
                    <p className="font-bold text-slate-800">{t1p1}</p>
                    <p className="font-bold text-slate-800">{t1p2}</p>
                  </div>
                  <span className="text-xs font-black text-slate-300">VS</span>
                  <div className="flex-1 text-right">
                    <p className="font-bold text-slate-800">{t2p1}</p>
                    <p className="font-bold text-slate-800">{t2p2}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        {canStart && (
          <>
            <ShuffleGroupsButton tournamentId={tournament.id} players={players} />
            <StartGroupStageButton
              tournamentId={tournament.id}
              players={players}
              matchSeeds={generateGroupMatches(players)}
            />
          </>
        )}

        {finalsSeeds && (
          <GenerateFinalsButton tournamentId={tournament.id} seeds={finalsSeeds} />
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
                <p className="text-xs text-slate-400">{matchCount} jogos</p>
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
