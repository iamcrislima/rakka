import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { computeRanking } from '@/lib/ranking'
import type { Match, Player } from '@/types'

async function getData(id: string) {
  const [{ data: players }, { data: matches }] = await Promise.all([
    supabase.from('players').select('*').eq('tournament_id', id).order('position'),
    supabase.from('matches').select('*').eq('tournament_id', id),
  ])
  return {
    players: (players ?? []) as Player[],
    matches: (matches ?? []) as Match[],
  }
}

export default async function RankingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { players, matches } = await getData(id)

  if (!players.length) notFound()

  const groupA = players.filter(p => p.position <= 4)
  const groupB = players.filter(p => p.position >= 5)

  const matchesA = matches.filter(m => m.stage === 'group_a')
  const matchesB = matches.filter(m => m.stage === 'group_b')

  const rankA = computeRanking(groupA, matchesA)
  const rankB = computeRanking(groupB, matchesB)

  const medal = ['🥇', '🥈', '🥉', '4️⃣']

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/tournaments/${id}`} className="text-sm text-sky-600 font-medium">← Torneio</Link>
        <h1 className="text-xl font-bold text-gray-800 mt-1">Ranking</h1>
      </div>

      {[{ label: 'Grupo A', stats: rankA }, { label: 'Grupo B', stats: rankB }].map(g => (
        <section key={g.label} className="space-y-2">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide">{g.label}</h2>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1.5rem_1fr_2.5rem_2.5rem_2.5rem] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase">
              <span>#</span>
              <span>Jogador</span>
              <span className="text-center">V</span>
              <span className="text-center">Saldo</span>
              <span className="text-center">PG</span>
            </div>

            {g.stats.map((s, i) => (
              <div
                key={s.player.id}
                className={`grid grid-cols-[1.5rem_1fr_2.5rem_2.5rem_2.5rem] gap-2 px-4 py-3 items-center
                  ${i < g.stats.length - 1 ? 'border-b border-gray-50' : ''}
                  ${i < 2 ? 'bg-sky-50/40' : ''}`}
              >
                <span className="text-sm">{medal[i] ?? i + 1}</span>
                <span className="text-sm font-semibold text-gray-800 truncate">{s.player.name}</span>
                <span className="text-sm text-center font-bold text-gray-700">{s.wins}</span>
                <span className={`text-sm text-center font-bold ${s.gameDiff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {s.gameDiff > 0 ? '+' : ''}{s.gameDiff}
                </span>
                <span className="text-sm text-center text-gray-500">{s.gamesWon}</span>
              </div>
            ))}
          </div>
          {rankA.length > 0 && g.label === 'Grupo A' && (
            <p className="text-[11px] text-gray-400 px-1">
              V = vitórias · Saldo = diferença de games · PG = games ganhos
            </p>
          )}
        </section>
      ))}

      {/* Qualification preview */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Classificação projetada</h2>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {[
            { label: '🏆 Final', t1: rankA[0]?.player.name, t2: rankB[0]?.player.name },
            { label: '🥈 Semifinal A', t1: rankA[0]?.player.name, t2: rankB[1]?.player.name },
            { label: '🥈 Semifinal B', t1: rankB[0]?.player.name, t2: rankA[1]?.player.name },
            { label: '🏅 Consolação A', t1: rankA[2]?.player.name, t2: rankB[3]?.player.name },
            { label: '🏅 Consolação B', t1: rankB[2]?.player.name, t2: rankA[3]?.player.name },
          ].map(row => (
            <div key={row.label} className="flex items-center px-4 py-2.5 gap-2 text-sm">
              <span className="text-gray-400 w-36 shrink-0 text-xs">{row.label}</span>
              <span className="font-medium text-gray-700 truncate">{row.t1 ?? '?'}</span>
              <span className="text-gray-300 text-xs">vs</span>
              <span className="font-medium text-gray-700 truncate">{row.t2 ?? '?'}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
