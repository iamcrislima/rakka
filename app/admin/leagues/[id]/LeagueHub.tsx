'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTransition } from 'react'
import { removeStageAction } from './actions'
import AddStageButton from './AddStageButton'
import { positionLabel, pointsForPosition } from '@/lib/league-scoring'
import type { League, LeagueStage, Tournament, Player, Match, LeaguePlayerStats } from '@/types'
import BackLink from '@/app/components/BackLink'

// ── Types ─────────────────────────────────────────────────────

type TabId = 'ranking' | 'etapas' | 'historico'

interface StageDetail {
  stage:      LeagueStage
  tournament: Tournament
  players:    Player[]
  matches:    Match[]
}

interface Props {
  league:               League
  stages:               StageDetail[]
  leagueRanking:        LeaguePlayerStats[]
  availableTournaments: Tournament[]
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'ranking',   label: 'Ranking',   icon: '🏅' },
  { id: 'etapas',    label: 'Etapas',    icon: '🗓️'  },
  { id: 'historico', label: 'Histórico', icon: '📊'  },
]

const MEDAL = ['🥇', '🥈', '🥉']

const STATUS_CFG: Record<string, { label: string; dot: string; text: string; shape: string }> = {
  draft:       { label: 'Rascunho',     dot: 'bg-[#444444]',              text: 'text-[#888888]',  shape: '○' },
  group_stage: { label: 'Em andamento', dot: 'bg-[#C8F135] animate-pulse', text: 'text-[#C8F135]',  shape: '▶' },
  finals:      { label: 'Finais',       dot: 'bg-amber-400 animate-pulse', text: 'text-amber-400',  shape: '◆' },
  done:        { label: 'Encerrado',    dot: 'bg-emerald-400',             text: 'text-emerald-400', shape: '✓' },
}

// ── Root ──────────────────────────────────────────────────────

export default function LeagueHub({ league, stages, leagueRanking, availableTournaments }: Props) {
  const [tab, setTab] = useState<TabId>('ranking')

  const completedStages = stages.filter(s => s.tournament.status === 'done').length

  return (
    <div>
      {/* ── Banner ── */}
      <div className="relative bg-gradient-to-br from-[#1a0533] to-[#6D28D9] rounded-2xl px-5 py-5 text-white overflow-hidden mb-5">
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />

        {/* Mobile */}
        <div className="lg:hidden">
          <BackLink href="/admin/leagues" label="Ligas" className="text-[10px] font-black uppercase tracking-widest text-white/40" />
          <h1 className="text-xl font-black mt-1">{league.name}</h1>
          {league.description && <p className="text-sm text-white/50 mt-0.5">{league.description}</p>}
          <p className="text-xs text-white/40 font-bold mt-2">
            {stages.length} etapa{stages.length !== 1 ? 's' : ''} · {completedStages} concluída{completedStages !== 1 ? 's' : ''} · {leagueRanking.length} jogadores
          </p>
        </div>

        {/* Desktop */}
        <div className="hidden lg:flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackLink href="/admin/leagues" label="Ligas" className="text-white/50 hover:text-white/80 text-sm font-bold shrink-0" />
            <div className="w-px h-5 bg-white/20" />
            <div>
              <h1 className="text-2xl font-black">{league.name}</h1>
              {league.description && <p className="text-sm text-white/50">{league.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm shrink-0">
            <span className="text-white/40 font-bold">{stages.length} etapas</span>
            <span className="w-px h-4 bg-white/20" />
            <span className="text-white/40 font-bold">{leagueRanking.length} jogadores</span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          MOBILE — tab layout
      ══════════════════════════════════════════════ */}
      <div className="lg:hidden">
        {/* Tab bar */}
        <div className="flex bg-[#1C1C1C] rounded-xl p-1 mb-5">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                tab === t.id ? 'bg-[#161616] text-[#F0F0F0] shadow-sm' : 'text-[#888888]'
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
        <div className="pb-8">
          {tab === 'ranking'   && <RankingTab  ranking={leagueRanking} stages={stages} scoring={league.scoring} />}
          {tab === 'etapas'    && <EtapasTab   stages={stages} leagueId={league.id} available={availableTournaments} />}
          {tab === 'historico' && <HistoricoTab ranking={leagueRanking} stages={stages} scoring={league.scoring} />}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          DESKTOP — 2-column layout
      ══════════════════════════════════════════════ */}
      <div className="hidden lg:grid grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px] gap-8 items-start">
        {/* Left: Ranking (primary) */}
        <div className="space-y-8">
          <RankingTab  ranking={leagueRanking} stages={stages} scoring={league.scoring} />
          <HistoricoTab ranking={leagueRanking} stages={stages} scoring={league.scoring} />
        </div>
        {/* Right: Stages (sidebar) */}
        <div className="sticky top-24">
          <EtapasTab stages={stages} leagueId={league.id} available={availableTournaments} />
        </div>
      </div>

    </div>
  )
}

// ── Ranking tab ───────────────────────────────────────────────

function RankingTab({ ranking, stages, scoring }: {
  ranking: LeaguePlayerStats[]
  stages:  StageDetail[]
  scoring: League['scoring']
}) {
  if (ranking.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-4xl">🏅</p>
        <p className="font-bold text-[#888888]">Ranking ainda não disponível</p>
        <p className="text-sm text-[#888888]">Complete ao menos uma etapa para ver o ranking</p>
      </div>
    )
  }

  const [top3, rest] = [ranking.slice(0, 3), ranking.slice(3)]

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionLabel icon="🏅" label="Ranking geral" />

      {/* Podium */}
      {top3.length >= 2 && (
        <div className="bg-[#161616] rounded-2xl border border-[#242424] shadow-sm overflow-hidden">
          {/* Podium bars */}
          <div className="flex items-end justify-center gap-4 px-8 pt-6 pb-4">
            {[top3[1], top3[0], top3[2]].map((p, col) => {
              if (!p) return <div key={col} className="w-20" />
              const heights = ['h-16', 'h-24', 'h-12']
              const colors     = ['bg-[#1C1C1C]', 'bg-[#C8F135]', 'bg-amber-500/60']
              // Gold slot is a bright lime background — white text on it is
              // illegible, so it needs dark text; silver/bronze stay light-on-dark.
              const textColors = ['text-white', 'text-[#0A0A0A]', 'text-white']
              const medals  = ['🥈', '🥇', '🥉']
              return (
                <div key={p.normalizedName} className="flex flex-col items-center gap-1 w-20">
                  <span className="text-2xl">{medals[col]}</span>
                  <div className="w-10 h-10 rounded-full bg-[#1C1C1C] text-[#C8F135] font-black text-sm flex items-center justify-center border border-[#242424]">
                    {p.displayName[0]?.toUpperCase()}
                  </div>
                  <p className="text-xs font-bold text-[#888888] text-center truncate w-full px-1">{p.displayName}</p>
                  <p className="text-sm font-black text-[#C8F135]">{p.totalPoints}pts</p>
                  <div className={`w-full rounded-t-lg ${heights[col]} ${colors[col]} flex items-center justify-center`}>
                    <span className={`font-black ${textColors[col]}`}>{col === 0 ? 2 : col === 1 ? 1 : 3}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Full table */}
          <div className="border-t border-[#242424]">
            <div className="grid grid-cols-[2rem_1fr_auto] gap-3 px-4 py-2 bg-[#111111] border-b border-[#242424]">
              <span className="text-[10px] font-black text-[#888888]">#</span>
              <span className="text-[10px] font-black text-[#888888] uppercase">Jogador</span>
              <span className="text-[10px] font-black text-[#888888]">Pts</span>
            </div>
            {ranking.map((p, i) => {
              const isFirst = i === 0
              return (
                <div key={p.normalizedName}
                  className={`grid grid-cols-[2rem_1fr_auto] gap-3 items-center px-4 border-b border-[#242424] last:border-0 ${isFirst ? 'py-3.5' : 'py-3'} ${i < 3 ? 'bg-[#1C1C1C]/30' : ''}`}>
                  <span className={`font-display font-bold tabular-nums ${isFirst ? 'text-xl' : 'text-sm'}`}
                        style={{ color: isFirst ? 'var(--bt-neon)' : 'var(--bt-subtle)' }}>
                    {MEDAL[i] ?? p.rank}
                  </span>
                  <div>
                    <p className={`font-bold text-[#F0F0F0] ${isFirst ? 'text-base' : 'text-sm'}`}>{p.displayName}</p>
                    <p className="text-[10px] text-[#888888]">
                      {p.finishes.length} etapa{p.finishes.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className={`font-display font-bold text-[#C8F135] tabular-nums ${isFirst ? 'text-2xl' : 'text-base'}`}>
                    {p.totalPoints}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Scoring rules legend */}
      <div className="bg-[#111111] rounded-xl px-4 py-3 flex flex-wrap gap-x-4 gap-y-1">
        {[1, 2, 3, 4, 5, 7].map(pos => {
          const pts = pointsForPosition(pos, scoring)
          if (pts === 0) return null
          const label = pos >= 7 ? '7º–8º' : pos >= 5 ? '5º–6º' : `${pos}º`
          return (
            <span key={pos} className="text-[11px] font-bold text-[#888888]">
              {label}: <span className="text-[#C8F135]">{pts}pts</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ── Etapas tab ────────────────────────────────────────────────

function EtapasTab({ stages, leagueId, available }: {
  stages:    StageDetail[]
  leagueId:  string
  available: Tournament[]
}) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <SectionLabel icon="🗓️" label="Etapas" />
        <AddStageButton leagueId={leagueId} availableTournaments={available} />
      </div>

      {stages.length === 0 ? (
        <div className="bg-[#161616] rounded-2xl border border-dashed border-[#242424] px-5 py-10 text-center space-y-2">
          <p className="text-3xl">🗓️</p>
          <p className="font-bold text-[#888888]">Nenhuma etapa ainda</p>
          <p className="text-sm text-[#888888]">Adicione torneios para compor a liga</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {stages.map(s => <StageCard key={s.stage.id} detail={s} leagueId={leagueId} />)}
        </div>
      )}
    </div>
  )
}

function StageCard({ detail, leagueId }: { detail: StageDetail; leagueId: string }) {
  const { stage, tournament, matches } = detail
  const cfg = STATUS_CFG[tournament.status] ?? STATUS_CFG.draft
  const [isPending, startTransition] = useTransition()

  const totalMatches = matches.length
  const doneMatches  = matches.filter(m => m.status === 'done').length

  return (
    <div className="bg-[#161616] rounded-2xl border border-[#242424] shadow-sm overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-[#242424]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-[#6B6B6B]">E{stage.stage_number}</span>
          <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          <span className={`text-xs font-bold ${cfg.text}`}>{cfg.shape} {cfg.label}</span>
        </div>
        <button
          onClick={() => startTransition(async () => { await removeStageAction(leagueId, tournament.id) })}
          disabled={isPending}
          className="text-[10px] font-bold text-[#6B6B6B] hover:text-[#FF4444] transition-colors disabled:opacity-40"
        >
          {isPending ? '...' : '✕ Remover'}
        </button>
      </div>
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/admin/tournaments/${tournament.id}`}
            className="text-sm font-bold text-[#F0F0F0] hover:text-[#C8F135] transition-colors truncate block"
          >
            {tournament.name}
          </Link>
          <p className="text-xs text-[#888888]">
            {new Date(tournament.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
        {totalMatches > 0 && (
          <div className="text-right shrink-0">
            <p className="text-sm font-black text-[#F0F0F0] tabular-nums">{doneMatches}/{totalMatches}</p>
            <p className="text-[10px] text-[#888888]">partidas</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Histórico tab ─────────────────────────────────────────────

function HistoricoTab({ ranking, stages, scoring }: {
  ranking: LeaguePlayerStats[]
  stages:  StageDetail[]
  scoring: League['scoring']
}) {
  if (ranking.length === 0 || stages.every(s => s.tournament.status !== 'done')) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-4xl">📊</p>
        <p className="font-bold text-[#888888]">Histórico ainda não disponível</p>
        <p className="text-sm text-[#888888]">Complete ao menos uma etapa para ver o histórico</p>
      </div>
    )
  }

  const completedStages = stages.filter(s => s.tournament.status === 'done')

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionLabel icon="📊" label="Histórico por jogador" />

      <div className="bg-[#161616] rounded-2xl border border-[#242424] shadow-sm overflow-hidden">
        {/* Header row */}
        <div className="grid gap-2 px-4 py-2.5 bg-[#111111] border-b border-[#242424] overflow-x-auto"
          style={{ gridTemplateColumns: `1fr repeat(${completedStages.length}, minmax(56px, 1fr)) 64px` }}>
          <span className="text-[10px] font-black text-[#888888] uppercase">Jogador</span>
          {completedStages.map(s => (
            <span key={s.stage.id} className="text-[10px] font-black text-[#888888] text-center truncate">
              E{s.stage.stage_number}
            </span>
          ))}
          <span className="text-[10px] font-black text-[#C8F135] text-right">Total</span>
        </div>

        {/* Player rows */}
        {ranking.map((p, i) => (
          <div
            key={p.normalizedName}
            className={`grid gap-2 items-center px-4 py-3 border-b border-[#242424] last:border-0 overflow-x-auto ${i < 3 ? 'bg-[#1C1C1C]/20' : ''}`}
            style={{ gridTemplateColumns: `1fr repeat(${completedStages.length}, minmax(56px, 1fr)) 64px` }}
          >
            {/* Name */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-black text-[#6B6B6B] w-4 shrink-0">{MEDAL[i] ?? p.rank}</span>
              <span className="text-sm font-bold text-[#F0F0F0] truncate">{p.displayName}</span>
            </div>

            {/* Per-stage result */}
            {completedStages.map(s => {
              const finish = p.finishes.find(f => f.tournamentId === s.tournament.id)
              if (!finish) {
                return (
                  <span key={s.stage.id} className="text-center text-[10px] text-[#6B6B6B] font-bold">—</span>
                )
              }
              return (
                <div key={s.stage.id} className="flex flex-col items-center">
                  <span className="text-xs font-black text-[#888888]">{positionLabel(finish.position)}</span>
                  <span className="text-[10px] font-bold text-[#C8F135]">{finish.points}pts</span>
                </div>
              )
            })}

            {/* Total */}
            <span className="text-sm font-black text-[#C8F135] tabular-nums text-right">{p.totalPoints}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Primitives ────────────────────────────────────────────────

function SectionLabel({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-base leading-none">{icon}</span>
      <span className="text-xs font-black uppercase tracking-widest text-[#888888]">{label}</span>
    </div>
  )
}
