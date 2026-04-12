import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { generateGroupMatches } from '@/lib/match-generator'
import type { Tournament, Player } from '@/types'
import StartGroupStageButton from './StartGroupStageButton'

async function getData(id: string) {
  const [{ data: t }, { data: players }, { data: matches }] = await Promise.all([
    supabase.from('tournaments').select('*').eq('id', id).single(),
    supabase.from('players').select('*').eq('tournament_id', id).order('position'),
    supabase.from('matches').select('*').eq('tournament_id', id),
  ])
  return { tournament: t as Tournament | null, players: (players ?? []) as Player[], matchCount: (matches ?? []).length }
}

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tournament, players, matchCount } = await getData(id)

  if (!tournament) notFound()

  const groupA = players.filter(p => p.position <= 4)
  const groupB = players.filter(p => p.position >= 5)

  const canStart = tournament.status === 'draft' && players.length === 8

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/" className="text-sm text-sky-600 font-medium">← Torneios</Link>
        <h1 className="text-xl font-bold text-gray-800 mt-1">{tournament.name}</h1>
      </div>

      {/* Groups */}
      <div className="grid grid-cols-2 gap-3">
        {[{ label: 'Grupo A', list: groupA }, { label: 'Grupo B', list: groupB }].map(g => (
          <div key={g.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
            <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">{g.label}</p>
            <ul className="space-y-1">
              {g.list.map(p => (
                <li key={p.id} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-sky-100 text-sky-700 text-[10px] font-bold flex items-center justify-center">
                    {p.position}
                  </span>
                  <span className="text-sm text-gray-700 truncate">{p.name}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="space-y-2">
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
              className="flex items-center justify-between w-full bg-white rounded-xl px-4 py-3.5 border border-gray-100 shadow-sm"
            >
              <span className="font-semibold text-gray-700">Partidas</span>
              <span className="text-gray-400">→</span>
            </Link>
            <Link
              href={`/tournaments/${id}/ranking`}
              className="flex items-center justify-between w-full bg-white rounded-xl px-4 py-3.5 border border-gray-100 shadow-sm"
            >
              <span className="font-semibold text-gray-700">Ranking</span>
              <span className="text-gray-400">→</span>
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
