import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { computeRanking } from '@/lib/ranking'
import type { Match, Player, PlayerStats } from '@/types'

async function getData(id: string) {
  const [{ data: players }, { data: matches }] = await Promise.all([
    supabase.from('players').select('*').eq('tournament_id', id).order('position'),
    supabase.from('matches').select('*').eq('tournament_id', id),
  ])
  return { players: (players ?? []) as Player[], matches: (matches ?? []) as Match[] }
}

function Podium({ stats }: { stats: PlayerStats[] }) {
  const [first, second, third] = stats
  const heights = ['h-28', 'h-20', 'h-16']
  const medals  = ['🥇', '🥈', '🥉']
  const colors  = ['bg-amber-400', 'bg-slate-300', 'bg-amber-700/60']
  const order   = [second, first, third]  // podium visual order: 2nd, 1st, 3rd
  const orderIdx = [1, 0, 2]

  return (
    <div className="flex items-end justify-center gap-2 pt-4 pb-2">
      {order.map((s, col) => {
        if (!s) return <div key={col} className="w-24" />
        const rank = orderIdx[col]
        return (
          <div key={s.player.id} className="flex flex-col items-center gap-1.5 w-24">
            <span className="text-2xl">{medals[rank]}</span>
            <div className={`w-10 h-10 rounded-full text-white font-black text-sm flex items-center justify-center ${colors[rank]}`}>
              {s.player.name[0]?.toUpperCase()}
            </div>
            <p className="text-xs font-bold text-slate-700 text-center truncate w-full px-1">{s.player.name}</p>
            <p className="text-xs font-bold text-slate-400">{s.wins}V · {s.gameDiff > 0 ? '+' : ''}{s.gameDiff}</p>
            <div className={`w-full rounded-t-lg ${heights[rank]} ${colors[rank]} flex items-center justify-center`}>
              <span className="text-white font-black text-lg">{rank + 1}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RankRow({ stats, index }: { stats: PlayerStats; index: number }) {
  const isQualified = index < 2
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${index < stats.rank - 1 ? 'border-b border-slate-50' : ''} ${isQualified ? 'bg-sky-50/50' : ''}`}>
      <span className="w-6 text-center text-sm font-black text-slate-400">{index + 1}</span>
      <div className={`w-9 h-9 rounded-full text-white text-sm font-black flex items-center justify-center shrink-0 ${isQualified ? 'bg-sky-500' : 'bg-slate-300'}`}>
        {stats.player.name[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800 truncate">{stats.player.name}</p>
        {isQualified && (
          <p className="text-[11px] font-bold text-sky-500">✓ Classificado para finais</p>
        )}
      </div>
      <div className="text-right space-y-0.5 shrink-0">
        <p className="text-sm font-black text-slate-700">{stats.wins}V <span className="font-normal text-slate-300">|</span> {stats.losses}D</p>
        <p className={`text-xs font-bold ${stats.gameDiff >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
          {stats.gameDiff > 0 ? '+' : ''}{stats.gameDiff} saldo
        </p>
      </div>
    </div>
  )
}

function GroupRanking({ label, color, stats }: { label: string; color: string; stats: PlayerStats[] }) {
  const completed = stats.some(s => s.wins + s.losses > 0)
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={`w-6 h-6 rounded text-white text-xs font-black flex items-center justify-center ${color}`}>
          {label.slice(-1)}
        </span>
        <span className="text-sm font-black text-slate-600 uppercase tracking-wide">{label}</span>
        {!completed && <span className="text-xs text-slate-300 font-medium">Sem resultados ainda</span>}
      </div>

      {completed && stats.length >= 3 && <Podium stats={stats} />}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1.5rem_2.25rem_1fr_auto] gap-3 px-4 py-2 bg-slate-50 border-b border-slate-100">
          <span className="text-[11px] font-bold text-slate-400">#</span>
          <span />
          <span className="text-[11px] font-bold text-slate-400">Jogador</span>
          <span className="text-[11px] font-bold text-slate-400 text-right">V / D · Saldo</span>
        </div>
        {stats.map((s, i) => <RankRow key={s.player.id} stats={s} index={i} />)}
      </div>
    </section>
  )
}

export default async function RankingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { players, matches } = await getData(id)
  if (!players.length) notFound()

  const groupA   = players.filter(p => p.position <= 4)
  const groupB   = players.filter(p => p.position >= 5)
  const matchesA = matches.filter(m => m.stage === 'group_a')
  const matchesB = matches.filter(m => m.stage === 'group_b')
  const rankA    = computeRanking(groupA, matchesA)
  const rankB    = computeRanking(groupB, matchesB)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="space-y-1">
        <Link href={`/tournaments/${id}`} className="text-sm font-bold text-sky-600">← Torneio</Link>
        <h1 className="text-2xl font-black text-slate-800">Ranking</h1>
        <p className="text-xs text-slate-400">Top 2 de cada grupo avançam para as finais</p>
      </div>

      <GroupRanking label="Grupo A" color="bg-sky-500"    stats={rankA} />
      <GroupRanking label="Grupo B" color="bg-violet-500" stats={rankB} />

      {/* Finals preview */}
      {rankA.length > 0 && rankB.length > 0 && (
        <section className="space-y-2">
          <span className="text-sm font-black text-slate-600 uppercase tracking-wide">⚡ Projeção das finais</span>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
            {[
              {
                emoji: '🏆', label: 'Grande Final',
                team1: [rankA[0], rankB[0]], team2: [rankA[1], rankB[1]],
              },
              {
                emoji: '🥉', label: 'Final Consolação',
                team1: [rankA[2], rankB[2]], team2: [rankA[3], rankB[3]],
              },
            ].map(row => (
              <div key={row.label} className="px-4 py-3 space-y-2">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-wide">
                  {row.emoji} {row.label}
                </p>
                <div className="flex items-stretch gap-3">
                  {/* Team 1 */}
                  <div className="flex-1 space-y-0.5">
                    {row.team1.map((s, i) => (
                      <p key={i} className="text-sm font-bold text-slate-800 truncate">
                        {s?.player.name ?? '?'}
                      </p>
                    ))}
                  </div>
                  <div className="flex items-center">
                    <span className="text-xs font-black text-slate-300 px-1">VS</span>
                  </div>
                  {/* Team 2 */}
                  <div className="flex-1 text-right space-y-0.5">
                    {row.team2.map((s, i) => (
                      <p key={i} className="text-sm font-bold text-slate-800 truncate">
                        {s?.player.name ?? '?'}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
