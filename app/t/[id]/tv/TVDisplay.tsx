'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/client'
import type { Tournament, Player, Match, MatchRules, PlayerStats, TVContent, Court, Category } from '@/types'
import ContentRotator from './ContentRotator'

// ── Exported types (used by page.tsx) ────────────────────────

export interface CourtSchedule {
  court:   Court
  current: Match | null
  next:    Match | null
  /** Depth 2-4 for this specific court — court-assignment.ts pins every
   *  pending match to a court up front, so this is real backlog for THIS
   *  court, distinct from "next" (depth 1, about to be called). */
  queue:   Match[]
}

/** One ranking panel per broadcast category — 'gender' = Rei/Rainha da
 *  Quadra (Super Oito Misto), 'groups' = Grupo A/B (standard formats). */
export interface RankingPanelData {
  categoryId:    string
  categoryName:  string
  kind:          'gender' | 'groups'
  kingRanking?:  PlayerStats[]
  queenRanking?: PlayerStats[]
  rankingA?:     PlayerStats[]
  rankingB?:     PlayerStats[]
  /** false from round 5 onward for Super Oito Misto — keeps the finish a surprise. */
  showRanking:   boolean
}

/** Painel Geral — progress bars, one per broadcast category. */
export interface CategoryProgress {
  categoryId:    string
  categoryName:  string
  totalMatches:  number
  doneMatches:   number
}

/** Painel Geral ticker — "confronto imperdível" block. 'topClash' never
 *  names the players (no rank disclosure); 'nextMatch' is the neutral
 *  fallback used when no upcoming match actually pits the two current
 *  leaders against each other. */
export type HighlightData =
  | { kind: 'topClash';  categoryName: string; courtName: string | null }
  | { kind: 'nextMatch'; categoryName: string; courtName: string | null; team1: string; team2: string }

/** Painel Geral ticker — collective, never-per-person counter. */
export interface CollectiveStats {
  totalGames:           number
  totalDurationSeconds: number | null
}

/** Painel Geral — every category (not just broadcast ones). */
export interface AgendaCategory {
  id:          string
  name:        string
  status:      string
  scheduledAt: string | null
}

/** Mural screen — approved photos only, oldest first (so the collage
 *  fills in chronological order and new approvals land on the last frame). */
export interface MuralPhoto {
  id:  string
  url: string
}

/** Painel Geral — bottom stat-card row. Streak numbers are always
 *  anonymous (no player name) so the leaderboard stays a surprise. */
export interface DashboardStats {
  totalGames:       number
  /** null when no Super Oito Misto category is currently broadcasting. */
  pairsFormed:      number | null
  maxWinStreak:     number
  maxGamesUnbeaten: number
}

/** Jogos — one block per broadcast category: just its own live courts, so
 *  multi-category tournaments read clearly instead of one pooled grid.
 *  Each court's own backlog rides along on its CourtSchedule.queue. */
export interface CategoryJogosBlock {
  categoryId:   string
  categoryName: string
  liveCourts:   CourtSchedule[]
}

// ── Props ─────────────────────────────────────────────────────

interface Props {
  tournament:     Tournament
  players:        Player[]
  currentMatch:   Match | null
  nextMatches:    Match[]
  recentResults:  Match[]
  rankingPanels:  RankingPanelData[]
  defaultRules:   MatchRules
  contentItems:   TVContent[]
  courts?:        Court[]
  courtSchedules?: CourtSchedule[]
  categories?:    Pick<Category, 'id' | 'name' | 'scheduled_at' | 'format' | 'max_games'>[]
  /** Tournament has at least one Super Oito Misto category — offers the ceremony link when idle. */
  hasSuper8MistoCategory?: boolean
  progressData:      CategoryProgress[]
  collectiveStats:   CollectiveStats
  highlight:         HighlightData | null
  hypeMessages:      string[]
  agendaCategories:  AgendaCategory[]
  muralPhotos:       MuralPhoto[]
  dashboardStats:    DashboardStats
  jogosBlocks:       CategoryJogosBlock[]
}

// ── Per-category lookup info ─────────────────────────────────

interface CategoryInfo {
  name:          string
  scheduledAt:   string | null
  isSuper8Misto: boolean
  maxGames:      number
}

// ── Constants ─────────────────────────────────────────────────

const STAGE_LABEL: Record<string, string> = {
  group_a:           'Grupo A',
  group_b:           'Grupo B',
  final:             'Grande Final',
  consolation_final: 'Final Consolação',
}

const STAGE_ACCENT: Record<string, string> = {
  final:             'text-amber-400',
  consolation_final: 'text-orange-400',
  group_a:           'text-sky-400',
  group_b:           'text-violet-400',
}

const ROTATE_MS        = 7000
const FADE_MS          = 380
const TICKER_ROTATE_MS = 6000
const MURAL_ROTATE_MS  = 10000

function isTiebreakResult(m: Match, maxGames: number) {
  return m.score1 === maxGames + 1 || m.score2 === maxGames + 1
}

/** Super Oito Misto has no groups — every match is just "Rodada N". */
function matchLabel(m: Match, isSuper8Misto?: boolean): string {
  if (isSuper8Misto && !m.stage.includes('final')) return `Rodada ${m.round}`
  return STAGE_LABEL[m.stage] ?? m.stage
}

// ── Clock ─────────────────────────────────────────────────────

function Clock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="tabular-nums">{time}</span>
}

// ── TeamBlock (legacy hero) ───────────────────────────────────

function TeamBlock({ p1, p2, isWinner, align }: {
  p1: string; p2: string; isWinner: boolean | null; align: 'left' | 'right'
}) {
  const muted = isWinner === false
  return (
    <div className={`flex flex-col gap-3 ${align === 'right' ? 'items-end text-right' : 'items-start text-left'} ${muted ? 'opacity-30' : ''}`}>
      {[p1, p2].map((n, i) => (
        <div key={i} className={`flex items-center gap-3 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
          <div className={`w-10 h-10 rounded-full text-sm font-black flex items-center justify-center shrink-0 ${
            isWinner    ? 'bg-emerald-500 text-white' :
            align === 'left' ? 'bg-sky-500/30 text-sky-300' : 'bg-violet-500/30 text-violet-300'
          }`}>
            {n[0]?.toUpperCase() ?? '?'}
          </div>
          <span className={`text-2xl font-black truncate max-w-[180px] ${isWinner ? 'text-white' : 'text-white/80'}`}>{n}</span>
        </div>
      ))}
    </div>
  )
}

// ── CurrentMatchCard (legacy hero) ───────────────────────────

function CurrentMatchCard({ m, name, maxGames, courtName, categoryName, isSuper8Misto }: {
  m: Match; name: (id: string) => string; maxGames: number; courtName?: string; categoryName?: string; isSuper8Misto?: boolean
}) {
  const isDone  = m.status === 'done'
  const isFinal = m.stage === 'final'
  const t1Wins  = isDone && (m.score1 ?? 0) > (m.score2 ?? 0)
  const t2Wins  = isDone && (m.score2 ?? 0) > (m.score1 ?? 0)
  const wasTb   = isDone && isTiebreakResult(m, maxGames)
  const accent  = isSuper8Misto ? 'text-[#C8F135]' : (STAGE_ACCENT[m.stage] ?? 'text-white')

  return (
    <div className={`rounded-3xl overflow-hidden border ${
      isFinal ? 'border-amber-500/30 shadow-[0_0_60px_rgba(251,191,36,0.12)]' : 'border-white/8'
    } bg-white/4`}>
      <div className={`px-8 py-4 flex items-center justify-between border-b border-white/6 ${isFinal ? 'bg-gradient-to-r from-amber-500/10 to-orange-500/10' : ''}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{isFinal ? '🏆' : m.stage === 'consolation_final' ? '🥉' : '🏸'}</span>
          <span className={`text-sm font-black uppercase tracking-[0.2em] ${accent}`}>
            {isSuper8Misto ? matchLabel(m, true) : `${STAGE_LABEL[m.stage] ?? m.stage} ${!isFinal && !isDone ? `· Rodada ${m.round}` : ''}`}
          </span>
          {categoryName && (
            <span className="text-xs font-bold text-white/40 bg-white/8 px-3 py-1 rounded-full">{categoryName}</span>
          )}
          {courtName && (
            <span className="text-xs font-bold text-white/40 bg-white/8 px-3 py-1 rounded-full">📍 {courtName}</span>
          )}
        </div>
        <span className={`text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${
          isDone ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/8 text-white/40'
        }`}>
          {isDone ? '✓ Concluído' : 'Ao Vivo'}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-8 py-10">
        <TeamBlock p1={name(m.team1_p1)} p2={name(m.team1_p2)} isWinner={isDone ? t1Wins : null} align="left" />
        <div className="flex flex-col items-center gap-2 px-6">
          {isDone ? (
            <>
              <div className="flex items-center gap-5">
                <span className={`text-8xl font-black tabular-nums leading-none ${t1Wins ? 'text-white' : 'text-white/60'}`}>{m.score1}</span>
                <span className="text-4xl font-black text-white/15">×</span>
                <span className={`text-8xl font-black tabular-nums leading-none ${t2Wins ? 'text-white' : 'text-white/60'}`}>{m.score2}</span>
              </div>
              {wasTb && <span className="text-xs font-black uppercase tracking-[0.2em] text-amber-400/60">Via Tie-Break</span>}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="text-6xl font-black text-white/15 tracking-widest">VS</span>
              <span className="text-xs font-black uppercase tracking-widest text-white/25">A disputar</span>
            </div>
          )}
        </div>
        <TeamBlock p1={name(m.team2_p1)} p2={name(m.team2_p2)} isWinner={isDone ? t2Wins : null} align="right" />
      </div>
    </div>
  )
}

// ── MatchRow (legacy next/done rows) ─────────────────────────

function MatchRow({ m, name, maxGames, variant, courtName, categoryName, isSuper8Misto }: {
  m: Match; name: (id: string) => string; maxGames: number; variant: 'next' | 'done'; courtName?: string; categoryName?: string; isSuper8Misto?: boolean
}) {
  const isDone = variant === 'done'
  const t1Wins = isDone && (m.score1 ?? 0) > (m.score2 ?? 0)
  const t2Wins = isDone && (m.score2 ?? 0) > (m.score1 ?? 0)
  const wasTb  = isDone && isTiebreakResult(m, maxGames)
  const accent = isSuper8Misto ? 'text-[#C8F135]' : (STAGE_ACCENT[m.stage] ?? 'text-white/40')

  return (
    <div className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-white/4 border border-white/6">
      <div className="w-32 shrink-0">
        {isSuper8Misto ? (
          <p className={`text-[10px] font-black uppercase tracking-widest ${accent}`}>Rodada {m.round}</p>
        ) : (
          <>
            <p className={`text-[10px] font-black uppercase tracking-widest ${accent}`}>{STAGE_LABEL[m.stage]}</p>
            {!m.stage.includes('final') && <p className="text-[10px] text-white/25 font-bold">Rodada {m.round}</p>}
          </>
        )}
        {categoryName && <p className="text-[10px] text-white/30 font-bold truncate">{categoryName}</p>}
        {courtName && <p className="text-[10px] text-white/30 font-bold truncate">📍 {courtName}</p>}
      </div>
      <div className={`flex-1 min-w-0 ${isDone && !t1Wins ? 'opacity-40' : ''}`}>
        <p className="text-base font-bold text-white truncate">{name(m.team1_p1)} + {name(m.team1_p2)}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0 min-w-[80px] justify-center">
        {isDone ? (
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-black tabular-nums ${t1Wins ? 'text-white' : 'text-white/60'}`}>{m.score1}</span>
              <span className="text-sm text-white/20 font-bold">×</span>
              <span className={`text-2xl font-black tabular-nums ${t2Wins ? 'text-white' : 'text-white/60'}`}>{m.score2}</span>
            </div>
            {wasTb && <span className="text-[9px] font-black text-amber-400/50 uppercase tracking-widest">TB</span>}
          </div>
        ) : (
          <span className="text-sm font-black text-white/20 tracking-widest">VS</span>
        )}
      </div>
      <div className={`flex-1 min-w-0 text-right ${isDone && !t2Wins ? 'opacity-40' : ''}`}>
        <p className="text-base font-bold text-white truncate">{name(m.team2_p1)} + {name(m.team2_p2)}</p>
      </div>
    </div>
  )
}

// ── Ranking — flattened sub-panels (one gender / one group at a time,
// each a FULL page sized to guarantee 8 rows always fit — no scroll) ──

interface SubPanel {
  key:              string
  categoryName:     string
  title:            string
  icon?:            string
  stats:            PlayerStats[]
  accent:           string
  color:            string
  textColor?:       string
  isGenderKind:     boolean
}

function flattenSubPanels(panels: RankingPanelData[]): SubPanel[] {
  const out: SubPanel[] = []
  for (const p of panels) {
    if (p.kind === 'gender') {
      out.push({ key: `${p.categoryId}-king`,  categoryName: p.categoryName, title: 'Rei da Quadra',    icon: '👑', stats: p.kingRanking  ?? [], accent: 'text-[#C8F135]', color: 'bg-[#C8F135]', textColor: '#0A0A0A', isGenderKind: true })
      out.push({ key: `${p.categoryId}-queen`, categoryName: p.categoryName, title: 'Rainha da Quadra', icon: '👑', stats: p.queenRanking ?? [], accent: 'text-pink-400',   color: 'bg-pink-500',  textColor: '#0A0A0A', isGenderKind: true })
    } else {
      out.push({ key: `${p.categoryId}-a`, categoryName: p.categoryName, title: 'Grupo A', stats: p.rankingA ?? [], accent: 'text-sky-400',    color: 'bg-sky-500',    isGenderKind: false })
      out.push({ key: `${p.categoryId}-b`, categoryName: p.categoryName, title: 'Grupo B', stats: p.rankingB ?? [], accent: 'text-violet-400', color: 'bg-violet-500', isGenderKind: false })
    }
  }
  return out
}

function FullRankingPage({ panel }: { panel: SubPanel }) {
  const hasData = panel.stats.some(s => s.wins + s.losses > 0)
  const leader  = panel.stats[0]

  return (
    <div className="flex flex-col h-full gap-3 min-h-0">
      <div className="flex items-center gap-2 shrink-0">
        {panel.icon && <span className={`text-sm ${panel.accent}`}>{panel.icon}</span>}
        <span className={`text-xs font-black uppercase tracking-widest ${panel.accent}`}>{panel.title}</span>
      </div>

      {panel.isGenderKind && hasData && leader && (
        <div className={`rounded-2xl px-5 py-3 ${panel.color} flex items-center gap-3 shrink-0`}>
          <span className="text-2xl leading-none">{panel.icon}</span>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: panel.textColor, opacity: 0.7 }}>Líder</p>
            <p className="text-lg font-black truncate" style={{ color: panel.textColor }}>{leader.player.name}</p>
            <p className="text-[11px] font-bold" style={{ color: panel.textColor, opacity: 0.8 }}>
              {leader.wins}V · {leader.losses}D · saldo {leader.gameDiff > 0 ? '+' : ''}{leader.gameDiff}
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 rounded-2xl overflow-hidden border border-white/6 bg-white/3 flex flex-col">
        {!hasData && <p className="text-sm text-white/20 font-medium px-5 py-4">Sem resultados ainda</p>}
        {hasData && panel.stats.map((s, i) => {
          const qualified = !panel.isGenderKind && i < 2
          const isLeader  = panel.isGenderKind && i === 0
          return (
            <div key={s.player.id} className={`flex-1 min-h-0 flex items-center gap-3 px-5 border-b border-white/4 last:border-0 overflow-hidden ${isLeader || qualified ? 'bg-white/3' : ''}`}>
              <span className="text-sm font-black text-white/60 tabular-nums w-5 shrink-0">{i + 1}</span>
              <div
                className={`w-8 h-8 rounded-full text-sm font-black flex items-center justify-center shrink-0 text-white ${
                  isLeader ? panel.color : qualified ? panel.color : 'bg-white/10'
                }`}
                style={isLeader ? { color: panel.textColor } : undefined}
              >
                {s.player.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white/90 truncate">{s.player.name}</p>
                {qualified && hasData && (
                  <p className="text-[9px] font-bold text-emerald-400/70 uppercase tracking-wide">Classificado</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-black text-white/60 tabular-nums">{s.wins}V · {s.losses}D</p>
                <p className={`text-[10px] font-bold tabular-nums ${s.gameDiff >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                  {s.gameDiff > 0 ? '+' : ''}{s.gameDiff}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Alternates full-page ranking views (one gender / one group at a time) so
 *  8 rows always fit without a scrollbar — never stacks two full lists. */
function SubPanelRotator({ panels }: { panels: SubPanel[] }) {
  const [idx,     setIdx]     = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (panels.length <= 1) return
    const id = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx(prev => (prev + 1) % panels.length)
        setVisible(true)
      }, FADE_MS)
    }, ROTATE_MS)
    return () => clearInterval(id)
  }, [panels.length])

  const safeIdx = Math.min(idx, panels.length - 1)
  const panel   = panels[safeIdx]
  if (!panel) return null

  const multiCategory = new Set(panels.map(p => p.categoryName)).size > 1

  return (
    <div className="flex flex-col h-full gap-4 min-h-0">
      <div className="flex items-center justify-between shrink-0">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/25">
          Ranking ao Vivo{multiCategory ? ` · ${panel.categoryName}` : ''}
        </p>
        {panels.length > 1 && (
          <span className="text-[10px] font-bold text-white/20 tabular-nums uppercase tracking-wider shrink-0">
            {safeIdx + 1} / {panels.length}
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0" style={{ opacity: visible ? 1 : 0, transition: `opacity ${FADE_MS}ms ease` }}>
        <FullRankingPage panel={panel} />
      </div>
    </div>
  )
}

// ── Jogos — every court visible at once (grid); paginates only when
// there are too many courts to stay legible on one screen ───────────

function CourtGridMatchRow({ m, name, emphasized, large }: {
  m: Match; name: (id: string) => string; emphasized?: boolean; large?: boolean
}) {
  const isDone = m.status === 'done'
  const t1Wins = isDone && (m.score1 ?? 0) > (m.score2 ?? 0)
  const t2Wins = isDone && (m.score2 ?? 0) > (m.score1 ?? 0)
  const nameSize  = large ? (emphasized ? 'text-xl' : 'text-lg') : (emphasized ? 'text-base' : 'text-sm')
  const scoreSize = large ? (emphasized ? 'text-3xl' : 'text-xl') : (emphasized ? 'text-xl' : 'text-base')
  const vsSize    = large ? (emphasized ? 'text-2xl' : 'text-lg') : (emphasized ? 'text-base' : 'text-xs')
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className={`font-bold truncate ${nameSize} ${emphasized ? 'text-white' : 'text-white/70'} ${isDone && !t1Wins ? 'opacity-40' : ''}`}>
          {name(m.team1_p1)} · {name(m.team1_p2)}
        </p>
      </div>
      <div className="shrink-0 text-center px-1">
        {isDone ? (
          <span className={`font-black tabular-nums text-white/70 ${scoreSize}`}>{m.score1}×{m.score2}</span>
        ) : (
          <span className={`font-black text-white/15 tracking-widest ${vsSize}`}>VS</span>
        )}
      </div>
      <div className="flex-1 min-w-0 text-right">
        <p className={`font-bold truncate ${nameSize} ${emphasized ? 'text-white' : 'text-white/70'} ${isDone && !t2Wins ? 'opacity-40' : ''}`}>
          {name(m.team2_p1)} · {name(m.team2_p2)}
        </p>
      </div>
    </div>
  )
}

/** A "Depois, nesta quadra" slot — always rendered, even when there's no
 *  match queued that deep yet, so every card in a row reserves the exact
 *  same height (side-by-side cards can't be different sizes). */
function QueueSlotRow({ m, name, large }: { m: Match | null; name: (id: string) => string; large?: boolean }) {
  if (!m) {
    return <div className={`font-bold text-white/10 ${large ? 'text-sm' : 'text-xs'}`}>—</div>
  }
  return (
    <div className="flex items-center gap-2">
      <span className={`flex-1 min-w-0 truncate font-bold text-white/45 ${large ? 'text-sm' : 'text-xs'}`}>
        {name(m.team1_p1)} · {name(m.team1_p2)}
      </span>
      <span className={`shrink-0 font-black text-white/15 ${large ? 'text-xs' : 'text-[10px]'}`}>vs</span>
      <span className={`flex-1 min-w-0 truncate text-right font-bold text-white/45 ${large ? 'text-sm' : 'text-xs'}`}>
        {name(m.team2_p1)} · {name(m.team2_p2)}
      </span>
    </div>
  )
}

/** Every court card follows the exact same 4-slot structure — em andamento,
 *  próxima, e 2 no "depois" — with placeholders for whatever's missing.
 *  Cards sit side-by-side in a row, so they can never be different sizes
 *  depending on how deep that specific court's backlog happens to be.
 *  `current` is guaranteed non-null here — courts with no current match are
 *  filtered out of courtSchedules entirely before this ever renders. */
function CourtGridCard({ schedule, name, categoryMap, large }: {
  schedule: CourtSchedule; name: (id: string) => string; categoryMap: Record<string, CategoryInfo>; large?: boolean
}) {
  const { court, current, next, queue } = schedule
  const infoFor = (m: Match | null) => m?.category_id ? (categoryMap[m.category_id] ?? null) : null
  const curInfo  = infoFor(current)

  return (
    <div className={`rounded-2xl border border-white/8 bg-white/[0.03] flex flex-col gap-4 min-w-0 ${large ? 'p-7' : 'p-5'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`${large ? 'text-2xl' : 'text-lg'} shrink-0`}>🏟️</span>
          <p className={`${large ? 'text-2xl' : 'text-lg'} font-black text-white truncate`}>{court.name}</p>
          {curInfo && (
            <span className="text-[9px] font-bold text-white/30 bg-white/6 px-2 py-0.5 rounded-full shrink-0 truncate max-w-[100px]">
              {curInfo.name}
            </span>
          )}
        </div>
        {current ? (
          <span className={`flex items-center gap-1.5 font-black uppercase tracking-widest text-red-400 shrink-0 ${large ? 'text-xs' : 'text-[10px]'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> Ao vivo
          </span>
        ) : (
          <span className={`font-black uppercase tracking-widest text-white/20 shrink-0 ${large ? 'text-xs' : 'text-[10px]'}`}>Livre</span>
        )}
      </div>

      {current ? (
        <div className="space-y-2">
          {/* Always reserve this line's height — whether or not the match
              has a recorded start time — so cards never differ in height
              depending on which matches happened to have their timer started. */}
          <p className={`font-bold text-white/30 uppercase tracking-wide ${large ? 'text-xs' : 'text-[10px]'}`}>
            {current.started_at
              ? `Início ${new Date(current.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
              : '—'}
          </p>
          <CourtGridMatchRow m={current} name={name} emphasized large={large} />
        </div>
      ) : (
        <p className={`text-white/15 font-bold uppercase tracking-widest py-2 ${large ? 'text-sm' : 'text-xs'}`}>Sem partida em andamento</p>
      )}

      <div className="pt-3 border-t border-white/6 space-y-1.5">
        <p className={`font-black uppercase tracking-widest text-white/25 ${large ? 'text-[10px]' : 'text-[9px]'}`}>Próxima</p>
        {next ? (
          <CourtGridMatchRow m={next} name={name} large={large} />
        ) : (
          <p className={`font-bold text-white/10 ${large ? 'text-sm' : 'text-xs'}`}>—</p>
        )}
      </div>

      <div className="pt-3 border-t border-white/6 space-y-1.5">
        <p className={`font-black uppercase tracking-widest text-white/20 ${large ? 'text-[10px]' : 'text-[9px]'}`}>Depois, nesta quadra</p>
        <div className="space-y-1">
          <QueueSlotRow m={queue[0] ?? null} name={name} large={large} />
          <QueueSlotRow m={queue[1] ?? null} name={name} large={large} />
        </div>
      </div>
    </div>
  )
}

const JOGOS_PAGE_SIZE = 4

function jogosGridColsClass(n: number): string {
  if (n <= 1) return 'grid-cols-1'
  if (n === 2) return 'grid-cols-1 sm:grid-cols-2'
  if (n <= 4) return 'grid-cols-2'
  if (n <= 6) return 'grid-cols-2 lg:grid-cols-3'
  return 'grid-cols-2 lg:grid-cols-4'
}

function JogosGrid({ schedules, name, categoryMap, large }: {
  schedules: CourtSchedule[]; name: (id: string) => string; categoryMap: Record<string, CategoryInfo>; large?: boolean
}) {
  const pages = useMemo(() => {
    if (schedules.length <= JOGOS_PAGE_SIZE) return [schedules]
    const chunks: CourtSchedule[][] = []
    for (let i = 0; i < schedules.length; i += JOGOS_PAGE_SIZE) chunks.push(schedules.slice(i, i + JOGOS_PAGE_SIZE))
    return chunks
  }, [schedules])

  const [pageIdx, setPageIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (pages.length <= 1) return
    const id = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setPageIdx(p => (p + 1) % pages.length)
        setVisible(true)
      }, FADE_MS)
    }, ROTATE_MS)
    return () => clearInterval(id)
  }, [pages.length])

  const safeIdx = Math.min(pageIdx, pages.length - 1)
  const page    = pages[safeIdx] ?? []

  return (
    <div className="flex flex-col gap-4 h-full">
      {pages.length > 1 && (
        <div className="flex items-center gap-2 shrink-0">
          {pages.map((_, i) => (
            <span
              key={i}
              style={{
                width:           i === safeIdx ? 28 : 8,
                height:          8,
                borderRadius:    4,
                backgroundColor: i === safeIdx ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.12)',
                transition:      'all 400ms ease',
              }}
            />
          ))}
          <span className="ml-1 text-[10px] font-bold text-white/20 tabular-nums uppercase tracking-wider">
            {safeIdx + 1} / {pages.length}
          </span>
        </div>
      )}
      <div
        className={`grid gap-4 ${jogosGridColsClass(page.length)}`}
        style={{ opacity: visible ? 1 : 0, transition: `opacity ${FADE_MS}ms ease` }}
      >
        {page.map(s => (
          <CourtGridCard key={s.court.id} schedule={s} name={name} categoryMap={categoryMap} large={large} />
        ))}
      </div>
    </div>
  )
}

// ── Jogos — one block per broadcast category (stacked full-width when
// there are 2, a 2-col grid for 3+, full-scale alone when there's 1) ──
// Each court's own backlog renders under that court's own card (see
// CourtGridCard's "Depois, nesta quadra" section) rather than a merged
// category-wide list — that hid the fact that one court can carry a much
// longer backlog than another.

function CategoryJogosSection({ block, name, single }: {
  block: CategoryJogosBlock
  name: (id: string) => string
  single: boolean
}) {
  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <div className="flex items-center gap-3 shrink-0">
        <span className={`font-black text-white ${single ? 'text-3xl' : 'text-xl'}`}>{block.categoryName}</span>
        <span className="text-[10px] font-black uppercase tracking-widest text-white/25">
          {block.liveCourts.length} jogo{block.liveCourts.length !== 1 ? 's' : ''} ao vivo
        </span>
      </div>

      <div className="shrink-0 overflow-hidden">
        {block.liveCourts.length > 0 ? (
          <JogosGrid schedules={block.liveCourts} name={name} categoryMap={{}} large={single} />
        ) : (
          <p className="text-white/15 font-bold text-sm uppercase tracking-widest py-4">Nenhum jogo em andamento nesta categoria</p>
        )}
      </div>
    </div>
  )
}

/** Cycles one category's full Jogos block at a time — never splits the
 *  screen between categories, so there's always the full available height
 *  for one category's live courts + upcoming queue. Guarantees no scroll,
 *  the same way the ranking rotator alternates Rei/Rainha da Quadra. */
function JogosCategoryRotator({ blocks, name }: {
  blocks: CategoryJogosBlock[]
  name: (id: string) => string
}) {
  const [idx,     setIdx]     = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (blocks.length <= 1) return
    const id = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx(prev => (prev + 1) % blocks.length)
        setVisible(true)
      }, FADE_MS)
    }, ROTATE_MS)
    return () => clearInterval(id)
  }, [blocks.length])

  const safeIdx = Math.min(idx, blocks.length - 1)
  const block   = blocks[safeIdx]
  if (!block) return null

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      {blocks.length > 1 && (
        <div className="flex items-center gap-2 shrink-0">
          {blocks.map((_, i) => (
            <span
              key={i}
              style={{
                width:           i === safeIdx ? 28 : 8,
                height:          8,
                borderRadius:    4,
                backgroundColor: i === safeIdx ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.12)',
                transition:      'all 400ms ease',
              }}
            />
          ))}
          <span className="ml-1 text-[10px] font-bold text-white/20 tabular-nums uppercase tracking-wider">
            {safeIdx + 1} / {blocks.length}
          </span>
        </div>
      )}
      <div className="flex-1 min-h-0" style={{ opacity: visible ? 1 : 0, transition: `opacity ${FADE_MS}ms ease` }}>
        <CategoryJogosSection
          block={block}
          name={name}
          single
        />
      </div>
    </div>
  )
}

// ── Painel Geral — progress + agenda (fixed regions) + ticker (destaque/
// hype/frases fixas alternating in place, never a full-screen switch) ──

const TRIVIA = [
  'No Super Oito Misto, cada jogador forma uma dupla diferente a cada rodada — ninguém repete parceiro.',
  'Ao final das 8 rodadas, cada atleta já jogou ao lado de todos os jogadores do gênero oposto pelo menos uma vez.',
  'O ranking de Rei e Rainha da Quadra é individual — o desempenho de cada um conta, mesmo trocando de parceiro toda hora.',
]

const FIXED_PHRASES = [
  'BOA SORTE A TODOS OS ATLETAS! 🎾',
  'ACOMPANHE O RANKING AO VIVO NO PAINEL AO LADO',
]

function formatCollectiveDuration(totalSecs: number): string {
  const totalMins = Math.round(totalSecs / 60)
  const hours = Math.floor(totalMins / 60)
  const mins  = totalMins % 60
  if (hours > 0) return `${hours}h${mins.toString().padStart(2, '0')}`
  return `${mins}min`
}

interface TickerEntry { key: string; render: () => React.ReactNode }

function buildTickerEntries(hypeMessages: string[], highlight: HighlightData | null, collectiveStats: CollectiveStats): TickerEntry[] {
  const entries: TickerEntry[] = []

  if (highlight) {
    entries.push({
      key: 'highlight',
      render: () => (
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#C8F135' }}>🔥 Confronto imperdível</p>
          {highlight.kind === 'topClash' ? (
            <p className="text-xl sm:text-2xl font-black text-white">
              Os dois melhores do momento da <span style={{ color: '#C8F135' }}>{highlight.categoryName}</span> se enfrentam
              {highlight.courtName ? <> na <span style={{ color: '#C8F135' }}>{highlight.courtName}</span></> : ''}!
            </p>
          ) : (
            <p className="text-lg sm:text-xl font-black text-white">
              {highlight.team1} <span className="text-white/30">vs</span> {highlight.team2}
              {highlight.courtName && <> — <span style={{ color: '#C8F135' }}>{highlight.courtName}</span></>}
            </p>
          )}
        </div>
      ),
    })
  }

  entries.push({
    key: 'counter',
    render: () => (
      <div className="space-y-1">
        <p className="font-display font-bold tabular-nums" style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', color: '#F0F0F0' }}>
          {collectiveStats.totalGames}
        </p>
        <p className="text-xs font-bold uppercase tracking-widest text-white/40">Games disputados até agora</p>
        {collectiveStats.totalDurationSeconds != null && (
          <p className="text-sm font-bold text-white/30 mt-1">
            {formatCollectiveDuration(collectiveStats.totalDurationSeconds)} de quadra ao todo
          </p>
        )}
      </div>
    ),
  })

  TRIVIA.forEach((fact, i) => {
    entries.push({
      key: `trivia-${i}`,
      render: () => (
        <div className="space-y-1 max-w-xl">
          <p className="text-xs font-black uppercase tracking-widest text-white/25">💡 Você sabia?</p>
          <p className="text-base sm:text-lg font-semibold text-white/70">{fact}</p>
        </div>
      ),
    })
  })

  hypeMessages.forEach((phrase, i) => {
    entries.push({
      key: `hype-${i}`,
      render: () => (
        <p className="font-display font-bold uppercase leading-tight" style={{ fontSize: 'clamp(1.6rem, 4.5vw, 3rem)', color: '#C8F135' }}>
          {phrase}
        </p>
      ),
    })
  })

  FIXED_PHRASES.forEach((phrase, i) => {
    entries.push({
      key: `fixed-${i}`,
      render: () => <p className="text-lg sm:text-xl font-black text-white/50 uppercase tracking-wide">{phrase}</p>,
    })
  })

  return entries
}

function TickerBand({ hypeMessages, highlight, collectiveStats, active }: {
  hypeMessages: string[]; highlight: HighlightData | null; collectiveStats: CollectiveStats; active: boolean
}) {
  const entries = useMemo(
    () => buildTickerEntries(hypeMessages, highlight, collectiveStats),
    [hypeMessages, highlight, collectiveStats],
  )
  const [idx,     setIdx]     = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (!active || entries.length <= 1) return
    const id = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx(prev => (prev + 1) % entries.length)
        setVisible(true)
      }, FADE_MS)
    }, TICKER_ROTATE_MS)
    return () => clearInterval(id)
  }, [active, entries.length])

  const entry = entries[Math.min(idx, entries.length - 1)]
  if (!entry) return null

  return (
    <div className="h-[210px] shrink-0 border-b border-white/6 flex items-center justify-center px-10 sm:px-16 text-center overflow-hidden">
      <div style={{
        opacity:    visible ? 1 : 0,
        transform:  visible ? 'translateY(0px)' : 'translateY(10px)',
        transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
      }}>
        {entry.render()}
      </div>
    </div>
  )
}

function ProgressoRegion({ progressData, bordered }: { progressData: CategoryProgress[]; bordered: boolean }) {
  return (
    <div className={`flex flex-col gap-6 px-8 py-7 overflow-y-auto ${bordered ? 'border-r border-white/5' : ''}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/25">Progresso da Competição</p>
      <div className="space-y-6">
        {progressData.length === 0 && (
          <p className="text-white/30 text-sm font-bold">Sem categorias em andamento</p>
        )}
        {progressData.map(p => {
          const pct = p.totalMatches > 0 ? Math.round((p.doneMatches / p.totalMatches) * 100) : 0
          return (
            <div key={p.categoryId} className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <p className="text-lg font-black text-white truncate">{p.categoryName}</p>
                <p className="text-sm font-black tabular-nums text-white/60 shrink-0">
                  {p.doneMatches}/{p.totalMatches} partidas
                </p>
              </div>
              <div className="h-3 rounded-full bg-white/8 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: '#C8F135' }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])
  return now
}

const AGENDA_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft:       { label: 'Aguardando',   color: '#888888' },
  group_stage: { label: 'Em andamento', color: '#C8F135' },
  finals:      { label: 'Finais',       color: '#fbbf24' },
  done:        { label: 'Concluída',    color: '#4ade80' },
}

function formatAgendaCountdown(ms: number): string {
  if (ms <= 0) return ''
  const totalSecs = Math.floor(ms / 1000)
  const hours = Math.floor(totalSecs / 3600)
  const mins  = Math.floor((totalSecs % 3600) / 60)
  if (hours > 0) return `${hours}h ${mins}min`
  return `${mins}min`
}

function AgendaRegion({ categories, active }: { categories: AgendaCategory[]; active: boolean }) {
  const now = useNow(active)
  return (
    <div className="flex flex-col gap-4 px-8 py-7 overflow-y-auto">
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/25">Agenda das Categorias</p>
      <div className="space-y-2.5">
        {categories.map(c => {
          const cfg = AGENDA_STATUS_LABEL[c.status] ?? AGENDA_STATUS_LABEL.draft
          const scheduledMs = c.scheduledAt ? new Date(c.scheduledAt).getTime() : null
          const notStarted  = c.status === 'draft' && scheduledMs != null && scheduledMs > now
          return (
            <div key={c.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-3.5">
              <div className="min-w-0">
                <p className="text-base font-black text-white truncate">{c.name}</p>
                {c.scheduledAt && (
                  <p className="text-[11px] font-bold text-white/30 mt-0.5">
                    {new Date(c.scheduledAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    {notStarted && ` · começa em ${formatAgendaCountdown(scheduledMs! - now)}`}
                  </p>
                )}
              </div>
              <span
                className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shrink-0"
                style={{ background: `${cfg.color}22`, color: cfg.color }}
              >
                {cfg.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface StatCard { icon: string; value: string; label: string }

function StatCardsRow({ cards }: { cards: StatCard[] }) {
  return (
    <div
      className="h-[190px] shrink-0 border-t border-white/6 grid gap-5 px-8 py-6"
      style={{ gridTemplateColumns: `repeat(${cards.length}, 1fr)` }}
    >
      {cards.map((c, i) => (
        <div key={i} className="rounded-2xl border border-white/8 bg-white/[0.03] flex flex-col items-center justify-center gap-1.5 text-center px-4">
          <span className="text-3xl leading-none">{c.icon}</span>
          <p className="font-display font-bold tabular-nums leading-none" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', color: '#C8F135' }}>
            {c.value}
          </p>
          <p className="text-[11px] font-black uppercase tracking-widest text-white/40 leading-snug">{c.label}</p>
        </div>
      ))}
    </div>
  )
}

function buildDashboardCards(stats: DashboardStats): StatCard[] {
  const cards: StatCard[] = [
    { icon: '🎾', value: String(stats.totalGames), label: 'Games disputados até agora' },
  ]
  if (stats.pairsFormed != null) {
    cards.push({ icon: '🤝', value: String(stats.pairsFormed), label: 'Duplas formadas até agora' })
  }
  cards.push({ icon: '🔥', value: String(stats.maxWinStreak), label: 'Maior sequência de vitórias atual' })
  cards.push({ icon: '💪', value: String(stats.maxGamesUnbeaten), label: 'Mais games sem perder' })
  return cards
}

function PainelGeralScreen({ progressData, agendaCategories, hypeMessages, highlight, collectiveStats, dashboardStats, active }: {
  progressData: CategoryProgress[]; agendaCategories: AgendaCategory[]; hypeMessages: string[]
  highlight: HighlightData | null; collectiveStats: CollectiveStats; dashboardStats: DashboardStats; active: boolean
}) {
  const showAgenda = agendaCategories.length > 1
  const cards = useMemo(() => buildDashboardCards(dashboardStats), [dashboardStats])
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TickerBand hypeMessages={hypeMessages} highlight={highlight} collectiveStats={collectiveStats} active={active} />
      <div className={`flex-1 grid overflow-hidden ${showAgenda ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <ProgressoRegion progressData={progressData} bordered={showAgenda} />
        {showAgenda && <AgendaRegion categories={agendaCategories} active={active} />}
      </div>
      <StatCardsRow cards={cards} />
    </div>
  )
}

// ── Mural — accumulating collage. Photos land on the current "frame";
// once it reaches capacity, a new blank frame starts and frames rotate. ──

const MURAL_FRAME_SIZE = 12

function seededRandom(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return Math.abs(h % 1000) / 1000
}

function CollageFrame({ photos }: { photos: MuralPhoto[] }) {
  const cols = photos.length <= 4 ? 2 : photos.length <= 9 ? 3 : 4
  return (
    <div className="w-full h-full grid gap-6 place-items-center" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {photos.map(p => {
        const rotate     = (seededRandom(p.id + 'r') - 0.5) * 14
        const translateY = (seededRandom(p.id + 't') - 0.5) * 20
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.id}
            src={p.url}
            alt="Foto do evento"
            className="max-w-full object-contain rounded-lg shadow-2xl animate-fade-in"
            style={{
              border:     '4px solid rgba(255,255,255,0.92)',
              transform:  `rotate(${rotate}deg) translateY(${translateY}px)`,
              maxHeight:  '36vh',
            }}
          />
        )
      })}
    </div>
  )
}

const MURAL_BANNER_HEIGHT = 110

/** A thin lower-third banner across the full width of the Mural screen —
 *  same proportion as a sports-broadcast footer graphic, not a big square
 *  block. Reuses the same `qrcode` lib as the court/result QR cards. Still
 *  big enough to scan from a few meters away, since nobody walks up to a TV. */
function MuralInviteBanner({ tournamentId }: { tournamentId: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const link = `${window.location.origin}/t/${tournamentId}/mural`
    QRCode.toDataURL(link, { width: 140, margin: 1, color: { dark: '#0A0A0A', light: '#FFFFFF' } })
      .then(d => { if (!cancelled) setDataUrl(d) })
      .catch(() => { if (!cancelled) setDataUrl(null) })
    return () => { cancelled = true }
  }, [tournamentId])

  return (
    <div
      className="absolute left-0 right-0 bottom-0 flex items-center gap-5 px-10 bg-black/70 border-t border-white/12 backdrop-blur-sm"
      style={{ height: MURAL_BANNER_HEIGHT }}
    >
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt="QR code" width={80} height={80} className="rounded-lg bg-white p-1.5 shrink-0" />
      ) : (
        <div className="w-[80px] h-[80px] rounded-lg bg-white/10 animate-pulse shrink-0" />
      )}
      <p className="font-display font-bold uppercase leading-snug text-white" style={{ fontSize: 'clamp(1rem, 1.6vw, 1.4rem)' }}>
        Envie sua foto para aparecer no mural
      </p>
    </div>
  )
}

function MuralCollageScreen({ photos, tournamentId }: { photos: MuralPhoto[]; tournamentId: string }) {
  const frames = useMemo(() => {
    if (photos.length === 0) return []
    const out: MuralPhoto[][] = []
    for (let i = 0; i < photos.length; i += MURAL_FRAME_SIZE) out.push(photos.slice(i, i + MURAL_FRAME_SIZE))
    return out
  }, [photos])

  const [frameIdx, setFrameIdx] = useState(0)
  const [visible,  setVisible]  = useState(true)

  useEffect(() => {
    if (frames.length <= 1) return
    const id = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setFrameIdx(f => (f + 1) % frames.length)
        setVisible(true)
      }, FADE_MS)
    }, MURAL_ROTATE_MS)
    return () => clearInterval(id)
  }, [frames.length])

  if (frames.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 relative" style={{ paddingBottom: MURAL_BANNER_HEIGHT }}>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/25">Mural do Evento</p>
        <p className="text-white/30 text-lg font-bold">Nenhuma foto ainda — seja o primeiro a enviar!</p>
        <MuralInviteBanner tournamentId={tournamentId} />
      </div>
    )
  }

  const safeIdx = Math.min(frameIdx, frames.length - 1)
  const frame   = frames[safeIdx]

  return (
    <div className="flex-1 flex flex-col gap-4 px-10 py-6 overflow-hidden relative">
      <div className="flex items-center justify-between shrink-0">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/25">Mural do Evento</p>
        {frames.length > 1 && (
          <span className="text-[10px] font-bold text-white/20 tabular-nums uppercase tracking-wider">
            {safeIdx + 1} / {frames.length}
          </span>
        )}
      </div>
      {/* Bottom padding reserves the banner's footprint so the collage grid
          never places a photo underneath it. */}
      <div
        className="flex-1 min-h-0"
        style={{ paddingBottom: MURAL_BANNER_HEIGHT, opacity: visible ? 1 : 0, transition: `opacity ${FADE_MS}ms ease` }}
      >
        <CollageFrame photos={frame} />
      </div>
      <MuralInviteBanner tournamentId={tournamentId} />
    </div>
  )
}

// ── Screen rotation — tab bar ─────────────────────────────────

type ScreenId = 'jogos' | 'painel' | 'mural'

const SCREEN_LABEL: Record<ScreenId, string> = {
  jogos:  'Jogos',
  painel: 'Painel Geral',
  mural:  'Mural',
}

const SCREEN_ROTATE_MS = 14000

function ScreenTabBar({ screens, activeScreen, nextScreen }: {
  screens: ScreenId[]; activeScreen: ScreenId; nextScreen: ScreenId
}) {
  if (screens.length <= 1) return null
  return (
    <div className="flex items-center gap-1.5 px-8 py-2 border-b border-white/5 shrink-0 overflow-x-auto">
      {screens.map(s => {
        const isActive = s === activeScreen
        const isNext   = !isActive && s === nextScreen
        return (
          <span
            key={s}
            className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shrink-0 transition-all"
            style={{
              background: isActive ? '#C8F135' : isNext ? 'rgba(255,255,255,0.08)' : 'transparent',
              color:      isActive ? '#0A0A0A' : isNext ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.2)',
            }}
          >
            {SCREEN_LABEL[s]}
          </span>
        )
      })}
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────

export default function TVDisplay({
  tournament, players, currentMatch, nextMatches, recentResults,
  rankingPanels, defaultRules, contentItems, courts,
  courtSchedules, categories, hasSuper8MistoCategory,
  progressData, collectiveStats, highlight, hypeMessages, agendaCategories, muralPhotos,
  dashboardStats, jogosBlocks,
}: Props) {
  const router = useRouter()
  const [countdown, setCountdown] = useState(60)

  const playerMap  = Object.fromEntries(players.map(p => [p.id, p]))
  const name       = (id: string) => playerMap[id]?.name ?? '?'
  const courtMap   = Object.fromEntries((courts ?? []).map(c => [c.id, c.name]))
  const courtName  = (m: Match) => m.court_id ? (courtMap[m.court_id] ?? undefined) : undefined

  const categoryMap: Record<string, CategoryInfo> = Object.fromEntries(
    (categories ?? []).map(c => [c.id, {
      name:          c.name,
      scheduledAt:   c.scheduled_at ?? null,
      isSuper8Misto: c.format === 'super8_misto',
      maxGames:      c.max_games,
    }])
  )
  const multiCategory = (categories?.length ?? 0) > 1
  const infoFor = (m: Match) => m.category_id ? (categoryMap[m.category_id] ?? null) : null
  const maxGamesFor = (m: Match) => infoFor(m)?.maxGames ?? defaultRules.max_games
  const isSuper8MistoFor = (m: Match) => infoFor(m)?.isSuper8Misto ?? false
  // Only show the per-match category badge on the legacy list when more than
  // one category is actually in scope — a single-category tournament keeps
  // the exact original (badge-less) look.
  const categoryNameFor = (m: Match) => multiCategory ? (infoFor(m)?.name ?? undefined) : undefined

  const hasCourtView = (courtSchedules?.length ?? 0) > 0
  const visiblePanels = rankingPanels.filter(p => p.showRanking)
  const subPanels = useMemo(() => flattenSubPanels(visiblePanels), [visiblePanels])
  // Categories with no live courts don't get their own turn in the Jogos
  // rotation — falls back to the unfiltered list only if literally every
  // category is empty, so the screen still shows something.
  const activeJogosBlocks = useMemo(() => {
    const nonEmpty = jogosBlocks.filter(b => b.liveCourts.length > 0)
    return nonEmpty.length > 0 ? nonEmpty : jogosBlocks
  }, [jogosBlocks])

  // Category name(s) always visible, regardless of which rotation screen
  // is showing — important once more than one category is broadcasting.
  const categoryNamesJoined = rankingPanels.map(p => p.categoryName).filter(Boolean).join(' · ')

  // ── Screen rotation — 'jogos' is the existing courts/ranking view
  // (renamed), 'painel' consolidates progress/agenda/destaque/hype into
  // one screen with fixed regions + an internal ticker. 'mural' is always
  // in the rotation — even with zero approved photos it still shows an
  // inviting empty state + the QR code, since that's exactly when you most
  // want to advertise it.
  const screens: ScreenId[] = ['jogos', 'painel', 'mural']

  const [screenIdx, setScreenIdx] = useState(0)
  const [screenVisible, setScreenVisible] = useState(true)

  useEffect(() => {
    if (screens.length <= 1) return
    const id = setInterval(() => {
      setScreenVisible(false)
      setTimeout(() => {
        setScreenIdx(prev => (prev + 1) % screens.length)
        setScreenVisible(true)
      }, FADE_MS)
    }, SCREEN_ROTATE_MS)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screens.length])

  const safeScreenIdx = Math.min(screenIdx, screens.length - 1)
  const activeScreen  = screens[safeScreenIdx]
  const nextScreen    = screens[(safeScreenIdx + 1) % screens.length]

  const refresh = useCallback(() => {
    router.refresh()
    setCountdown(30)
  }, [router])

  // Realtime: refresh immediately on any match/court change
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`tv-${tournament.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournament.id}` },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'courts', filter: `tournament_id=eq.${tournament.id}` },
        refresh,
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tournament.id, refresh])

  // Fallback poll every 60s in case realtime drops
  useEffect(() => {
    const id = setInterval(refresh, 60_000)
    return () => clearInterval(id)
  }, [refresh])

  useEffect(() => {
    const id = setInterval(() => setCountdown(n => (n <= 1 ? 60 : n - 1)), 1000)
    return () => clearInterval(id)
  }, [])

  const STATUS_LABEL: Record<string, string> = {
    draft: 'Rascunho', group_stage: 'Fase de Grupos', finals: 'Finais', done: 'Encerrado',
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-[#070D1C] text-white flex flex-col overflow-hidden"
      style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}
    >

      {/* ── Top bar — Rakka logo stays fixed here through the whole rotation ── */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-white/6 shrink-0">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/rakka-logo-full.svg" alt="Rakka" className="h-7 w-auto shrink-0" />
          <div className="w-px h-8 bg-white/10 shrink-0" />
          <div>
            <p className="text-xl font-black leading-none tracking-tight">{tournament.name}</p>
            <p className="text-[11px] text-white/30 font-bold uppercase tracking-widest mt-0.5">
              {STATUS_LABEL[tournament.status] ?? tournament.status}
              {categoryNamesJoined && (
                <span className="text-[#C8F135]/70"> · {categoryNamesJoined}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-white/25">
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <path d="M21 12a9 9 0 11-6.219-8.56" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span className="text-xs font-bold tabular-nums">{countdown}s</span>
          </div>
          <p className="text-2xl font-black tabular-nums text-white/60"><Clock /></p>
          <a href={`/t/${tournament.id}`}
             className="text-xs font-bold text-white/20 hover:text-white/60 transition-colors uppercase tracking-widest">
            ✕ Sair
          </a>
          <a href={`/admin/tournaments/${tournament.id}/tv-admin`}
             className="text-xs font-bold text-white/20 hover:text-white/60 transition-colors uppercase tracking-widest">
            ⚙️
          </a>
        </div>
      </header>

      {/* ── Screen rotation tab bar — discreet, never competes with content ── */}
      <ScreenTabBar screens={screens} activeScreen={activeScreen} nextScreen={nextScreen} />

      {/* ── Active screen (fades between rotation steps) ─────── */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        style={{ opacity: screenVisible ? 1 : 0, transition: `opacity ${FADE_MS}ms ease` }}
      >
      {activeScreen === 'painel' && (
        <PainelGeralScreen
          progressData={progressData}
          agendaCategories={agendaCategories}
          hypeMessages={hypeMessages}
          highlight={highlight}
          collectiveStats={collectiveStats}
          dashboardStats={dashboardStats}
          active={activeScreen === 'painel'}
        />
      )}
      {activeScreen === 'mural' && <MuralCollageScreen photos={muralPhotos} tournamentId={tournament.id} />}

      {activeScreen === 'jogos' && (
      <div className={`flex-1 grid gap-0 overflow-hidden ${
        subPanels.length === 0 ? 'grid-cols-1' : 'grid-cols-[1fr_380px] xl:grid-cols-[1fr_440px]'
      }`}>

        {/* ── LEFT ── */}
        <div className="flex flex-col px-8 py-7 overflow-y-auto border-r border-white/5">

          {hasCourtView && activeJogosBlocks.length > 0 ? (
            /* ── One category at a time, full scale, alternating like the ──
               ranking rotator — guarantees no scroll regardless of how many
               live courts or queued matches a category has ── */
            <div className="flex-1 min-h-0">
              <JogosCategoryRotator
                blocks={activeJogosBlocks}
                name={name}
              />
            </div>
          ) : hasCourtView ? (
            /* ── No categories to group by — pooled grid (unchanged fallback) ── */
            <>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/25 shrink-0 mb-5">
                Jogos
              </p>
              <div className="flex-1">
                <JogosGrid
                  schedules={courtSchedules!}
                  name={name}
                  categoryMap={categoryMap}
                />
              </div>
            </>
          ) : (
            /* ── Legacy match list ── */
            <div className="flex flex-col gap-6">

              {currentMatch ? (
                <section className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/25">
                    Partida em Destaque
                  </p>
                  <CurrentMatchCard
                    m={currentMatch}
                    name={name}
                    maxGames={maxGamesFor(currentMatch)}
                    courtName={courtName(currentMatch)}
                    categoryName={categoryNameFor(currentMatch)}
                    isSuper8Misto={isSuper8MistoFor(currentMatch)}
                  />
                </section>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <p className="text-5xl">🏆</p>
                    <p className="text-2xl font-black text-white/40">Torneio encerrado</p>
                    {hasSuper8MistoCategory && (
                      <a
                        href={`/t/${tournament.id}/tv/revelacao`}
                        className="inline-flex items-center gap-2 mt-2 px-5 py-2.5 rounded-full text-sm font-black uppercase tracking-widest transition-colors"
                        style={{ background: '#C8F135', color: '#0A0A0A' }}
                      >
                        👑 Cerimônia de Revelação
                      </a>
                    )}
                  </div>
                </div>
              )}

              {nextMatches.length > 0 && (
                <section className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/25">Próximas Partidas</p>
                  <div className="space-y-2">
                    {nextMatches.map(m => (
                      <MatchRow key={m.id} m={m} name={name} maxGames={maxGamesFor(m)} variant="next" courtName={courtName(m)} categoryName={categoryNameFor(m)} isSuper8Misto={isSuper8MistoFor(m)} />
                    ))}
                  </div>
                </section>
              )}

              {recentResults.length > 0 && (
                <section className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/25">Resultados Recentes</p>
                  <div className="space-y-2">
                    {recentResults.map(m => (
                      <MatchRow key={m.id} m={m} name={name} maxGames={maxGamesFor(m)} variant="done" courtName={courtName(m)} categoryName={categoryNameFor(m)} isSuper8Misto={isSuper8MistoFor(m)} />
                    ))}
                  </div>
                </section>
              )}

            </div>
          )}
        </div>

        {/* ── RIGHT — Ranking (hidden when every visible category is mid-suspense) ── */}
        {subPanels.length > 0 && (
          <div className="flex flex-col px-7 py-7 overflow-hidden bg-white/[0.015]">
            <SubPanelRotator panels={subPanels} />
          </div>
        )}

      </div>
      )}

      </div>

      {/* ── Lower-third content rotator ── */}
      <ContentRotator items={contentItems} />

    </div>
  )
}
