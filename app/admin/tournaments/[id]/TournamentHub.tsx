'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Tournament, Player, Match, MatchRules, PlayerStats, Court } from '@/types'
import type { KnockoutSeed, MatchSeed } from '@/lib/match-generator'
import { computeRanking } from '@/lib/ranking'
import { rulesHint, isValidFinalScore, maxScore } from '@/lib/match-rules'
import { supabase } from '@/lib/supabase'
import { submitMatchResult } from './matches/actions'
import MatchCard from './MatchCard'
import GenerateFinalsButton from './GenerateFinalsButton'
import ShuffleGroupsButton from './ShuffleGroupsButton'
import StartGroupStageButton from './StartGroupStageButton'
import { useTopbar } from '@/app/components/TopbarContext'

// ── Types ─────────────────────────────────────────────────────

type TabId = 'matches' | 'ranking' | 'bracket' | 'info'

export interface HubProps {
  tournament:  Tournament
  players:     Player[]
  matches:     Match[]
  rules:       MatchRules
  finalsSeeds: KnockoutSeed[] | null
  matchSeeds:  MatchSeed[]
  courts?:     Court[]
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'matches', label: 'Partidas', icon: '🏸' },
  { id: 'ranking', label: 'Ranking',  icon: '📊' },
  { id: 'bracket', label: 'Chaves',   icon: '⚡' },
  { id: 'info',    label: 'Info',     icon: '⚙️' },
]

// ── Root ──────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  draft:       'Rascunho',
  group_stage: 'Fase de grupos',
  finals:      'Finais',
  done:        'Encerrado',
}

export default function TournamentHub(props: HubProps) {
  const { tournament, players, matches, finalsSeeds } = props

  // Sync topbar with tournament context
  const { setMeta } = useTopbar()
  useEffect(() => {
    setMeta({
      title:    tournament.name,
      subtitle: STATUS_LABELS[tournament.status] ?? tournament.status,
      eyebrow:  'Torneio',
    })
    return () => setMeta({ title: '', subtitle: null, eyebrow: null })
  }, [tournament.name, tournament.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // Optimistic scores: updated as user types — drives live ranking
  const [pendingScores, setPendingScores] = useState<
    Record<string, { s1: number | '', s2: number | '' }>
  >({})

  const handleScoreChange = useCallback((matchId: string, s1: number | '', s2: number | '') => {
    setPendingScores(prev => ({ ...prev, [matchId]: { s1, s2 } }))
  }, [])

  // Effective matches: overlay pending scores for ranking computation
  const effectiveMatches = useMemo(() =>
    matches.map(m => {
      const p = pendingScores[m.id]
      if (!p || m.status === 'done') return m
      const s1 = typeof p.s1 === 'number' ? p.s1 : null
      const s2 = typeof p.s2 === 'number' ? p.s2 : null
      if (s1 === null || s2 === null || s1 === s2) return m
      return { ...m, score1: s1, score2: s2, status: 'done' as const }
    }),
    [matches, pendingScores]
  )

  // Mobile tab state
  const [tab, setTab] = useState<TabId>('matches')

  const groupMatches  = matches.filter(m => m.stage === 'group_a' || m.stage === 'group_b')
  const finalsMatches = matches.filter(m => m.stage === 'final' || m.stage === 'consolation_final')
  const allGroupDone  = groupMatches.length === 6 && groupMatches.every(m => m.status === 'done')
  const infoAlert     = tournament.status === 'draft' || finalsSeeds !== null

  const matchesTabProps = { ...props, allGroupDone, finalsMatches, groupMatches, onScoreChange: handleScoreChange }
  const rankingProps    = { ...props, effectiveMatches }

  // Overall progress
  const totalMatches    = matches.length
  const finishedMatches = effectiveMatches.filter(m => m.status === 'done').length
  const progressPct     = totalMatches > 0 ? Math.round((finishedMatches / totalMatches) * 100) : 0
  const liveCount       = Object.values(pendingScores).filter(
    p => (typeof p.s1 === 'number' || typeof p.s2 === 'number') && p.s1 !== p.s2
  ).length

  return (
    <div>

      {/* ── Header ──────────────────────────────────────── */}
      <ControlPanelHeader
        tournament={tournament}
        rules={props.rules}
        progressPct={progressPct}
        finishedMatches={finishedMatches}
        totalMatches={totalMatches}
        liveCount={liveCount}
      />

      {/* ══════════════════════════════════════════════
          MOBILE — tab-based layout
      ══════════════════════════════════════════════ */}
      <div className="lg:hidden pt-4 pb-24">
        {tab === 'matches' && <MatchesTab {...matchesTabProps} />}
        {tab === 'ranking' && <RankingTab {...rankingProps} />}
        {tab === 'bracket' && <BracketTab {...props} finalsMatches={finalsMatches} />}
        {tab === 'info'    && <InfoTab    {...props} />}
      </div>

      {/* ══════════════════════════════════════════════
          DESKTOP — 70/30 control panel (always-visible)
      ══════════════════════════════════════════════ */}
      <div className="hidden lg:grid gap-5 pt-5 items-start"
           style={{ gridTemplateColumns: '70fr 30fr' }}>

        {/* Left — Matches (70%) */}
        <MatchesTab {...matchesTabProps} />

        {/* Right — Live Ranking (30%, sticky) */}
        <div className="sticky space-y-4" style={{ top: '24px' }}>
          {(tournament.status === 'draft' || finalsSeeds) && (
            <InfoActionsCard {...props} />
          )}
          <LiveRankingPanel
            players={players}
            effectiveMatches={effectiveMatches}
            liveCount={liveCount}
          />
          {finalsMatches.length > 0 && (
            <BracketTab {...props} finalsMatches={finalsMatches} compact />
          )}
        </div>

      </div>

      {/* ── Mobile bottom tab bar ───────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-sm border-t"
           style={{ background: 'rgba(13,21,37,0.97)', borderColor: 'var(--bt-border)' }}>
        <div className="max-w-md mx-auto grid grid-cols-4 px-2 pb-safe">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="relative flex flex-col items-center gap-0.5 py-3 text-center transition-colors"
              style={{ color: tab === t.id ? 'var(--bt-neon)' : 'var(--bt-muted)' }}
            >
              <span className="text-xl leading-none">{t.icon}</span>
              <span className="text-[10px] font-bold">{t.label}</span>
              {t.id === 'info' && infoAlert && tab !== 'info' && (
                <span className="absolute top-2 right-4 w-2 h-2 bg-amber-400 rounded-full" />
              )}
              {tab === t.id && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                      style={{ background: 'var(--bt-neon)' }} />
              )}
            </button>
          ))}
        </div>
      </nav>

    </div>
  )
}

// ── Control Panel Header ──────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; dot: string; shape: string }> = {
  draft:       { label: 'Rascunho',       dot: '#6B6B6B',  shape: '○' },
  group_stage: { label: 'Fase de grupos', dot: '#C8F135',  shape: '▶' },
  finals:      { label: 'Finais',         dot: '#fbbf24',  shape: '◆' },
  done:        { label: 'Encerrado',      dot: '#4ade80',  shape: '✓' },
}

function ControlPanelHeader({
  tournament, rules, progressPct, finishedMatches, totalMatches, liveCount,
}: {
  tournament: Tournament
  rules: MatchRules
  progressPct: number
  finishedMatches: number
  totalMatches: number
  liveCount: number
}) {
  const cfg = STATUS_CFG[tournament.status] ?? STATUS_CFG.draft

  return (
    <div className="rounded-2xl overflow-hidden"
         style={{ background: 'linear-gradient(135deg, #0d1b3e 0%, var(--bt-surface) 100%)', border: '1px solid var(--bt-border)' }}>
      <div className="px-5 py-4 lg:px-7 lg:py-5">

        {/* Top row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/admin" className="text-xs font-bold transition-colors shrink-0 hidden lg:block"
                  style={{ color: 'var(--bt-muted)' }}>
              ← Torneios
            </Link>
            <div className="hidden lg:block w-px h-4" style={{ background: 'var(--bt-border)' }} />
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest mb-0.5"
                 style={{ color: 'var(--bt-neon)' }}>
                Painel de Controle
              </p>
              <h1 className="text-xl lg:text-2xl font-black leading-tight truncate"
                  style={{ color: 'var(--bt-text)' }}>
                {tournament.name}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {liveCount > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-black px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(0,200,240,0.12)', color: 'var(--bt-neon)', border: '1px solid rgba(0,200,240,0.25)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--bt-neon)', animation: 'live-dot 1.4s ease-in-out infinite' }} />
                {liveCount} ao vivo
              </span>
            )}
            <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: 'var(--bt-elevated)', color: 'var(--bt-muted)' }}>
              {rulesHint(rules)}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: cfg.dot }} />
              <span className="text-sm font-black" style={{ color: 'var(--bt-muted)' }}>{cfg.shape} {cfg.label}</span>
            </div>
            <a href={`/t/${tournament.id}/tv`}
               className="text-xs font-bold px-2.5 py-1 rounded-full transition-colors"
               style={{ background: 'var(--bt-elevated)', color: 'var(--bt-muted)' }}>
              📺 TV
            </a>
          </div>
        </div>

        {/* Progress bar */}
        {totalMatches > 0 && (
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bt-elevated)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPct}%`,
                  background: 'linear-gradient(90deg, var(--bt-neon), #4ade80)',
                }}
              />
            </div>
            <span className="text-xs font-bold shrink-0" style={{ color: 'var(--bt-muted)' }}>
              {finishedMatches}/{totalMatches} partidas · {progressPct}%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Live Ranking Panel (desktop sidebar) ──────────────────────

function LiveRankingPanel({
  players, effectiveMatches, liveCount,
}: {
  players: Player[]
  effectiveMatches: Match[]
  liveCount: number
}) {
  const groupA = players.filter(p => p.position <= 4)
  const groupB = players.filter(p => p.position >= 5)
  const rankA  = computeRanking(groupA, effectiveMatches.filter(m => m.stage === 'group_a'))
  const rankB  = computeRanking(groupB, effectiveMatches.filter(m => m.stage === 'group_b'))

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bt-card)', border: '1px solid var(--bt-border)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--bt-border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-sm">⚡</span>
          <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--bt-text)' }}>
            Ranking ao Vivo
          </span>
        </div>
        {liveCount > 0 && (
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--bt-neon)', animation: 'live-dot 1.4s ease-in-out infinite' }} />
        )}
      </div>

      {/* Groups */}
      <div className="divide-y" style={{ borderColor: 'var(--bt-border)' }}>
        <LiveGroupRank label="Grupo A" color="#38bdf8" stats={rankA} />
        <LiveGroupRank label="Grupo B" color="#a78bfa" stats={rankB} />
      </div>
    </div>
  )
}

function LiveGroupRank({ label, color, stats }: { label: string; color: string; stats: PlayerStats[] }) {
  const hasData = stats.some(s => s.wins + s.losses > 0)
  const letter  = label.slice(-1)

  return (
    <div>
      {/* Group label */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: 'var(--bt-border)', background: 'var(--bt-elevated)' }}>
        <span className="w-4 h-4 rounded text-white text-[9px] font-black flex items-center justify-center"
              style={{ background: color }}>
          {letter}
        </span>
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--bt-muted)' }}>
          {label}
        </span>
      </div>

      {/* Rows */}
      {!hasData && (
        <p className="text-xs font-medium px-4 py-3" style={{ color: 'var(--bt-subtle)' }}>
          Sem resultados ainda
        </p>
      )}
      {stats.map((s, i) => {
        const advancing = i < 2 && hasData
        const isFirst   = i === 0
        return (
          <div key={s.player.id}
               className="flex items-center gap-3 px-4 border-b last:border-0 transition-colors"
               style={{
                 borderColor: 'var(--bt-border)',
                 background: advancing ? 'var(--bt-neon-dim)' : undefined,
                 paddingTop: isFirst ? 12 : 10,
                 paddingBottom: isFirst ? 12 : 10,
               }}>
            <span className={`font-display font-bold w-5 text-center tabular-nums shrink-0 ${isFirst ? 'text-lg' : 'text-sm'}`}
                  style={{ color: isFirst ? 'var(--bt-neon)' : 'var(--bt-subtle)' }}>
              {i + 1}
            </span>
            <div className="rounded-full font-black flex items-center justify-center shrink-0"
                 style={{
                   width: isFirst ? 30 : 28, height: isFirst ? 30 : 28, fontSize: isFirst ? 11 : 10,
                   background: advancing ? color : 'var(--bt-elevated)',
                   color: advancing ? '#0A0A0A' : 'var(--bt-muted)',
                 }}>
              {s.player.name[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <Link href={`/players/${s.player.id}`}
                    className="text-xs font-bold truncate hover:underline block"
                    style={{ color: 'var(--bt-text)' }}>
                {s.player.name}
              </Link>
              {advancing && (
                <p className="text-[9px] font-bold" style={{ color }}>✓ Classificado</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-black tabular-nums" style={{ color: 'var(--bt-text)' }}>
                {s.wins}V · {s.losses}D
              </p>
              <p className="text-[10px] font-bold tabular-nums"
                 style={{ color: s.gameDiff >= 0 ? 'var(--bt-green)' : 'var(--bt-red)' }}>
                {s.gameDiff > 0 ? '+' : ''}{s.gameDiff}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Info actions card (desktop) ───────────────────────────────

function InfoActionsCard({ tournament, players, rules, finalsSeeds, matchSeeds }: HubProps) {
  const groupA   = players.filter(p => p.position <= 4)
  const groupB   = players.filter(p => p.position >= 5)
  const canStart = tournament.status === 'draft' && players.length === 8

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bt-card)', border: '1px solid rgba(245,158,11,0.25)' }}>
      <div className="px-4 py-3 flex items-center gap-2 border-b" style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.15)' }}>
        <span className="text-sm">⚙️</span>
        <p className="text-xs font-black text-amber-500 uppercase tracking-widest">Ações</p>
      </div>
      <div className="px-4 py-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Grupo A', list: groupA, color: '#38bdf8' },
            { label: 'Grupo B', list: groupB, color: '#a78bfa' },
          ].map(g => (
            <div key={g.label} className="space-y-1">
              <div className="flex items-center gap-1">
                <span className="w-4 h-4 rounded text-white text-[9px] font-black flex items-center justify-center"
                      style={{ background: g.color }}>
                  {g.label.slice(-1)}
                </span>
                <span className="text-[10px] font-bold" style={{ color: 'var(--bt-muted)' }}>
                  {g.label}
                </span>
              </div>
              {g.list.map(p => (
                <p key={p.id} className="text-xs font-semibold truncate pl-5" style={{ color: 'var(--bt-text)' }}>
                  {p.name}
                </p>
              ))}
              {g.list.length === 0 && (
                <p className="text-xs pl-5" style={{ color: 'var(--bt-subtle)' }}>—</p>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs font-medium border-t pt-3" style={{ color: 'var(--bt-muted)', borderColor: 'var(--bt-border)' }}>
          {rulesHint(rules)}
        </p>

        {canStart && (
          <div className="space-y-2 pt-1">
            <ShuffleGroupsButton tournamentId={tournament.id} players={players} />
            <StartGroupStageButton tournamentId={tournament.id} players={players} matchSeeds={matchSeeds} />
          </div>
        )}
        {finalsSeeds && (
          <GenerateFinalsButton tournamentId={tournament.id} seeds={finalsSeeds} />
        )}
      </div>
    </div>
  )
}

// ── autoComplete helper ───────────────────────────────────────

async function autoComplete(tournamentId: string, categoryId?: string) {
  if (categoryId) {
    const { data } = await supabase
      .from('matches').select('status')
      .eq('category_id', categoryId).in('stage', ['final', 'consolation_final'])
    if (data?.length === 2 && data.every(m => m.status === 'done')) {
      await supabase.from('categories').update({ status: 'done' }).eq('id', categoryId)
      const { data: cats } = await supabase.from('categories').select('status').eq('tournament_id', tournamentId)
      if (cats?.every(c => c.status === 'done'))
        await supabase.from('tournaments').update({ status: 'done' }).eq('id', tournamentId)
    }
  } else {
    const { data } = await supabase
      .from('matches').select('status')
      .eq('tournament_id', tournamentId).in('stage', ['final', 'consolation_final'])
    if (data?.length === 2 && data.every(m => m.status === 'done'))
      await supabase.from('tournaments').update({ status: 'done' }).eq('id', tournamentId)
  }
}

// ── ControlMatchRow — horizontal row for the desktop control panel ──

interface ControlMatchRowProps {
  m:              Match
  name:           (id: string) => string
  tournamentId:   string
  categoryId?:    string
  rules:          MatchRules
  onScoreChange?: (matchId: string, s1: number | '', s2: number | '') => void
}

function ScoreCell({ value, onChange, max }: {
  value: number | ''; onChange: (v: number | '') => void; max: number
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={2}
      value={value === '' ? '' : value}
      placeholder="—"
      onFocus={() => ref.current?.select()}
      onChange={e => {
        const raw = e.target.value
        if (raw === '') { onChange(''); return }
        const n = parseInt(raw, 10)
        if (!isNaN(n) && n >= 0 && n <= max) onChange(n)
      }}
      className="w-9 h-9 text-center font-black tabular-nums rounded-lg border-2 text-sm
                 focus:outline-none transition-colors
                 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none
                 [&::-webkit-inner-spin-button]:appearance-none"
      style={{
        background:  'var(--bt-elevated)',
        borderColor: 'var(--bt-border)',
        color:       'var(--bt-text)',
      }}
      onFocusCapture={e => {
        (e.target as HTMLInputElement).style.borderColor = 'var(--bt-neon)'
        ;(e.target as HTMLInputElement).style.boxShadow  = '0 0 0 3px rgba(0,200,240,0.15)'
      }}
      onBlur={e => {
        (e.target as HTMLInputElement).style.borderColor = 'var(--bt-border)'
        ;(e.target as HTMLInputElement).style.boxShadow  = ''
      }}
    />
  )
}

function TbCell({ value, onChange }: { value: number | ''; onChange: (v: number | '') => void }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={3}
      value={value === '' ? '' : value}
      placeholder="—"
      onChange={e => {
        const raw = e.target.value
        if (raw === '') { onChange(''); return }
        const n = parseInt(raw, 10)
        if (!isNaN(n) && n >= 0 && n <= 99) onChange(n)
      }}
      className="w-8 h-7 text-center font-bold text-xs rounded-md border
                 focus:outline-none transition-colors
                 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none
                 [&::-webkit-inner-spin-button]:appearance-none"
      style={{
        background:  'var(--bt-elevated)',
        borderColor: 'rgba(251,191,36,0.4)',
        color:       '#fbbf24',
      }}
    />
  )
}

function ControlMatchRow({ m, name, tournamentId, categoryId, rules, onScoreChange }: ControlMatchRowProps) {
  const router = useRouter()

  const [s1, setS1Raw]   = useState<number | ''>('')
  const [s2, setS2Raw]   = useState<number | ''>('')
  const [tb1, setTb1]    = useState<number | ''>('')
  const [tb2, setTb2]    = useState<number | ''>('')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  function setS1(v: number | '') { setS1Raw(v); onScoreChange?.(m.id, v, s2) }
  function setS2(v: number | '') { setS2Raw(v); onScoreChange?.(m.id, s1, v) }

  const isDone   = m.status === 'done' || saved
  const max      = maxScore(rules)
  const mg       = rules.max_games
  const isSoma   = rules.type === 'sum_of_games'
  const n1       = typeof s1 === 'number' ? s1 : 0
  const n2       = typeof s2 === 'number' ? s2 : 0
  const isTied   = !isDone && !isSoma && rules.deuce === 'super_tiebreak' && s1 === mg && s2 === mg
  const tbN1     = typeof tb1 === 'number' ? tb1 : 0
  const tbN2     = typeof tb2 === 'number' ? tb2 : 0
  const tbValid  = isTied && tb1 !== '' && tb2 !== '' &&
    Math.max(tbN1, tbN2) >= rules.tiebreak_to && Math.abs(tbN1 - tbN2) >= 1
  const canSave  = !isDone && s1 !== '' && s2 !== '' &&
    (isTied ? tbValid : isValidFinalScore(n1, n2, rules))
  const scoreHint = (!canSave && s1 !== '' && s2 !== '' && !isTied && isSoma)
    ? `Soma deve ser ${rules.targetSum}`
    : null

  const storedS1 = m.score1; const storedS2 = m.score2
  const t1Wins   = isDone && (saved ? n1 > n2 : (storedS1 ?? 0) > (storedS2 ?? 0))
  const t2Wins   = isDone && (saved ? n2 > n1 : (storedS2 ?? 0) > (storedS1 ?? 0))
  const isFinals = m.stage === 'final' || m.stage === 'consolation_final'

  const dispS1 = isDone ? (saved ? n1 : storedS1 ?? '—') : s1
  const dispS2 = isDone ? (saved ? n2 : storedS2 ?? '—') : s2

  async function save() {
    if (!canSave || saving) return
    setSaving(true)
    setSaveError(null)
    const fS1 = isTied ? (tbN1 > tbN2 ? mg + 1 : mg) : n1
    const fS2 = isTied ? (tbN2 > tbN1 ? mg + 1 : mg) : n2
    const result = await submitMatchResult(m.id, fS1, fS2)
    if (!result.ok) {
      setSaveError(result.error ?? 'Não foi possível salvar o resultado.')
      setSaving(false)
      return
    }
    if (isFinals) await autoComplete(tournamentId, categoryId)
    setSaved(true)
    setSaving(false)
    router.refresh()
  }

  // Accent color for finals
  const finalsAccent = isFinals && !isDone

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background:   'var(--bt-card)',
        border:       `1px solid ${finalsAccent ? 'rgba(251,191,36,0.3)' : isDone ? 'rgba(34,197,94,0.15)' : 'var(--bt-border)'}`,
      }}
    >
      {/* ── Main row ── */}
      <div className="grid items-center gap-x-3 px-3 py-2.5"
           style={{ gridTemplateColumns: 'auto 1fr auto 1fr auto' }}>

        {/* Round badge */}
        <span className="text-[10px] font-black uppercase tracking-wide shrink-0 w-6 text-center"
              style={{ color: finalsAccent ? '#fbbf24' : 'var(--bt-subtle)' }}>
          {m.stage === 'final' ? '🏆' : m.stage === 'consolation_final' ? '🥉' : `R${m.round}`}
        </span>

        {/* Left team */}
        <div className="min-w-0 flex items-center gap-1 justify-end"
             style={{ opacity: isDone && !t1Wins ? 0.35 : 1 }}>
          <span className="text-sm font-bold truncate"
                style={{ color: t1Wins ? 'var(--bt-green)' : 'var(--bt-text)' }}>
            {name(m.team1_p1)}
          </span>
          <span className="text-[10px] font-black shrink-0" style={{ color: 'var(--bt-subtle)' }}>+</span>
          <span className="text-sm font-bold truncate"
                style={{ color: t1Wins ? 'var(--bt-green)' : 'var(--bt-text)' }}>
            {name(m.team1_p2)}
          </span>
        </div>

        {/* Score pair */}
        <div className="flex items-center gap-1.5 shrink-0 px-1">
          {isDone ? (
            <>
              <span className="w-9 h-9 flex items-center justify-center text-lg font-black tabular-nums rounded-lg"
                    style={{
                      color:      t1Wins ? 'var(--bt-green)' : 'var(--bt-subtle)',
                      background: 'var(--bt-elevated)',
                    }}>
                {dispS1}
              </span>
              <span className="text-xs font-black" style={{ color: 'var(--bt-subtle)' }}>×</span>
              <span className="w-9 h-9 flex items-center justify-center text-lg font-black tabular-nums rounded-lg"
                    style={{
                      color:      t2Wins ? 'var(--bt-green)' : 'var(--bt-subtle)',
                      background: 'var(--bt-elevated)',
                    }}>
                {dispS2}
              </span>
            </>
          ) : (
            <>
              <ScoreCell value={s1} onChange={setS1} max={max} />
              <span className="text-xs font-black" style={{ color: 'var(--bt-subtle)' }}>×</span>
              <ScoreCell value={s2} onChange={setS2} max={max} />
            </>
          )}
        </div>

        {/* Right team */}
        <div className="min-w-0 flex items-center gap-1"
             style={{ opacity: isDone && !t2Wins ? 0.35 : 1 }}>
          <span className="text-sm font-bold truncate"
                style={{ color: t2Wins ? 'var(--bt-green)' : 'var(--bt-text)' }}>
            {name(m.team2_p1)}
          </span>
          <span className="text-[10px] font-black shrink-0" style={{ color: 'var(--bt-subtle)' }}>+</span>
          <span className="text-sm font-bold truncate"
                style={{ color: t2Wins ? 'var(--bt-green)' : 'var(--bt-text)' }}>
            {name(m.team2_p2)}
          </span>
        </div>

        {/* Action */}
        <div className="shrink-0 w-8 flex items-center justify-center">
          {isDone ? (
            <span className="text-sm" style={{ color: 'var(--bt-green)' }}>✓</span>
          ) : canSave ? (
            <button
              onClick={save}
              disabled={saving}
              title="Confirmar resultado"
              className="w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center transition-all active:scale-90 disabled:opacity-40"
              style={{
                background: finalsAccent ? 'rgba(251,191,36,0.15)' : 'rgba(34,197,94,0.15)',
                color:      finalsAccent ? '#fbbf24' : 'var(--bt-green)',
                border:     `1px solid ${finalsAccent ? 'rgba(251,191,36,0.3)' : 'rgba(34,197,94,0.3)'}`,
              }}
            >
              {saving ? '…' : '✓'}
            </button>
          ) : (
            <span className="w-7 h-7" />
          )}
        </div>
      </div>

      {/* ── Score error row ── */}
      {(scoreHint || saveError) && (
        <p className="text-center text-[10px] font-bold pb-2 px-3 animate-fade-in" style={{ color: 'var(--bt-red)' }}>
          {saveError ? `⚠️ ${saveError}` : scoreHint}
        </p>
      )}

      {/* ── Tiebreak row ── */}
      {isTied && (
        <div className="flex items-center gap-2 justify-center px-3 pb-2.5 animate-fade-in">
          <span className="text-[9px] font-black uppercase tracking-widest"
                style={{ color: '#fbbf24' }}>
            TB até {rules.tiebreak_to}
          </span>
          <TbCell value={tb1} onChange={setTb1} />
          <span className="text-xs font-black" style={{ color: 'var(--bt-subtle)' }}>×</span>
          <TbCell value={tb2} onChange={setTb2} />
        </div>
      )}
    </div>
  )
}

// ── Matches tab ───────────────────────────────────────────────

interface MatchesTabProps extends HubProps {
  allGroupDone:  boolean
  finalsMatches: Match[]
  groupMatches:  Match[]
  onScoreChange: (matchId: string, s1: number | '', s2: number | '') => void
}

function MatchesTab({ tournament, players, matches, rules, finalsSeeds, allGroupDone, finalsMatches, groupMatches, courts, onScoreChange }: MatchesTabProps) {
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]))
  const name      = (id: string) => playerMap[id]?.name ?? '?'

  const groupDone  = groupMatches.filter(m => m.status === 'done').length
  const finalsDone = finalsMatches.filter(m => m.status === 'done').length
  const totalDone  = matches.filter(m => m.status === 'done').length

  const sortedGroup  = [...groupMatches].sort((a, b) => a.stage.localeCompare(b.stage) || a.round - b.round)
  const sortedFinals = [...finalsMatches].sort((a, b) => a.stage === 'final' ? -1 : 1)

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Progress pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <ProgressPill done={groupDone === 6}   label={`${groupDone}/6 grupos`}   color="sky" />
        {finalsMatches.length > 0 && (
          <ProgressPill done={finalsDone === 2} label={`${finalsDone}/2 finais`} color="amber" />
        )}
        {totalDone === matches.length && matches.length > 0 && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ color: 'var(--bt-green)', background: 'rgba(34,197,94,0.1)' }}>
            ✓ Todos concluídos
          </span>
        )}
      </div>

      {/* Generate finals CTA — mobile only */}
      {finalsSeeds && (
        <div className="lg:hidden rounded-2xl overflow-hidden border border-amber-200 shadow-lg shadow-amber-50 animate-scale-in">
          <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-5 py-4 text-white">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Fase de grupos concluída</p>
            <p className="text-lg font-black">Hora das finais! ⚡</p>
          </div>
          <div className="px-5 py-4 space-y-3" style={{ background: 'var(--bt-card)' }}>
            {finalsSeeds.map(s => (
              <div key={s.stage} className="space-y-1.5">
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-wide">
                  {s.stage === 'final' ? '🏆 Grande Final' : '🥉 Final Consolação'}
                </p>
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex-1">
                    <p className="font-bold" style={{ color: 'var(--bt-text)' }}>{name(s.team1_p1)}</p>
                    <p className="font-bold" style={{ color: 'var(--bt-text)' }}>{name(s.team1_p2)}</p>
                  </div>
                  <span className="text-[10px] font-black tracking-widest" style={{ color: 'var(--bt-subtle)' }}>VS</span>
                  <div className="flex-1 text-right">
                    <p className="font-bold" style={{ color: 'var(--bt-text)' }}>{name(s.team2_p1)}</p>
                    <p className="font-bold" style={{ color: 'var(--bt-text)' }}>{name(s.team2_p2)}</p>
                  </div>
                </div>
                {s.stage === 'final' && <div className="h-px" style={{ background: 'var(--bt-border)' }} />}
              </div>
            ))}
          </div>
          <div className="px-4 pb-4" style={{ background: 'var(--bt-card)' }}>
            <GenerateFinalsButton tournamentId={tournament.id} seeds={finalsSeeds} />
          </div>
        </div>
      )}

      {/* Finals */}
      {sortedFinals.length > 0 && (
        <section className="space-y-2">
          <SectionLabel icon="⚡" label="Finais" color="text-amber-500" />
          {/* Mobile: MatchCard */}
          <div className="lg:hidden stagger space-y-2.5">
            {sortedFinals.map(m => (
              <MatchCard key={m.id} m={m} name={name} tournamentId={tournament.id} rules={rules} courts={courts} onScoreChange={onScoreChange} />
            ))}
          </div>
          {/* Desktop: horizontal ControlMatchRow */}
          <div className="hidden lg:flex flex-col gap-1.5">
            {sortedFinals.map(m => (
              <ControlMatchRow key={m.id} m={m} name={name} tournamentId={tournament.id} rules={rules} onScoreChange={onScoreChange} />
            ))}
          </div>
        </section>
      )}

      {/* Group matches */}
      {(['group_a', 'group_b'] as const).map(stage => {
        const ms = sortedGroup.filter(m => m.stage === stage)
        if (!ms.length) return null
        const cfg = stage === 'group_a'
          ? { label: 'Grupo A', icon: '🅰️', color: 'text-sky-400' }
          : { label: 'Grupo B', icon: '🅱️', color: 'text-violet-400' }
        return (
          <section key={stage} className="space-y-2">
            <SectionLabel icon={cfg.icon} label={cfg.label} color={cfg.color} />
            {/* Mobile: MatchCard */}
            <div className="lg:hidden stagger space-y-2.5">
              {ms.map(m => (
                <MatchCard key={m.id} m={m} name={name} tournamentId={tournament.id} rules={rules} courts={courts} onScoreChange={onScoreChange} />
              ))}
            </div>
            {/* Desktop: horizontal ControlMatchRow */}
            <div className="hidden lg:flex flex-col gap-1.5">
              {ms.map(m => (
                <ControlMatchRow key={m.id} m={m} name={name} tournamentId={tournament.id} rules={rules} onScoreChange={onScoreChange} />
              ))}
            </div>
          </section>
        )
      })}

    </div>
  )
}

// ── Ranking tab (mobile) ──────────────────────────────────────

interface RankingTabProps extends HubProps {
  effectiveMatches: Match[]
}

function RankingTab({ players, effectiveMatches }: RankingTabProps) {
  const groupA = players.filter(p => p.position <= 4)
  const groupB = players.filter(p => p.position >= 5)
  const rankA  = computeRanking(groupA, effectiveMatches.filter(m => m.stage === 'group_a'))
  const rankB  = computeRanking(groupB, effectiveMatches.filter(m => m.stage === 'group_b'))

  return (
    <div className="space-y-5 animate-fade-in">
      <GroupRankingSection label="Grupo A" color="#38bdf8" stats={rankA} />
      <GroupRankingSection label="Grupo B" color="#a78bfa" stats={rankB} />

      {rankA.some(s => s.wins + s.losses > 0) && rankB.some(s => s.wins + s.losses > 0) && (
        <section className="space-y-2">
          <SectionLabel icon="⚡" label="Projeção das finais" color="text-amber-500" />
          <div className="rounded-2xl overflow-hidden border" style={{ background: 'var(--bt-card)', borderColor: 'rgba(245,158,11,0.2)' }}>
            {[
              { emoji: '🏆', label: 'Grande Final',     t1: [rankA[0], rankB[0]], t2: [rankA[1], rankB[1]] },
              { emoji: '🥉', label: 'Final Consolação', t1: [rankA[2], rankB[2]], t2: [rankA[3], rankB[3]] },
            ].map(row => (
              <div key={row.label} className="px-4 py-3.5 space-y-2 border-b last:border-0" style={{ borderColor: 'var(--bt-border)' }}>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--bt-muted)' }}>
                  {row.emoji} {row.label}
                </p>
                <div className="flex items-stretch gap-3">
                  <div className="flex-1 space-y-0.5">
                    {row.t1.map((s, i) => (
                      <p key={i} className="text-sm font-bold truncate" style={{ color: 'var(--bt-text)' }}>
                        {s?.player.name ?? '?'}
                      </p>
                    ))}
                  </div>
                  <span className="flex items-center text-[10px] font-black tracking-widest" style={{ color: 'var(--bt-subtle)' }}>VS</span>
                  <div className="flex-1 text-right space-y-0.5">
                    {row.t2.map((s, i) => (
                      <p key={i} className="text-sm font-bold truncate" style={{ color: 'var(--bt-text)' }}>
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

function GroupRankingSection({ label, color, stats }: { label: string; color: string; stats: PlayerStats[] }) {
  const hasData = stats.some(s => s.wins + s.losses > 0)
  const icon    = label.includes('A') ? '🅰️' : '🅱️'

  return (
    <section className="space-y-2.5">
      <SectionLabel icon={icon} label={label} color={label.includes('A') ? 'text-sky-400' : 'text-violet-400'} />
      {hasData && stats.length >= 3 && <RankingPodium stats={stats} color={color} />}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bt-card)', border: '1px solid var(--bt-border)' }}>
        <div className="grid grid-cols-[1.75rem_2.25rem_1fr_auto] gap-3 px-4 py-2.5 border-b" style={{ background: 'var(--bt-elevated)', borderColor: 'var(--bt-border)' }}>
          <span className="text-[10px] font-black" style={{ color: 'var(--bt-subtle)' }}>#</span>
          <span />
          <span className="text-[10px] font-black uppercase" style={{ color: 'var(--bt-subtle)' }}>Jogador</span>
          <span className="text-[10px] font-black text-right" style={{ color: 'var(--bt-subtle)' }}>V · D · Saldo</span>
        </div>
        {!hasData && (
          <p className="text-xs font-medium px-4 py-4" style={{ color: 'var(--bt-subtle)' }}>
            Sem resultados ainda
          </p>
        )}
        <div className="stagger">
          {stats.map((s, i) => (
            <div key={s.player.id}
                 className="grid grid-cols-[1.75rem_2.25rem_1fr_auto] gap-3 items-center px-4 py-3 border-b last:border-0"
                 style={{ borderColor: 'var(--bt-border)', background: i < 2 ? 'rgba(56,189,248,0.04)' : undefined }}>
              <span className="text-sm font-black tabular-nums" style={{ color: 'var(--bt-subtle)' }}>{i + 1}</span>
              <div className="w-9 h-9 rounded-full text-white text-sm font-black flex items-center justify-center"
                   style={{ background: i < 2 ? color : 'var(--bt-elevated)' }}>
                {s.player.name[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--bt-text)' }}>{s.player.name}</p>
                {i < 2 && (
                  <p className="text-[10px] font-bold" style={{ color }}>✓ Classificado</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-black tabular-nums" style={{ color: 'var(--bt-text)' }}>
                  {s.wins}V · {s.losses}D
                </p>
                <p className="text-xs font-bold tabular-nums"
                   style={{ color: s.gameDiff >= 0 ? 'var(--bt-green)' : 'var(--bt-red)' }}>
                  {s.gameDiff > 0 ? '+' : ''}{s.gameDiff}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function RankingPodium({ stats, color }: { stats: PlayerStats[]; color: string }) {
  const [first, second, third] = stats
  const order    = [second, first, third]
  const orderIdx = [1, 0, 2]
  const heights  = ['h-20', 'h-28', 'h-14']
  const medals   = ['🥈', '🥇', '🥉']
  const colors     = ['#C0C0C0', color, '#cd7c3a80']
  // Silver and gold slots are bright/light backgrounds — white text on them
  // is illegible, so they need dark text; bronze stays light-on-dark.
  const textColors = ['#0A0A0A', '#0A0A0A', '#F0F0F0']

  return (
    <div className="flex items-end justify-center gap-3 pt-2 pb-1">
      {order.map((s, col) => {
        if (!s) return <div key={col} className="w-20" />
        const rank = orderIdx[col]
        return (
          <div key={s.player.id} className="flex flex-col items-center gap-1 w-20">
            <span className="text-xl leading-none">{medals[col]}</span>
            <div className="w-9 h-9 rounded-full font-black text-xs flex items-center justify-center"
                 style={{ background: colors[col], color: textColors[col] }}>
              {s.player.name[0]?.toUpperCase()}
            </div>
            <p className="text-[11px] font-bold text-center truncate w-full px-1" style={{ color: 'var(--bt-muted)' }}>
              {s.player.name}
            </p>
            <p className="text-[10px] font-bold" style={{ color: 'var(--bt-subtle)' }}>
              {s.wins}V {s.gameDiff > 0 ? '+' : ''}{s.gameDiff}
            </p>
            <div className={`w-full rounded-t-lg ${heights[col]} flex items-center justify-center`}
                 style={{ background: colors[col] }}>
              <span className="font-black text-base" style={{ color: textColors[col] }}>{rank + 1}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Bracket tab ───────────────────────────────────────────────

function BracketTab({ players, matches, finalsMatches, compact }: HubProps & { finalsMatches: Match[]; compact?: boolean }) {
  const playerMap        = Object.fromEntries(players.map(p => [p.id, p]))
  const name             = (id: string) => playerMap[id]?.name ?? '?'
  const finalMatch       = finalsMatches.find(m => m.stage === 'final')
  const consolationMatch = finalsMatches.find(m => m.stage === 'consolation_final')

  if (!finalMatch && !consolationMatch) {
    if (compact) return null
    return (
      <div className="animate-fade-in space-y-4">
        <div className="rounded-2xl border px-5 py-8 text-center space-y-2"
             style={{ background: 'var(--bt-card)', borderColor: 'var(--bt-border)' }}>
          <p className="text-3xl">⚡</p>
          <p className="font-bold" style={{ color: 'var(--bt-text)' }}>Finais ainda não geradas</p>
          <p className="text-sm" style={{ color: 'var(--bt-muted)' }}>Complete a fase de grupos para desbloquear as chaves</p>
        </div>
        <GroupBracket matches={matches} players={players} />
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {[finalMatch, consolationMatch].map(m => {
        if (!m) return null
        const isFinal = m.stage === 'final'
        const isDone  = m.status === 'done'
        const t1Wins  = isDone && (m.score1 ?? 0) > (m.score2 ?? 0)
        const t2Wins  = isDone && (m.score2 ?? 0) > (m.score1 ?? 0)

        return (
          <div key={m.id} className="rounded-2xl overflow-hidden"
               style={{ border: `1px solid ${isFinal ? 'rgba(251,191,36,0.3)' : 'var(--bt-border)'}` }}>
            <div className={`px-4 py-2.5 flex items-center justify-between ${
              isFinal ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20' : ''
            }`} style={!isFinal ? { background: 'var(--bt-elevated)' } : {}}>
              <span className="text-xs font-black uppercase tracking-widest"
                    style={{ color: isFinal ? '#fbbf24' : 'var(--bt-muted)' }}>
                {isFinal ? '🏆 Grande Final' : '🥉 Final Consolação'}
              </span>
              {isDone && (
                <span className="text-[10px] font-black uppercase" style={{ color: 'var(--bt-green)' }}>
                  ✓ Concluído
                </span>
              )}
            </div>
            <div className="px-5 py-5 grid grid-cols-[1fr_auto_1fr] gap-3 items-center"
                 style={{ background: 'var(--bt-card)' }}>
              <div className={`space-y-0.5 ${t1Wins ? '' : isDone ? 'opacity-40' : ''}`}>
                {[m.team1_p1, m.team1_p2].map((pid, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full text-white text-[10px] font-black flex items-center justify-center shrink-0"
                         style={{ background: t1Wins ? 'var(--bt-green)' : isFinal ? '#f59e0b80' : 'var(--bt-elevated)' }}>
                      {name(pid)[0]?.toUpperCase()}
                    </div>
                    <p className="text-sm font-bold truncate"
                       style={{ color: t1Wins ? 'var(--bt-green)' : 'var(--bt-text)' }}>
                      {name(pid)}
                    </p>
                  </div>
                ))}
                {isDone && (
                  <p className="text-3xl font-black tabular-nums pt-1"
                     style={{ color: t1Wins ? 'var(--bt-green)' : 'var(--bt-subtle)' }}>
                    {m.score1}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-black tracking-widest" style={{ color: 'var(--bt-subtle)' }}>VS</span>
              </div>
              <div className={`space-y-0.5 text-right ${t2Wins ? '' : isDone ? 'opacity-40' : ''}`}>
                {[m.team2_p1, m.team2_p2].map((pid, i) => (
                  <div key={i} className="flex items-center gap-2 flex-row-reverse">
                    <div className="w-7 h-7 rounded-full text-white text-[10px] font-black flex items-center justify-center shrink-0"
                         style={{ background: t2Wins ? 'var(--bt-green)' : isFinal ? '#f59e0b80' : 'var(--bt-elevated)' }}>
                      {name(pid)[0]?.toUpperCase()}
                    </div>
                    <p className="text-sm font-bold truncate"
                       style={{ color: t2Wins ? 'var(--bt-green)' : 'var(--bt-text)' }}>
                      {name(pid)}
                    </p>
                  </div>
                ))}
                {isDone && (
                  <p className="text-3xl font-black tabular-nums pt-1 text-right"
                     style={{ color: t2Wins ? 'var(--bt-green)' : 'var(--bt-subtle)' }}>
                    {m.score2}
                  </p>
                )}
              </div>
            </div>
            {!isDone && (
              <div className="px-4 py-2 border-t text-center text-[11px] font-bold"
                   style={{
                     borderColor: 'var(--bt-border)',
                     color: isFinal ? '#f59e0b' : 'var(--bt-subtle)',
                     background: 'var(--bt-elevated)',
                   }}>
                A disputar
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function GroupBracket({ matches, players }: { matches: Match[]; players: Player[] }) {
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]))
  const name      = (id: string) => playerMap[id]?.name ?? '?'
  const groups: { label: string; stage: 'group_a' | 'group_b'; color: string }[] = [
    { label: 'Grupo A', stage: 'group_a', color: '#38bdf8' },
    { label: 'Grupo B', stage: 'group_b', color: '#a78bfa' },
  ]

  return (
    <div className="space-y-3">
      {groups.map(g => {
        const ms = matches.filter(m => m.stage === g.stage).sort((a, b) => a.round - b.round)
        if (!ms.length) return null
        return (
          <div key={g.stage} className="rounded-2xl overflow-hidden" style={{ background: 'var(--bt-card)', border: '1px solid var(--bt-border)' }}>
            <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ background: 'var(--bt-elevated)', borderColor: 'var(--bt-border)' }}>
              <span className="w-5 h-5 rounded text-[10px] font-black flex items-center justify-center" style={{ background: g.color, color: '#0A0A0A' }}>
                {g.label.slice(-1)}
              </span>
              <span className="text-xs font-black uppercase tracking-wide" style={{ color: 'var(--bt-muted)' }}>
                {g.label}
              </span>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--bt-border)' }}>
              {ms.map(m => {
                const done   = m.status === 'done'
                const t1Wins = done && (m.score1 ?? 0) > (m.score2 ?? 0)
                const t2Wins = done && (m.score2 ?? 0) > (m.score1 ?? 0)
                return (
                  <div key={m.id} className="px-4 py-3 flex items-center gap-3">
                    <span className="text-[10px] font-black w-4" style={{ color: 'var(--bt-subtle)' }}>
                      R{m.round}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate"
                         style={{ color: t1Wins ? 'var(--bt-green)' : 'var(--bt-text)' }}>
                        {name(m.team1_p1)} + {name(m.team1_p2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {done ? (
                        <>
                          <span className="text-sm font-black tabular-nums"
                                style={{ color: t1Wins ? 'var(--bt-green)' : 'var(--bt-subtle)' }}>{m.score1}</span>
                          <span className="text-[10px] font-bold" style={{ color: 'var(--bt-subtle)' }}>×</span>
                          <span className="text-sm font-black tabular-nums"
                                style={{ color: t2Wins ? 'var(--bt-green)' : 'var(--bt-subtle)' }}>{m.score2}</span>
                        </>
                      ) : (
                        <span className="text-[10px] font-bold" style={{ color: 'var(--bt-subtle)' }}>—</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <p className="text-xs font-bold truncate"
                         style={{ color: t2Wins ? 'var(--bt-green)' : 'var(--bt-text)' }}>
                        {name(m.team2_p1)} + {name(m.team2_p2)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Info tab (mobile only) ────────────────────────────────────

function InfoTab({ tournament, players, rules, finalsSeeds, matchSeeds }: HubProps) {
  const groupA   = players.filter(p => p.position <= 4)
  const groupB   = players.filter(p => p.position >= 5)
  const canStart = tournament.status === 'draft' && players.length === 8

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="rounded-2xl border px-4 py-4 space-y-2" style={{ background: 'var(--bt-card)', borderColor: 'var(--bt-border)' }}>
        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--bt-subtle)' }}>Regras</p>
        <p className="text-sm font-bold" style={{ color: 'var(--bt-text)' }}>{rulesHint(rules)}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Grupo A', list: groupA, color: '#38bdf8' },
          { label: 'Grupo B', list: groupB, color: '#a78bfa' },
        ].map(g => (
          <div key={g.label} className="rounded-2xl p-3 border space-y-2" style={{ background: 'var(--bt-card)', borderColor: 'var(--bt-border)' }}>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded text-[10px] font-black flex items-center justify-center" style={{ background: g.color, color: '#0A0A0A' }}>
                {g.label.slice(-1)}
              </span>
              <span className="text-xs font-bold" style={{ color: 'var(--bt-muted)' }}>{g.label}</span>
            </div>
            <div className="space-y-1.5">
              {g.list.map(p => (
                <div key={p.id} className="flex items-center gap-2 rounded-xl px-2.5 py-1.5" style={{ background: 'var(--bt-elevated)' }}>
                  <div className="w-6 h-6 rounded-full text-white text-[10px] font-black flex items-center justify-center shrink-0"
                       style={{ background: g.color }}>
                    {p.name[0]?.toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold truncate" style={{ color: 'var(--bt-text)' }}>{p.name}</span>
                </div>
              ))}
              {g.list.length === 0 && (
                <p className="text-xs px-1" style={{ color: 'var(--bt-subtle)' }}>Sem jogadores</p>
              )}
            </div>
          </div>
        ))}
      </div>
      {canStart && (
        <div className="space-y-2.5">
          <ShuffleGroupsButton tournamentId={tournament.id} players={players} />
          <StartGroupStageButton tournamentId={tournament.id} players={players} matchSeeds={matchSeeds} />
        </div>
      )}
      {finalsSeeds && (
        <GenerateFinalsButton tournamentId={tournament.id} seeds={finalsSeeds} />
      )}
    </div>
  )
}

// ── Shared primitives ─────────────────────────────────────────

function ProgressPill({ label, color, done }: { label: string; color: 'sky' | 'amber'; done: boolean }) {
  if (done) return (
    <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
          style={{ color: 'var(--bt-green)', background: 'rgba(34,197,94,0.1)' }}>
      ✓ {label}
    </span>
  )
  const style = color === 'amber'
    ? { color: '#f59e0b', background: 'rgba(245,158,11,0.1)' }
    : { color: '#38bdf8', background: 'rgba(56,189,248,0.1)' }
  return <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={style}>{label}</span>
}

function SectionLabel({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 px-0.5">
      <span className="text-base leading-none">{icon}</span>
      <span className={`text-xs font-black uppercase tracking-widest ${color}`}>{label}</span>
    </div>
  )
}
