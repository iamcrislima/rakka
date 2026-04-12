import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Match, Player } from '@/types'
import ScoreInput from './ScoreInput'

const STAGE_LABEL: Record<string, string> = {
  group_a:           'Grupo A',
  group_b:           'Grupo B',
  sf:                'Semifinais',
  csf:               'Semifinais Consolação',
  final:             'Final',
  consolation_final: 'Final Consolação',
}

async function getData(id: string) {
  const [{ data: matches }, { data: players }] = await Promise.all([
    supabase.from('matches').select('*').eq('tournament_id', id).order('stage').order('round'),
    supabase.from('players').select('*').eq('tournament_id', id),
  ])
  return {
    matches: (matches ?? []) as Match[],
    playerMap: Object.fromEntries(((players ?? []) as Player[]).map(p => [p.id, p])),
  }
}

export default async function MatchesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { matches, playerMap } = await getData(id)

  if (!matches.length) notFound()

  // Group by stage
  const grouped: Record<string, Match[]> = {}
  for (const m of matches) {
    ;(grouped[m.stage] ??= []).push(m)
  }

  const name = (pid: string) => playerMap[pid]?.name ?? '?'

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/tournaments/${id}`} className="text-sm text-sky-600 font-medium">← Torneio</Link>
        <h1 className="text-xl font-bold text-gray-800 mt-1">Partidas</h1>
      </div>

      {Object.entries(grouped).map(([stage, stageMatches]) => (
        <section key={stage} className="space-y-2">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide">
            {STAGE_LABEL[stage] ?? stage}
          </h2>

          {stageMatches.map(m => (
            <div key={m.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
              {/* Round badge */}
              {(stage === 'group_a' || stage === 'group_b') && (
                <span className="text-[11px] font-bold text-gray-400">Rodada {m.round}</span>
              )}

              {/* Teams */}
              <div className="flex items-center gap-3">
                <div className="flex-1 space-y-0.5">
                  <p className="text-sm font-semibold text-gray-800">{name(m.team1_p1)}</p>
                  <p className="text-sm text-gray-500">{name(m.team1_p2)}</p>
                </div>
                <span className="text-xs font-bold text-gray-300">VS</span>
                <div className="flex-1 text-right space-y-0.5">
                  <p className="text-sm font-semibold text-gray-800">{name(m.team2_p1)}</p>
                  <p className="text-sm text-gray-500">{name(m.team2_p2)}</p>
                </div>
              </div>

              {/* Score */}
              {m.status === 'done' ? (
                <div className="flex justify-center gap-4 text-lg font-bold">
                  <span className={m.score1! > m.score2! ? 'text-sky-600' : 'text-gray-400'}>{m.score1}</span>
                  <span className="text-gray-300">–</span>
                  <span className={m.score2! > m.score1! ? 'text-sky-600' : 'text-gray-400'}>{m.score2}</span>
                </div>
              ) : (
                <ScoreInput matchId={m.id} tournamentId={id} />
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
