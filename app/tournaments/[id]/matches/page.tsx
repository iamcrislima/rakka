import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Match, Player } from '@/types'
import ScoreInput from './ScoreInput'

const STAGE_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  group_a:           { label: 'Grupo A',         emoji: '🅰️', color: 'text-sky-600' },
  group_b:           { label: 'Grupo B',         emoji: '🅱️', color: 'text-violet-600' },
  final:             { label: 'Grande Final',    emoji: '🏆', color: 'text-amber-600' },
  consolation_final: { label: 'Final Consolação',emoji: '🥉', color: 'text-slate-600' },
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

function Avatar({ name, winner }: { name: string; winner?: boolean }) {
  const initial = name[0]?.toUpperCase() ?? '?'
  return (
    <div className={`w-9 h-9 rounded-full text-white text-sm font-black flex items-center justify-center shrink-0 ${winner ? 'bg-emerald-500' : 'bg-slate-300'}`}>
      {initial}
    </div>
  )
}

interface TeamRowProps {
  p1: string; p2: string
  score?: number | null
  isWinner?: boolean
  align?: 'left' | 'right'
}

function TeamRow({ p1, p2, score, isWinner, align = 'left' }: TeamRowProps) {
  const isRight = align === 'right'
  return (
    <div className={`flex items-center gap-2 flex-1 ${isRight ? 'flex-row-reverse' : ''}`}>
      <div className={`flex ${isRight ? 'flex-row-reverse' : ''} gap-1.5 shrink-0`}>
        <Avatar name={p1} winner={isWinner} />
        <Avatar name={p2} winner={isWinner} />
      </div>
      <div className={`min-w-0 ${isRight ? 'text-right' : ''}`}>
        <p className={`text-sm font-bold truncate ${isWinner ? 'text-emerald-700' : 'text-slate-700'}`}>{p1}</p>
        <p className={`text-sm font-bold truncate ${isWinner ? 'text-emerald-600' : 'text-slate-500'}`}>{p2}</p>
      </div>
      {score != null && (
        <span className={`text-3xl font-black tabular-nums ml-auto ${isWinner ? 'text-emerald-500' : 'text-slate-200'}`}>
          {score}
        </span>
      )}
    </div>
  )
}

export default async function MatchesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { matches, playerMap } = await getData(id)
  if (!matches.length) notFound()

  const name = (pid: string) => playerMap[pid]?.name ?? '?'

  // Group by stage
  const stageOrder = ['group_a','group_b','final','consolation_final']
  const grouped = new Map<string, Match[]>()
  for (const m of matches) {
    const arr = grouped.get(m.stage) ?? []
    arr.push(m)
    grouped.set(m.stage, arr)
  }

  const pending = matches.filter(m => m.status === 'pending').length
  const done    = matches.filter(m => m.status === 'done').length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="space-y-1">
        <Link href={`/tournaments/${id}`} className="text-sm font-bold text-sky-600">← Torneio</Link>
        <h1 className="text-2xl font-black text-slate-800">Partidas</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">✓ {done} concluídas</span>
          {pending > 0 && (
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full">⏳ {pending} pendentes</span>
          )}
        </div>
      </div>

      {/* Stages */}
      {stageOrder
        .filter(stage => grouped.has(stage))
        .map(stage => {
          const cfg = STAGE_CONFIG[stage]
          const stageMatches = grouped.get(stage)!
          return (
            <section key={stage} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{cfg.emoji}</span>
                <span className={`text-sm font-black uppercase tracking-wide ${cfg.color}`}>{cfg.label}</span>
              </div>

              {stageMatches.map(m => {
                const isDone = m.status === 'done'
                const t1Wins = isDone && m.score1! > m.score2!
                const t2Wins = isDone && m.score2! > m.score1!

                return (
                  <div
                    key={m.id}
                    className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isDone ? 'border-emerald-100' : 'border-amber-100'}`}
                  >
                    {/* Round label */}
                    <div className={`px-4 py-2 text-[11px] font-black uppercase tracking-widest ${isDone ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                      {(stage === 'group_a' || stage === 'group_b') ? `Rodada ${m.round}` : 'Jogo'}
                      {isDone && ' · Concluído ✓'}
                    </div>

                    <div className="px-4 py-4 space-y-4">
                      {/* Teams + score */}
                      {isDone ? (
                        <div className="space-y-2.5">
                          <TeamRow p1={name(m.team1_p1)} p2={name(m.team1_p2)} score={m.score1} isWinner={t1Wins} />
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-px bg-slate-100" />
                            <span className="text-xs font-bold text-slate-300">VS</span>
                            <div className="flex-1 h-px bg-slate-100" />
                          </div>
                          <TeamRow p1={name(m.team2_p1)} p2={name(m.team2_p2)} score={m.score2} isWinner={t2Wins} align="right" />
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2.5">
                            <TeamRow p1={name(m.team1_p1)} p2={name(m.team1_p2)} />
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-px bg-slate-100" />
                              <span className="text-xs font-bold text-slate-300">VS</span>
                              <div className="flex-1 h-px bg-slate-100" />
                            </div>
                            <TeamRow p1={name(m.team2_p1)} p2={name(m.team2_p2)} align="right" />
                          </div>
                          <div className="pt-1 border-t border-slate-50">
                            <ScoreInput matchId={m.id} />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </section>
          )
        })}
    </div>
  )
}
