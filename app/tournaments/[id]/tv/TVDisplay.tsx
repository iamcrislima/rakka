'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Tournament, Player, Match, MatchRules, PlayerStats, TVContent, Court, Category } from '@/types'
import ContentRotator from './ContentRotator'

// ── Exported types (used by page.tsx) ────────────────────────

export interface CourtSchedule {
  court:   Court
  current: Match | null
  next:    Match | null
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

const ROTATE_MS = 7000
const FADE_MS   = 380

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

// ── RankingPanel (Grupo A/B) ─────────────────────────────────

function RankingPanel({ label, stats, accent, color }: {
  label: string; stats: PlayerStats[]; accent: string; color: string
}) {
  const hasData = stats.some(s => s.wins + s.losses > 0)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`w-6 h-6 rounded text-white text-[10px] font-black flex items-center justify-center ${color}`}>
          {label.slice(-1)}
        </span>
        <span className={`text-xs font-black uppercase tracking-widest ${accent}`}>{label}</span>
      </div>
      <div className="rounded-2xl overflow-hidden border border-white/6 bg-white/3">
        {!hasData && <p className="text-sm text-white/20 font-medium px-5 py-4">Sem resultados ainda</p>}
        {stats.map((s, i) => {
          const qualified = i < 2
          return (
            <div key={s.player.id} className={`flex items-center gap-3 px-5 py-3.5 border-b border-white/4 last:border-0 ${qualified ? 'bg-white/3' : ''}`}>
              <span className="text-base font-black text-white/60 tabular-nums w-5">{i + 1}</span>
              <div className={`w-9 h-9 rounded-full text-white text-sm font-black flex items-center justify-center shrink-0 ${qualified ? color : 'bg-white/10'}`}>
                {s.player.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-white/90 truncate">{s.player.name}</p>
                {qualified && hasData && (
                  <p className="text-[10px] font-bold text-emerald-400/70 uppercase tracking-wide">Classificado</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-base font-black text-white/60 tabular-nums">{s.wins}V · {s.losses}D</p>
                <p className={`text-xs font-bold tabular-nums ${s.gameDiff >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
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

// ── GenderRankingPanel (Super Oito Misto — Rei/Rainha da Quadra) ──

function GenderRankingPanel({ label, icon, stats, accent, color, textColor }: {
  label: string; icon: string; stats: PlayerStats[]; accent: string; color: string; textColor: string
}) {
  const hasData = stats.some(s => s.wins + s.losses > 0)
  const leader  = stats[0]

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`text-sm ${accent}`}>{icon}</span>
        <span className={`text-xs font-black uppercase tracking-widest ${accent}`}>{label}</span>
      </div>

      {hasData && leader && (
        <div className={`rounded-2xl px-5 py-4 ${color} flex items-center gap-3`}>
          <span className="text-3xl leading-none">{icon}</span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: textColor, opacity: 0.7 }}>Líder</p>
            <p className="text-xl font-black truncate" style={{ color: textColor }}>{leader.player.name}</p>
            <p className="text-xs font-bold" style={{ color: textColor, opacity: 0.8 }}>
              {leader.wins}V · {leader.losses}D · saldo {leader.gameDiff > 0 ? '+' : ''}{leader.gameDiff}
            </p>
          </div>
        </div>
      )}

      <div className="rounded-2xl overflow-hidden border border-white/6 bg-white/3">
        {!hasData && <p className="text-sm text-white/20 font-medium px-5 py-4">Sem resultados ainda</p>}
        {stats.map((s, i) => (
          <div key={s.player.id} className={`flex items-center gap-3 px-5 py-3.5 border-b border-white/4 last:border-0 ${i === 0 && hasData ? 'bg-white/3' : ''}`}>
            <span className="text-base font-black text-white/60 tabular-nums w-5">{i + 1}</span>
            <div className={`w-9 h-9 rounded-full text-sm font-black flex items-center justify-center shrink-0 ${i === 0 && hasData ? color : 'bg-white/10 text-white'}`}
                 style={i === 0 && hasData ? { color: textColor } : undefined}>
              {s.player.name[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-white/90 truncate">{s.player.name}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-base font-black text-white/60 tabular-nums">{s.wins}V · {s.losses}D</p>
              <p className={`text-xs font-bold tabular-nums ${s.gameDiff >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                {s.gameDiff > 0 ? '+' : ''}{s.gameDiff}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── One category's ranking block (gender pair or group pair) ────

function RankingPanelBlock({ panel }: { panel: RankingPanelData }) {
  if (panel.kind === 'gender') {
    return (
      <>
        <GenderRankingPanel label="Rei da Quadra"    icon="👑" stats={panel.kingRanking  ?? []} accent="text-[#C8F135]" color="bg-[#C8F135]" textColor="#0A0A0A" />
        <GenderRankingPanel label="Rainha da Quadra" icon="👑" stats={panel.queenRanking ?? []} accent="text-pink-400"  color="bg-pink-500"  textColor="#0A0A0A" />
      </>
    )
  }
  return (
    <>
      <RankingPanel label="Grupo A" stats={panel.rankingA ?? []} accent="text-sky-400"    color="bg-sky-500" />
      <RankingPanel label="Grupo B" stats={panel.rankingB ?? []} accent="text-violet-400" color="bg-violet-500" />
    </>
  )
}

// ── Ranking rotator — cycles between categories' ranking panels ──
// Static (no dots, no rotation) when there's only one — identical to
// the original single-category behavior.

function RankingRotator({ panels }: { panels: RankingPanelData[] }) {
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between shrink-0">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/25">
          Ranking ao Vivo{panels.length > 1 ? ` · ${panel.categoryName}` : ''}
        </p>
        {panels.length > 1 && (
          <span className="text-[10px] font-bold text-white/20 tabular-nums uppercase tracking-wider shrink-0">
            {safeIdx + 1} / {panels.length}
          </span>
        )}
      </div>
      <div
        className="flex flex-col gap-6"
        style={{
          opacity:    visible ? 1 : 0,
          transform:  visible ? 'translateY(0px)' : 'translateY(12px)',
          transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
        }}
      >
        <RankingPanelBlock panel={panel} />
      </div>
    </div>
  )
}

// ── Court view — single match block ──────────────────────────

function CourtMatchBlock({ m, label, variant, name, categoryInfo, maxGames, isSuper8Misto }: {
  m:            Match
  label:        string
  variant:      'current' | 'next'
  name:         (id: string) => string
  categoryInfo: { name: string; scheduledAt: string | null } | null
  maxGames:     number
  isSuper8Misto?: boolean
}) {
  const isDone     = m.status === 'done'
  const t1Wins     = isDone && (m.score1 ?? 0) > (m.score2 ?? 0)
  const t2Wins     = isDone && (m.score2 ?? 0) > (m.score1 ?? 0)
  const wasTb      = isDone && isTiebreakResult(m, maxGames)
  const isCur      = variant === 'current'
  const accent     = isSuper8Misto ? 'text-[#C8F135]' : (STAGE_ACCENT[m.stage] ?? 'text-white/30')

  // Scheduled — not yet active
  const scheduledMs  = categoryInfo?.scheduledAt ? new Date(categoryInfo.scheduledAt).getTime() : null
  const isScheduled  = !m.override_active && scheduledMs != null && scheduledMs > Date.now()

  return (
    <div className={`rounded-2xl border overflow-hidden ${
      isCur
        ? 'border-white/12 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]'
        : 'border-white/6 bg-white/[0.03]'
    }`}>

      {/* Row: status dot · label · stage · category */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/6">
        <div className="flex items-center gap-2.5">
          {isScheduled ? (
            <span className="text-sm leading-none shrink-0">🔒</span>
          ) : (
            <span className={`w-2 h-2 rounded-full shrink-0 ${isCur ? 'bg-red-400 animate-pulse' : 'bg-white/15'}`} />
          )}
          <span className={`text-xs font-black uppercase tracking-[0.18em] ${isCur ? 'text-white/70' : 'text-white/30'}`}>
            {label}
          </span>
          <span className={`text-[10px] font-bold uppercase tracking-wide ${accent}`}>
            · {isSuper8Misto ? `Rodada ${m.round}` : `${STAGE_LABEL[m.stage]}${!m.stage.includes('final') ? ` R${m.round}` : ''}`}
          </span>
        </div>
        {categoryInfo && (
          <span className="text-[10px] font-bold text-white/40 bg-white/6 px-2.5 py-0.5 rounded-full shrink-0 ml-2 truncate max-w-[140px]">
            {categoryInfo.name}
          </span>
        )}
      </div>

      {/* Teams + score/time grid */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-5 py-5">

        {/* Team 1 */}
        <div className={`${isDone && !t1Wins ? 'opacity-25' : ''} ${isScheduled ? 'opacity-40' : ''}`}>
          <p className={`font-black truncate leading-snug ${isCur ? 'text-[1.6rem] text-white' : 'text-xl text-white/80'}`}>
            {name(m.team1_p1)}
          </p>
          <p className={`font-bold truncate leading-snug mt-0.5 ${isCur ? 'text-xl text-white/55' : 'text-base text-white/40'}`}>
            {name(m.team1_p2)}
          </p>
        </div>

        {/* Center: score / VS / scheduled time */}
        <div className="flex flex-col items-center gap-1 shrink-0 px-4">
          {isScheduled ? (
            <>
              <span className="text-2xl leading-none">🕐</span>
              <span className={`font-black tabular-nums text-white/60 ${isCur ? 'text-2xl' : 'text-xl'}`}>
                {new Date(categoryInfo!.scheduledAt!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </>
          ) : isDone ? (
            <>
              <div className="flex items-center gap-3">
                <span className={`font-black tabular-nums leading-none ${isCur ? 'text-5xl' : 'text-4xl'} ${t1Wins ? 'text-white' : 'text-white/60'}`}>
                  {m.score1}
                </span>
                <span className={`font-black text-white/15 ${isCur ? 'text-3xl' : 'text-2xl'}`}>×</span>
                <span className={`font-black tabular-nums leading-none ${isCur ? 'text-5xl' : 'text-4xl'} ${t2Wins ? 'text-white' : 'text-white/60'}`}>
                  {m.score2}
                </span>
              </div>
              {wasTb && <span className="text-[9px] font-black text-amber-400/50 uppercase tracking-widest">TB</span>}
            </>
          ) : (
            <span className={`font-black text-white/12 tracking-widest ${isCur ? 'text-4xl' : 'text-3xl'}`}>VS</span>
          )}
        </div>

        {/* Team 2 */}
        <div className={`text-right ${isDone && !t2Wins ? 'opacity-25' : ''} ${isScheduled ? 'opacity-40' : ''}`}>
          <p className={`font-black truncate leading-snug ${isCur ? 'text-[1.6rem] text-white' : 'text-xl text-white/80'}`}>
            {name(m.team2_p1)}
          </p>
          <p className={`font-bold truncate leading-snug mt-0.5 ${isCur ? 'text-xl text-white/55' : 'text-base text-white/40'}`}>
            {name(m.team2_p2)}
          </p>
        </div>

      </div>
    </div>
  )
}

// ── Court view — single court card ───────────────────────────

function CourtCard({ schedule, name, categoryMap, defaultMaxGames }: {
  schedule:    CourtSchedule
  name:        (id: string) => string
  categoryMap: Record<string, CategoryInfo>
  defaultMaxGames: number
}) {
  const { court, current, next } = schedule
  const infoFor = (m: Match | null) => m?.category_id ? (categoryMap[m.category_id] ?? null) : null

  return (
    <div className="space-y-5 h-full">

      {/* Court name header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-white/6 border border-white/8 flex items-center justify-center text-3xl shrink-0">
          🏟️
        </div>
        <div>
          <p className="text-[2.6rem] font-black text-white leading-none tracking-tight">
            {court.name}
          </p>
        </div>
      </div>

      {/* Current match */}
      {current ? (
        <CourtMatchBlock
          m={current}
          label="Em quadra"
          variant="current"
          name={name}
          categoryInfo={infoFor(current)}
          maxGames={infoFor(current)?.maxGames ?? defaultMaxGames}
          isSuper8Misto={infoFor(current)?.isSuper8Misto}
        />
      ) : (
        <div className="rounded-2xl border border-white/6 bg-white/2 flex items-center justify-center py-12">
          <p className="text-white/15 font-bold text-sm uppercase tracking-[0.2em]">Quadra livre</p>
        </div>
      )}

      {/* Next match */}
      {next && (
        <CourtMatchBlock
          m={next}
          label="Próxima"
          variant="next"
          name={name}
          categoryInfo={infoFor(next)}
          maxGames={infoFor(next)?.maxGames ?? defaultMaxGames}
          isSuper8Misto={infoFor(next)?.isSuper8Misto}
        />
      )}

    </div>
  )
}

// ── Court rotator ─────────────────────────────────────────────

function CourtRotator({ schedules, name, categoryMap, defaultMaxGames }: {
  schedules:   CourtSchedule[]
  name:        (id: string) => string
  categoryMap: Record<string, CategoryInfo>
  defaultMaxGames: number
}) {
  const [idx,     setIdx]     = useState(0)
  const [visible, setVisible] = useState(true)

  function goTo(i: number) {
    if (i === idx) return
    setVisible(false)
    setTimeout(() => { setIdx(i); setVisible(true) }, FADE_MS)
  }

  useEffect(() => {
    if (schedules.length <= 1) return
    const id = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx(prev => (prev + 1) % schedules.length)
        setVisible(true)
      }, FADE_MS)
    }, ROTATE_MS)
    return () => clearInterval(id)
  }, [schedules.length])

  const safeIdx  = Math.min(idx, schedules.length - 1)
  const schedule = schedules[safeIdx]

  return (
    <div className="flex flex-col gap-5 h-full">

      {/* Dot navigation — only show when multiple courts */}
      {schedules.length > 1 && (
        <div className="flex items-center gap-2 shrink-0">
          {schedules.map((s, i) => (
            <button
              key={s.court.id}
              onClick={() => goTo(i)}
              style={{
                width:           i === safeIdx ? 28 : 8,
                height:          8,
                borderRadius:    4,
                backgroundColor: i === safeIdx ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.12)',
                transition:      'all 400ms ease',
                flexShrink:      0,
              }}
            />
          ))}
          <span className="ml-1 text-[10px] font-bold text-white/20 tabular-nums uppercase tracking-wider">
            {safeIdx + 1} / {schedules.length}
          </span>
        </div>
      )}

      {/* Animated card */}
      <div
        style={{
          opacity:    visible ? 1 : 0,
          transform:  visible ? 'translateY(0px)' : 'translateY(12px)',
          transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
          flex:       1,
          minHeight:  0,
        }}
      >
        <CourtCard
          schedule={schedule}
          name={name}
          categoryMap={categoryMap}
          defaultMaxGames={defaultMaxGames}
        />
      </div>

    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────

export default function TVDisplay({
  tournament, players, currentMatch, nextMatches, recentResults,
  rankingPanels, defaultRules, contentItems, courts,
  courtSchedules, categories, hasSuper8MistoCategory,
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

      {/* ── Top bar ───────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-white/6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center text-xl">🎾</div>
          <div>
            <p className="text-xl font-black leading-none tracking-tight">{tournament.name}</p>
            <p className="text-[11px] text-white/30 font-bold uppercase tracking-widest mt-0.5">
              {STATUS_LABEL[tournament.status] ?? tournament.status}
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
          <a href={`/tournaments/${tournament.id}`}
             className="text-xs font-bold text-white/20 hover:text-white/60 transition-colors uppercase tracking-widest">
            ✕ Sair
          </a>
          <a href={`/tournaments/${tournament.id}/tv-admin`}
             className="text-xs font-bold text-white/20 hover:text-white/60 transition-colors uppercase tracking-widest">
            ⚙️
          </a>
        </div>
      </header>

      {/* ── Main grid ─────────────────────────────────────────── */}
      <div className={`flex-1 grid gap-0 overflow-hidden ${
        visiblePanels.length === 0 ? 'grid-cols-1' : 'grid-cols-[1fr_380px] xl:grid-cols-[1fr_440px]'
      }`}>

        {/* ── LEFT ── */}
        <div className="flex flex-col px-8 py-7 overflow-y-auto border-r border-white/5">

          {hasCourtView ? (
            /* ── Court-based rotating view ── */
            <>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/25 shrink-0 mb-5">
                Quadras
              </p>
              <div className="flex-1">
                <CourtRotator
                  schedules={courtSchedules!}
                  name={name}
                  categoryMap={categoryMap}
                  defaultMaxGames={defaultRules.max_games}
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
                        href={`/tournaments/${tournament.id}/tv/revelacao`}
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
        {visiblePanels.length > 0 && (
          <div className="flex flex-col gap-6 px-7 py-7 overflow-y-auto bg-white/[0.015]">
            <RankingRotator panels={visiblePanels} />
          </div>
        )}

      </div>

      {/* ── Lower-third content rotator ── */}
      <ContentRotator items={contentItems} />

    </div>
  )
}
