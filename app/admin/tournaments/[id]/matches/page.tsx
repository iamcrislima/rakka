import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { rulesFromTournament, rulesHint } from '@/lib/match-rules'
import type { Match, Player, Tournament, MatchRules } from '@/types'
import ScoreInput from './ScoreInput'
import BackLink from '@/app/components/BackLink'

async function getData(id: string) {
  const [{ data: tournament }, { data: matches }, { data: players }] = await Promise.all([
    supabase.from('tournaments').select('*').eq('id', id).single(),
    supabase.from('matches').select('*').eq('tournament_id', id).order('stage').order('round'),
    supabase.from('players').select('*').eq('tournament_id', id),
  ])
  return {
    tournament: tournament as Tournament | null,
    matches:    (matches  ?? []) as Match[],
    playerMap:  Object.fromEntries(((players ?? []) as Player[]).map(p => [p.id, p])),
  }
}

function Avatar({ name, winner, size = 'md' }: { name: string; winner?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'lg' ? 'w-11 h-11 text-base' : size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-sm'
  return (
    <div className={`${sz} rounded-full text-white font-black flex items-center justify-center shrink-0 transition-colors ${
      winner ? 'bg-emerald-500' : 'bg-[#1C1C1C]'
    }`}>
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

function TeamRow({ p1, p2, score, isWinner, align = 'left', large = false }: {
  p1: string; p2: string; score?: number | null; isWinner?: boolean; align?: 'left' | 'right'; large?: boolean
}) {
  const isRight  = align === 'right'
  const nameSize = large ? 'text-base' : 'text-sm'
  return (
    <div className={`flex items-center gap-2.5 flex-1 ${isRight ? 'flex-row-reverse' : ''}`}>
      <div className={`flex ${isRight ? 'flex-row-reverse' : ''} gap-1.5 shrink-0`}>
        <Avatar name={p1} winner={isWinner} size={large ? 'lg' : 'md'} />
        <Avatar name={p2} winner={isWinner} size={large ? 'lg' : 'md'} />
      </div>
      <div className={`min-w-0 ${isRight ? 'text-right' : ''}`}>
        <p className={`${nameSize} font-bold truncate ${isWinner ? 'text-emerald-400' : 'text-[#F0F0F0]'}`}>{p1}</p>
        <p className={`${nameSize} font-bold truncate ${isWinner ? 'text-emerald-400' : 'text-[#888888]'}`}>{p2}</p>
      </div>
      {score != null && (
        <span className={`font-display tabular-nums ml-auto font-bold ${large ? 'text-4xl' : 'text-3xl'} ${
          isWinner ? 'text-[#C8F135]' : 'text-[#6B6B6B]'
        }`}>
          {score}
        </span>
      )}
    </div>
  )
}

function VSRule() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-px bg-[#1C1C1C]" />
      <span className="text-[10px] font-black text-[#444444] tracking-widest">VS</span>
      <div className="flex-1 h-px bg-[#1C1C1C]" />
    </div>
  )
}

function formatDuration(totalSecs: number): string {
  if (totalSecs < 60) return `${totalSecs}s`
  return `${Math.round(totalSecs / 60)}min`
}

function MatchCard({ m, name, tournamentId, rules }: {
  m: Match; name: (id: string) => string; tournamentId: string; rules: MatchRules
}) {
  const isDone   = m.status === 'done'
  const t1Wins   = isDone && (m.score1 ?? 0) > (m.score2 ?? 0)
  const t2Wins   = isDone && (m.score2 ?? 0) > (m.score1 ?? 0)
  const isFinal  = m.stage === 'final'
  const isConsolation = m.stage === 'consolation_final'
  const isFinals = isFinal || isConsolation

  return (
    <div className={`rounded-2xl overflow-hidden shadow-sm ${
      isFinal && !isDone
        ? 'border-2 border-amber-400/50 ring-pulse'
        : isFinals
          ? 'border border-amber-500/30'
          : isDone
            ? 'border border-emerald-500/20'
            : 'border border-[#242424]'
    }`}>

      {/* Header */}
      <div className={`px-4 py-2.5 flex items-center justify-between ${
        isFinal && !isDone    ? 'bg-gradient-to-r from-amber-500/25 to-orange-500/25' :
        isFinals && !isDone   ? 'bg-amber-500/15' :
        isDone                ? 'bg-emerald-500/10' : 'bg-[#111111]'
      }`}>
        <span className={`text-[11px] font-black uppercase tracking-widest ${
          isFinals && !isDone ? 'text-amber-400' : isDone ? 'text-emerald-400' : 'text-[#888888]'
        }`}>
          {isFinal ? '🏆 Grande Final' : isConsolation ? '🥉 Final Consolação' : `Rodada ${m.round}`}
        </span>
        <div className="flex items-center gap-2">
          {isDone && m.duration_seconds != null && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1C1C1C] text-[#888888]">
              ⏱ {formatDuration(m.duration_seconds)}
            </span>
          )}
          <span
            className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full"
            style={
              isDone
                ? { background: 'rgba(34,197,94,0.15)', color: '#22C55E' }
                : isFinals
                  ? { background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }
                  : { background: 'var(--bt-neon-dim)', color: 'var(--bt-neon)' }
            }
          >
            {isDone ? '✓ Concluído' : isFinals ? '🏆 Final' : '● A disputar'}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className={`px-4 py-4 space-y-3 ${isFinal && !isDone ? 'bg-amber-500/[0.04]' : 'bg-[#161616]'}`}>
        {isDone ? (
          <div className="space-y-2.5">
            <TeamRow p1={name(m.team1_p1)} p2={name(m.team1_p2)} score={m.score1} isWinner={t1Wins} large={isFinals} />
            <VSRule />
            <TeamRow p1={name(m.team2_p1)} p2={name(m.team2_p2)} score={m.score2} isWinner={t2Wins} align="right" large={isFinals} />
            <div className="pt-1 border-t border-[#242424]">
              <ScoreInput matchId={m.id} tournamentId={tournamentId} stage={m.stage} rules={rules} editMode={{ score1: m.score1, score2: m.score2 }} />
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2.5">
              <TeamRow p1={name(m.team1_p1)} p2={name(m.team1_p2)} large={isFinals} />
              <VSRule />
              <TeamRow p1={name(m.team2_p1)} p2={name(m.team2_p2)} align="right" large={isFinals} />
            </div>
            <div className="pt-1 border-t border-[#242424]">
              <ScoreInput matchId={m.id} tournamentId={tournamentId} stage={m.stage} rules={rules} startedAt={m.started_at} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default async function MatchesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }                        = await params
  const { tournament, matches, playerMap } = await getData(id)
  if (!matches.length || !tournament) notFound()

  const rules = rulesFromTournament(tournament)
  const name  = (pid: string) => playerMap[pid]?.name ?? '?'

  const groupMatches  = matches.filter(m => m.stage === 'group_a' || m.stage === 'group_b')
  const finalsMatches = matches.filter(m => m.stage === 'final' || m.stage === 'consolation_final')

  const groupDone  = groupMatches.filter(m => m.status === 'done').length
  const finalsDone = finalsMatches.filter(m => m.status === 'done').length
  const totalDone  = matches.filter(m => m.status === 'done').length

  const sortedGroup = [...groupMatches].sort((a, b) =>
    a.stage.localeCompare(b.stage) || a.round - b.round
  )
  const sortedFinals = [...finalsMatches].sort((a, b) => a.stage === 'final' ? -1 : 1)

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="space-y-3">
        <BackLink href={`/admin/tournaments/${id}`} label="Torneio" className="text-sm font-bold text-[#C8F135] active:opacity-70" />
        <div className="flex items-end justify-between">
          <h1 className="text-2xl font-black text-[#F0F0F0]">Partidas</h1>
          <span className="text-xs font-bold text-[#888888] pb-0.5">{totalDone}/{matches.length} concluídas</span>
        </div>

        {/* Rules badge */}
        <div className="inline-flex items-center gap-1.5 bg-[#161616] border border-[#242424] rounded-full px-3 py-1">
          <span className="text-[10px]">📋</span>
          <span className="text-[10px] font-bold text-[#888888]">{rulesHint(rules)}</span>
        </div>

        {/* Progress pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <Pill color="sky"   label={`${groupDone}/6 grupos`}  done={groupDone === 6} />
          {finalsMatches.length > 0 && (
            <Pill color="amber" label={`${finalsDone}/${finalsMatches.length} finais`} done={finalsDone === finalsMatches.length} />
          )}
        </div>
      </div>

      {/* Finals section — highest visual priority */}
      {finalsMatches.length > 0 && (
        <section className="space-y-2.5">
          <SectionLabel icon="⚡" label="Finais" color="text-amber-400" />
          <div className="stagger space-y-2.5">
            {sortedFinals.map(m => (
              <MatchCard key={m.id} m={m} name={name} tournamentId={id} rules={rules} />
            ))}
          </div>
        </section>
      )}

      {/* Group stage */}
      {(['group_a', 'group_b'] as const).map(stage => {
        const stageMatches = sortedGroup.filter(m => m.stage === stage)
        if (!stageMatches.length) return null
        const cfg = stage === 'group_a'
          ? { label: 'Grupo A', icon: '🅰️', color: 'text-[#C8F135]' }
          : { label: 'Grupo B', icon: '🅱️', color: 'text-[#C8F135]' }
        return (
          <section key={stage} className="space-y-2.5">
            <SectionLabel icon={cfg.icon} label={cfg.label} color={cfg.color} />
            <div className="stagger space-y-2.5">
              {stageMatches.map(m => (
                <MatchCard key={m.id} m={m} name={name} tournamentId={id} rules={rules} />
              ))}
            </div>
          </section>
        )
      })}

      {totalDone === matches.length && (
        <div className="text-center py-5 text-emerald-400 font-bold text-sm animate-fade-in">
          ✓ Todos os jogos concluídos
        </div>
      )}

    </div>
  )
}

function Pill({ label, color, done }: { label: string; color: 'sky' | 'amber'; done: boolean }) {
  if (done) return (
    <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/15 px-2.5 py-1 rounded-full">
      ✓ {label}
    </span>
  )
  const cls = color === 'amber' ? 'text-amber-400 bg-amber-500/15' : 'text-[#C8F135] bg-[#1C1C1C]'
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cls}`}>{label}</span>
}

function SectionLabel({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 px-0.5">
      <span className="text-base leading-none">{icon}</span>
      <span className={`text-xs font-black uppercase tracking-widest ${color}`}>{label}</span>
    </div>
  )
}
