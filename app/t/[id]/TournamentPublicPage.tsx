'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { Tournament, Player, Match, Category } from '@/types'
import type { CategoryWithReg, RegContext } from './page'
import { computeRanking } from '@/lib/ranking'

// ── Types ─────────────────────────────────────────────────

interface Props {
  tournament:    Tournament
  categoryData:  CategoryWithReg[]
  legacyPlayers: Player[]
  legacyMatches: Match[]
  nameMap:       Record<string, string>
}

type TabId = 'overview' | 'matches' | 'ranking' | 'players'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'overview', label: 'Visão Geral', icon: '🏠' },
  { id: 'matches',  label: 'Partidas',    icon: '🎾' },
  { id: 'ranking',  label: 'Ranking',     icon: '📊' },
  { id: 'players',  label: 'Jogadores',   icon: '👥' },
]

const GENDER_LABEL: Record<string, string> = {
  mens:   'Masculino',
  womens: 'Feminino',
  mixed:  'Misto',
}
const GENDER_COLOR: Record<string, string> = {
  mens:   'rgba(59,130,246,0.18)',
  womens: '#ff6b9d33',
  mixed:  'rgba(168,85,247,0.18)',
}
const GENDER_TEXT: Record<string, string> = {
  mens:   '#60a5fa',
  womens: '#f472b6',
  mixed:  '#c084fc',
}
const STATUS_CFG: Record<string, { label: string; color: string; pulse: boolean; shape: string }> = {
  draft:       { label: 'Rascunho',       color: 'var(--bt-subtle)',  pulse: false, shape: '○' },
  group_stage: { label: 'Fase de grupos', color: '#C8F135',           pulse: true,  shape: '▶' },
  finals:      { label: 'Finais',         color: '#f59e0b',           pulse: true,  shape: '◆' },
  done:        { label: 'Encerrado',      color: '#22c55e',           pulse: false, shape: '✓' },
}

// ── Helpers ───────────────────────────────────────────────

function pname(id: string, nameMap: Record<string, string>) {
  return nameMap[id] ?? '—'
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch {
    return ''
  }
}

function avatarInitials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return `hsl(${Math.abs(hash) % 360}, 60%, 42%)`
}

// ── Root ──────────────────────────────────────────────────

export default function TournamentPublicPage({
  tournament, categoryData, legacyPlayers, legacyMatches, nameMap,
}: Props) {
  const [tab, setTab] = useState<TabId>('overview')

  const isLegacy  = categoryData.length === 0
  const allPlayers = isLegacy
    ? legacyPlayers
    : categoryData.flatMap(cd => cd.players)

  const allMatches = isLegacy
    ? legacyMatches
    : categoryData.flatMap(cd => cd.matches)

  const liveMatches = allMatches.filter(
    m => m.status === 'pending' &&
         (tournament.status === 'group_stage' || tournament.status === 'finals')
  )
  const completedMatches = allMatches.filter(m => m.status === 'done')

  // First open registration for the primary CTA
  const openReg = categoryData.find(cd => cd.reg?.isOpen)?.reg ?? null

  const statusCfg = STATUS_CFG[tournament.status] ?? STATUS_CFG.draft
  const isActive  = tournament.status === 'group_stage' || tournament.status === 'finals'

  // Earliest scheduled date across categories
  const earliestDate = categoryData
    .map(cd => cd.category.scheduled_at)
    .filter(Boolean)
    .sort()[0] ?? null

  const totalSlots = categoryData.reduce((s, cd) => s + cd.category.player_limit, 0)
  const filledSlots = categoryData.reduce((s, cd) => s + (cd.reg?.confirmedCount ?? 0), 0)
  const freeSlots   = Math.max(0, totalSlots - filledSlots)

  return (
    <div className="min-h-dvh" style={{ background: 'var(--bt-bg)' }}>

      {/* ── Hero ─────────────────────────────────────────── */}
      <HeroSection
        tournament={tournament}
        statusCfg={statusCfg}
        isActive={isActive}
        earliestDate={earliestDate}
        openReg={openReg}
        categoryCount={isLegacy ? 0 : categoryData.length}
        playerCount={allPlayers.length}
        freeSlots={freeSlots}
      />

      {/* ── Live Matches ─────────────────────────────────── */}
      {isActive && liveMatches.length > 0 && (
        <LiveSection matches={liveMatches} completedMatches={completedMatches} nameMap={nameMap} />
      )}

      {/* ── Categories ───────────────────────────────────── */}
      {!isLegacy && categoryData.length > 0 && (
        <CategoriesSection categoryData={categoryData} />
      )}

      {/* ── Tab navigation ───────────────────────────────── */}
      <div
        className="sticky top-0 z-20 border-b"
        style={{ background: 'rgba(7,13,26,0.96)', backdropFilter: 'blur(16px)', borderColor: 'var(--bt-border)' }}
      >
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between gap-2">
          <div className="flex gap-1 overflow-x-auto no-scrollbar py-1 min-w-0">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all shrink-0"
                style={{
                  background:  tab === t.id ? 'var(--bt-neon-dim)' : 'transparent',
                  color:       tab === t.id ? 'var(--bt-neon)'     : 'var(--bt-muted)',
                  borderBottom: tab === t.id ? `2px solid var(--bt-neon)` : '2px solid transparent',
                  borderRadius: tab === t.id ? '8px 8px 0 0' : '8px',
                }}
              >
                <span className="text-base leading-none">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
          <a
            href={`/t/${tournament.id}/tv`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider whitespace-nowrap shrink-0 transition-colors"
            style={{ background: 'var(--bt-elevated)', color: 'var(--bt-neon)', border: '1px solid var(--bt-border)' }}
          >
            📺 Modo TV
          </a>
        </div>
      </div>

      {/* ── Tab content ──────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 py-6 pb-24">
        {tab === 'overview' && (
          <OverviewTab
            tournament={tournament}
            categoryData={categoryData}
            legacyPlayers={legacyPlayers}
            legacyMatches={legacyMatches}
            completedMatches={completedMatches}
            nameMap={nameMap}
            isLegacy={isLegacy}
          />
        )}
        {tab === 'matches'  && (
          <MatchesTab
            categoryData={categoryData}
            legacyMatches={legacyMatches}
            nameMap={nameMap}
            isLegacy={isLegacy}
          />
        )}
        {tab === 'ranking'  && (
          <RankingTab
            categoryData={categoryData}
            legacyPlayers={legacyPlayers}
            legacyMatches={legacyMatches}
            nameMap={nameMap}
            isLegacy={isLegacy}
          />
        )}
        {tab === 'players'  && (
          <PlayersTab
            categoryData={categoryData}
            legacyPlayers={legacyPlayers}
            isLegacy={isLegacy}
          />
        )}
      </div>

    </div>
  )
}

// ── Hero Section ──────────────────────────────────────────

function HeroSection({
  tournament, statusCfg, isActive, earliestDate,
  openReg, categoryCount, playerCount, freeSlots,
}: {
  tournament:    Tournament
  statusCfg:     { label: string; color: string; pulse: boolean; shape: string }
  isActive:      boolean
  earliestDate:  string | null
  openReg:       RegContext | null
  categoryCount: number
  playerCount:   number
  freeSlots:     number
}) {
  return (
    <div className="relative overflow-hidden" style={{ minHeight: '72vh' }}>

      {/* Background layers */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #050b16 0%, #0a1428 40%, #0d1c30 100%)' }} />

      {/* Glowing orbs */}
      <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full pointer-events-none"
           style={{ background: 'radial-gradient(circle, rgba(0,200,240,0.12) 0%, transparent 70%)' }} />
      <div className="absolute top-1/2 -right-32 w-80 h-80 rounded-full pointer-events-none"
           style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)' }} />
      <div className="absolute bottom-0 left-1/3 w-64 h-64 rounded-full pointer-events-none"
           style={{ background: 'radial-gradient(circle, rgba(0,200,240,0.06) 0%, transparent 70%)' }} />

      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.035]"
           style={{
             backgroundImage: 'linear-gradient(var(--bt-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--bt-subtle) 1px, transparent 1px)',
             backgroundSize: '48px 48px',
           }} />

      {/* Content */}
      <div className="relative max-w-5xl mx-auto px-4 pt-16 pb-12 flex flex-col justify-center" style={{ minHeight: '72vh' }}>

        {/* Eyebrow */}
        <div className="flex items-center gap-3 mb-5">
          <span className="text-2xl" style={{ color: 'var(--bt-neon)' }}>🎾</span>
          <span className="text-[10px] font-black uppercase tracking-[0.25em]"
                style={{ color: 'var(--bt-muted)' }}>
            Rakka
          </span>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2 mb-4">
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest"
            style={{ background: `${statusCfg.color}22`, color: statusCfg.color, border: `1px solid ${statusCfg.color}44` }}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                background: statusCfg.color,
                animation: statusCfg.pulse ? 'live-dot 1.2s ease-in-out infinite' : 'none',
              }}
            />
            {statusCfg.shape} {statusCfg.label}
          </span>
          {isActive && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
              <span className="w-2 h-2 rounded-full bg-red-400" style={{ animation: 'live-dot 1s ease-in-out infinite' }} />
              Ao Vivo
            </span>
          )}
        </div>

        {/* Tournament name */}
        <h1
          className="font-black leading-none mb-3"
          style={{
            fontSize: 'clamp(2.2rem, 7vw, 4.5rem)',
            color: 'var(--bt-text)',
            letterSpacing: '-0.03em',
            textShadow: '0 0 60px rgba(0,200,240,0.15)',
          }}
        >
          {tournament.name}
        </h1>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          {earliestDate && (
            <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--bt-muted)' }}>
              📅 {formatDate(earliestDate)}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--bt-muted)' }}>
            🏆 {tournament.type === 'doubles' ? 'Duplas' : 'Super Duplas'}
          </span>
          {categoryCount > 0 && (
            <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--bt-muted)' }}>
              📋 {categoryCount} categoria{categoryCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* CTA buttons */}
        <div className="flex flex-wrap gap-3 mb-12">
          {openReg ? (
            <Link
              href={`/registrations/${openReg.shareToken}`}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all btn-primary"
              style={{
                background: 'var(--bt-neon)',
                color: '#050b16',
                boxShadow: '0 0 24px rgba(0,200,240,0.4), 0 4px 16px rgba(0,200,240,0.2)',
              }}
            >
              Inscrever-se Agora
              <span className="text-base">→</span>
            </Link>
          ) : (
            <span
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-black uppercase tracking-wider cursor-not-allowed opacity-60"
              style={{ background: 'var(--bt-elevated)', color: 'var(--bt-muted)', border: '1px solid var(--bt-border)' }}
            >
              Inscrições Encerradas
            </span>
          )}
          <a
            href="#matches-section"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all"
            style={{ background: 'var(--bt-elevated)', color: 'var(--bt-text)', border: '1px solid var(--bt-border)' }}
          >
            Ver Partidas
          </a>
        </div>

        {/* Quick stats strip */}
        <div className="grid grid-cols-3 gap-3 max-w-md">
          <StatChip label="Jogadores" value={playerCount > 0 ? String(playerCount) : '—'} icon="👤" />
          <StatChip
            label="Vagas livres"
            value={freeSlots > 0 ? String(freeSlots) : 'Esgotado'}
            icon="🎟️"
            highlight={freeSlots > 0}
          />
          <StatChip label="Categorias" value={categoryCount > 0 ? String(categoryCount) : '—'} icon="📋" />
        </div>

      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
           style={{ background: 'linear-gradient(to bottom, transparent, var(--bt-bg))' }} />
    </div>
  )
}

function StatChip({ label, value, icon, highlight }: { label: string; value: string; icon: string; highlight?: boolean }) {
  return (
    <div
      className="flex flex-col items-center gap-1 px-3 py-3 rounded-xl"
      style={{
        background: 'var(--bt-card)',
        border: `1px solid ${highlight ? 'rgba(0,200,240,0.25)' : 'var(--bt-border)'}`,
      }}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="text-base font-black leading-none"
            style={{ color: highlight ? 'var(--bt-neon)' : 'var(--bt-text)' }}>
        {value}
      </span>
      <span className="text-[9px] font-bold uppercase tracking-wider text-center leading-tight"
            style={{ color: 'var(--bt-muted)' }}>
        {label}
      </span>
    </div>
  )
}

// ── Live Section ──────────────────────────────────────────

function LiveSection({
  matches, completedMatches, nameMap,
}: {
  matches:          Match[]
  completedMatches: Match[]
  nameMap:          Record<string, string>
}) {
  const recentDone = completedMatches.slice(-3).reverse()

  return (
    <div className="border-t border-b" style={{ borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)' }}>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" style={{ animation: 'live-dot 1s ease-in-out infinite' }} />
          <span className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: '#f87171' }}>
            Partidas em andamento
          </span>
        </div>
        <div className="space-y-2" id="matches-section">
          {matches.slice(0, 6).map(m => (
            <LiveMatchRow key={m.id} match={m} nameMap={nameMap} />
          ))}
        </div>
        {recentDone.length > 0 && (
          <div className="mt-5">
            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--bt-subtle)' }}>
              Últimos resultados
            </p>
            <div className="space-y-1.5">
              {recentDone.map(m => (
                <DoneMatchRow key={m.id} match={m} nameMap={nameMap} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function LiveMatchRow({ match: m, nameMap }: { match: Match; nameMap: Record<string, string> }) {
  const t1 = `${pname(m.team1_p1, nameMap)} + ${pname(m.team1_p2, nameMap)}`
  const t2 = `${pname(m.team2_p1, nameMap)} + ${pname(m.team2_p2, nameMap)}`
  const hasScore = m.score1 != null && m.score2 != null

  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3"
      style={{ background: 'var(--bt-card)', border: '1px solid rgba(239,68,68,0.15)' }}
    >
      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded"
            style={{ background: 'rgba(239,68,68,0.18)', color: '#f87171' }}>
        R{m.round}
      </span>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm font-bold truncate flex-1" style={{ color: 'var(--bt-text)' }}>{t1}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasScore ? (
            <>
              <span className="font-black text-sm" style={{ color: 'var(--bt-neon)' }}>{m.score1}</span>
              <span style={{ color: 'var(--bt-subtle)' }}>×</span>
              <span className="font-black text-sm" style={{ color: 'var(--bt-neon)' }}>{m.score2}</span>
            </>
          ) : (
            <span className="text-xs font-bold" style={{ color: 'var(--bt-subtle)' }}>vs</span>
          )}
        </div>
        <span className="text-sm font-bold truncate flex-1 text-right" style={{ color: 'var(--bt-text)' }}>{t2}</span>
      </div>
    </div>
  )
}

function DoneMatchRow({ match: m, nameMap }: { match: Match; nameMap: Record<string, string> }) {
  const onTeam1Won = (m.score1 ?? 0) > (m.score2 ?? 0)
  const t1 = `${pname(m.team1_p1, nameMap)} + ${pname(m.team1_p2, nameMap)}`
  const t2 = `${pname(m.team2_p1, nameMap)} + ${pname(m.team2_p2, nameMap)}`

  return (
    <div
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
      style={{ background: 'var(--bt-surface)', border: '1px solid var(--bt-border)' }}
    >
      <span style={{ color: onTeam1Won ? 'var(--bt-green)' : 'var(--bt-muted)' }} className="font-bold truncate flex-1">
        {t1}
      </span>
      <span className="font-black shrink-0 px-2" style={{ color: 'var(--bt-text)' }}>
        {m.score1} × {m.score2}
      </span>
      <span style={{ color: !onTeam1Won ? 'var(--bt-green)' : 'var(--bt-muted)' }} className="font-bold truncate flex-1 text-right">
        {t2}
      </span>
    </div>
  )
}

// ── Categories Section ────────────────────────────────────

function CategoriesSection({ categoryData }: { categoryData: CategoryWithReg[] }) {
  const open   = categoryData.filter(cd => cd.reg?.isOpen)
  const others = categoryData.filter(cd => !cd.reg?.isOpen)

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-6 rounded-full" style={{ background: 'var(--bt-neon)' }} />
        <h2 className="text-lg font-black tracking-tight" style={{ color: 'var(--bt-text)' }}>
          Categorias
        </h2>
      </div>

      {open.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2"
             style={{ color: 'var(--bt-neon)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--bt-neon)]" style={{ animation: 'live-dot 1.2s ease-in-out infinite' }} />
            Inscrições abertas
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {open.map(cd => <CategoryCard key={cd.category.id} cd={cd} highlight />)}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div>
          {open.length > 0 && (
            <p className="text-[10px] font-black uppercase tracking-widest mb-3 mt-6"
               style={{ color: 'var(--bt-subtle)' }}>
              Outras categorias
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {others.map(cd => <CategoryCard key={cd.category.id} cd={cd} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function CategoryCard({ cd, highlight = false }: { cd: CategoryWithReg; highlight?: boolean }) {
  const { category: cat, reg } = cd
  const confirmed = reg?.confirmedCount ?? 0
  const limit     = cat.player_limit
  const pct       = limit > 0 ? Math.min((confirmed / limit) * 100, 100) : 0
  const isFull    = confirmed >= limit
  const gender    = cat.gender ?? ''

  return (
    <div
      className="relative flex flex-col gap-3 rounded-2xl p-4 overflow-hidden transition-transform hover:-translate-y-0.5"
      style={{
        background: 'var(--bt-card)',
        border: `1px solid ${highlight ? 'rgba(0,200,240,0.2)' : 'var(--bt-border)'}`,
        boxShadow: highlight ? '0 0 24px rgba(0,200,240,0.06)' : 'none',
      }}
    >
      {/* Subtle glow top-right */}
      {highlight && (
        <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full pointer-events-none"
             style={{ background: 'radial-gradient(circle, rgba(0,200,240,0.12) 0%, transparent 70%)' }} />
      )}

      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {gender && (
            <span
              className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: GENDER_COLOR[gender] ?? 'var(--bt-elevated)', color: GENDER_TEXT[gender] ?? 'var(--bt-muted)' }}
            >
              {GENDER_LABEL[gender] ?? gender}
            </span>
          )}
          {cat.level && (
            <span
              className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
            >
              Nível {cat.level}
            </span>
          )}
        </div>
        {cat.status !== 'draft' && (
          <span
            className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
            style={{
              background: cat.status === 'done' ? 'rgba(34,197,94,0.12)' : 'rgba(0,200,240,0.12)',
              color:      cat.status === 'done' ? '#22c55e'               : 'var(--bt-neon)',
            }}
          >
            {STATUS_CFG[cat.status]?.shape} {STATUS_CFG[cat.status]?.label ?? cat.status}
          </span>
        )}
      </div>

      {/* Name */}
      <p className="font-black text-base leading-tight" style={{ color: 'var(--bt-text)' }}>
        {cat.name}
      </p>

      {/* Price */}
      {cat.price != null && cat.price > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--bt-subtle)' }}>
            Inscrição
          </span>
          <span className="text-sm font-black" style={{ color: '#f59e0b' }}>
            R$ {cat.price.toFixed(2)}
            <span className="text-[10px] font-semibold ml-1" style={{ color: 'var(--bt-muted)' }}>
              /{cat.payment_mode === 'pair' ? 'dupla' : 'jogador'}
            </span>
          </span>
        </div>
      )}

      {/* Slots */}
      {reg && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span style={{ color: 'var(--bt-muted)' }}>Vagas</span>
            <span style={{ color: isFull ? '#f87171' : 'var(--bt-neon)' }}>
              {confirmed} / {limit}
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bt-elevated)' }}>
            <div
              className="h-full rounded-full transition-all duration-500 progress-bar-fill"
              style={{
                width: `${pct}%`,
                background: isFull
                  ? 'linear-gradient(90deg, #f87171, #ef4444)'
                  : 'linear-gradient(90deg, var(--bt-neon), #0088aa)',
              }}
            />
          </div>
          {reg.waitingCount > 0 && (
            <p className="text-[10px] font-semibold" style={{ color: '#f59e0b' }}>
              ⏳ {reg.waitingCount} na fila de espera
            </p>
          )}
        </div>
      )}

      {/* CTA */}
      {reg?.isOpen ? (
        <Link
          href={`/registrations/${reg.shareToken}`}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
          style={
            isFull
              ? { background: 'var(--bt-elevated)', color: 'var(--bt-muted)', border: '1px solid var(--bt-border)' }
              : {
                  background: 'var(--bt-neon)',
                  color: '#050b16',
                  boxShadow: '0 0 12px rgba(0,200,240,0.3)',
                }
          }
        >
          {isFull ? '⏳ Entrar na fila' : '⚡ Inscrever-se'}
        </Link>
      ) : reg && !reg.isOpen ? (
        <div
          className="flex items-center justify-center py-2.5 rounded-xl text-xs font-bold"
          style={{ background: 'var(--bt-elevated)', color: 'var(--bt-subtle)' }}
        >
          Inscrições encerradas
        </div>
      ) : null}
    </div>
  )
}

// ── Overview Tab ──────────────────────────────────────────

function OverviewTab({
  tournament, categoryData, legacyPlayers, legacyMatches,
  completedMatches, nameMap, isLegacy,
}: {
  tournament:       Tournament
  categoryData:     CategoryWithReg[]
  legacyPlayers:    Player[]
  legacyMatches:    Match[]
  completedMatches: Match[]
  nameMap:          Record<string, string>
  isLegacy:         boolean
}) {
  const allPlayers = isLegacy ? legacyPlayers : categoryData.flatMap(cd => cd.players)
  const totalMatches = isLegacy ? legacyMatches.length : categoryData.reduce((s, cd) => s + cd.matches.length, 0)
  const recent = completedMatches.slice(-5).reverse()

  return (
    <div className="space-y-6 animate-fade-up">

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Jogadores', value: allPlayers.length, icon: '👤', neon: false },
          { label: 'Partidas',  value: totalMatches,       icon: '🎾', neon: false },
          { label: 'Concluídas', value: completedMatches.length, icon: '✅', neon: false },
          { label: 'Categorias', value: isLegacy ? '—' : categoryData.length, icon: '📋', neon: true },
        ].map(item => (
          <div key={item.label}
               className="flex flex-col gap-1 rounded-2xl p-4"
               style={{ background: 'var(--bt-card)', border: '1px solid var(--bt-border)' }}>
            <span className="text-2xl">{item.icon}</span>
            <span className="text-2xl font-black leading-none"
                  style={{ color: item.neon ? 'var(--bt-neon)' : 'var(--bt-text)' }}>
              {item.value}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: 'var(--bt-muted)' }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Tournament rules */}
      <div className="rounded-2xl p-5 space-y-3"
           style={{ background: 'var(--bt-card)', border: '1px solid var(--bt-border)' }}>
        <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--bt-subtle)' }}>
          Regras do torneio
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Formato',    value: tournament.type === 'doubles' ? 'Duplas' : 'Super Duplas' },
            { label: 'Games',      value: `Até ${tournament.max_games} games` },
            { label: 'Deuce',      value: tournament.deuce === 'tiebreak' ? 'Tiebreak' : 'Super Tiebreak' },
            { label: 'Tiebreak',   value: `Até ${tournament.tiebreak_to}` },
          ].map(r => (
            <div key={r.label} className="space-y-0.5">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--bt-subtle)' }}>{r.label}</p>
              <p className="text-sm font-bold" style={{ color: 'var(--bt-text)' }}>{r.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent results */}
      {recent.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--bt-subtle)' }}>
            Últimos resultados
          </p>
          <div className="space-y-2">
            {recent.map(m => <ResultRow key={m.id} match={m} nameMap={nameMap} />)}
          </div>
        </div>
      )}

    </div>
  )
}

function ResultRow({ match: m, nameMap }: { match: Match; nameMap: Record<string, string> }) {
  const t1Won = (m.score1 ?? 0) > (m.score2 ?? 0)
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
      style={{ background: 'var(--bt-card)', border: '1px solid var(--bt-border)' }}
    >
      <span className="text-[10px] font-black w-6 text-center" style={{ color: 'var(--bt-subtle)' }}>
        R{m.round}
      </span>
      <span
        className="font-bold flex-1 truncate"
        style={{ color: t1Won ? 'var(--bt-text)' : 'var(--bt-muted)' }}
      >
        {pname(m.team1_p1, nameMap)} + {pname(m.team1_p2, nameMap)}
      </span>
      <span className="font-black shrink-0" style={{ color: 'var(--bt-neon)' }}>
        {m.score1} × {m.score2}
      </span>
      <span
        className="font-bold flex-1 truncate text-right"
        style={{ color: !t1Won ? 'var(--bt-text)' : 'var(--bt-muted)' }}
      >
        {pname(m.team2_p1, nameMap)} + {pname(m.team2_p2, nameMap)}
      </span>
      <span className="text-[10px] shrink-0" style={{ color: t1Won ? 'var(--bt-green)' : '#f87171' }}>
        {t1Won ? '✓' : '✓'}
      </span>
    </div>
  )
}

// ── Matches Tab ───────────────────────────────────────────

function MatchesTab({
  categoryData, legacyMatches, nameMap, isLegacy,
}: {
  categoryData:  CategoryWithReg[]
  legacyMatches: Match[]
  nameMap:       Record<string, string>
  isLegacy:      boolean
}) {
  const groups = isLegacy
    ? [{ label: 'Partidas', matches: legacyMatches }]
    : categoryData.map(cd => ({ label: cd.category.name, matches: cd.matches }))

  if (groups.every(g => g.matches.length === 0)) {
    return <EmptyState icon="🎾" text="Nenhuma partida ainda" />
  }

  return (
    <div className="space-y-8 animate-fade-up">
      {groups.map(g => g.matches.length > 0 && (
        <section key={g.label}>
          <p className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: 'var(--bt-subtle)' }}>
            {g.label}
          </p>
          <MatchList matches={g.matches} nameMap={nameMap} />
        </section>
      ))}
    </div>
  )
}

function MatchList({ matches, nameMap }: { matches: Match[]; nameMap: Record<string, string> }) {
  // Group by round
  const byRound = matches.reduce<Record<number, Match[]>>((acc, m) => {
    ;(acc[m.round] ??= []).push(m)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {Object.entries(byRound).map(([round, ms]) => (
        <div key={round}>
          <p className="text-[10px] font-black uppercase tracking-wider mb-2 flex items-center gap-2"
             style={{ color: 'var(--bt-muted)' }}>
            <span className="w-4 h-px" style={{ background: 'var(--bt-border)' }} />
            Rodada {round}
            <span className="w-4 h-px" style={{ background: 'var(--bt-border)' }} />
          </p>
          <div className="space-y-2">
            {ms.map(m => <PublicMatchRow key={m.id} match={m} nameMap={nameMap} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

function PublicMatchRow({ match: m, nameMap }: { match: Match; nameMap: Record<string, string> }) {
  const done   = m.status === 'done'
  const t1Won  = done && (m.score1 ?? 0) > (m.score2 ?? 0)
  const t2Won  = done && (m.score2 ?? 0) > (m.score1 ?? 0)

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--bt-card)', border: '1px solid var(--bt-border)' }}
    >
      <div className="flex items-stretch">
        {/* Team 1 */}
        <div
          className="flex-1 px-4 py-3 min-w-0"
          style={{ borderRight: '1px solid var(--bt-border)' }}
        >
          <TeamEntry
            p1={pname(m.team1_p1, nameMap)}
            p2={pname(m.team1_p2, nameMap)}
            won={t1Won}
            lost={t2Won}
          />
        </div>

        {/* Score */}
        <div className="flex items-center justify-center px-4 shrink-0 gap-1.5">
          {done ? (
            <>
              <span className="text-lg font-black" style={{ color: t1Won ? 'var(--bt-neon)' : 'var(--bt-muted)' }}>
                {m.score1}
              </span>
              <span style={{ color: 'var(--bt-subtle)' }}>×</span>
              <span className="text-lg font-black" style={{ color: t2Won ? 'var(--bt-neon)' : 'var(--bt-muted)' }}>
                {m.score2}
              </span>
            </>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded"
                  style={{ background: 'var(--bt-elevated)', color: 'var(--bt-subtle)' }}>
              VS
            </span>
          )}
        </div>

        {/* Team 2 */}
        <div
          className="flex-1 px-4 py-3 min-w-0"
          style={{ borderLeft: '1px solid var(--bt-border)' }}
        >
          <TeamEntry
            p1={pname(m.team2_p1, nameMap)}
            p2={pname(m.team2_p2, nameMap)}
            won={t2Won}
            lost={t1Won}
            right
          />
        </div>
      </div>
    </div>
  )
}

function TeamEntry({
  p1, p2, won, lost, right = false,
}: {
  p1: string; p2: string; won: boolean; lost: boolean; right?: boolean
}) {
  return (
    <div className={`flex flex-col gap-0.5 ${right ? 'items-end' : 'items-start'}`}>
      <span
        className="text-xs font-bold leading-tight truncate max-w-[110px]"
        style={{ color: won ? 'var(--bt-text)' : lost ? 'var(--bt-muted)' : 'var(--bt-text)' }}
      >
        {p1}
      </span>
      <span
        className="text-xs font-bold leading-tight truncate max-w-[110px]"
        style={{ color: won ? 'var(--bt-text)' : lost ? 'var(--bt-muted)' : 'var(--bt-text)' }}
      >
        {p2}
      </span>
    </div>
  )
}

// ── Ranking Tab ───────────────────────────────────────────

function RankingTab({
  categoryData, legacyPlayers, legacyMatches, nameMap, isLegacy,
}: {
  categoryData:  CategoryWithReg[]
  legacyPlayers: Player[]
  legacyMatches: Match[]
  nameMap:       Record<string, string>
  isLegacy:      boolean
}) {
  if (isLegacy) {
    const groups: { label: string; players: Player[]; matches: Match[] }[] = [
      { label: 'Grupo A', players: legacyPlayers.filter(p => p.position <= 4), matches: legacyMatches.filter(m => m.stage === 'group_a') },
      { label: 'Grupo B', players: legacyPlayers.filter(p => p.position >= 5), matches: legacyMatches.filter(m => m.stage === 'group_b') },
    ]
    return (
      <div className="space-y-6 animate-fade-up">
        {groups.map(g => (
          <GroupTable key={g.label} label={g.label} players={g.players} matches={g.matches} />
        ))}
      </div>
    )
  }

  const catGroups = categoryData.map(cd => ({
    label:   cd.category.name,
    players: cd.players,
    matches: cd.matches,
  }))

  if (catGroups.every(g => g.players.length === 0)) {
    return <EmptyState icon="📊" text="Nenhum jogador inscrito ainda" />
  }

  return (
    <div className="space-y-8 animate-fade-up">
      {catGroups.map(g => g.players.length > 0 && (
        <GroupTable key={g.label} label={g.label} players={g.players} matches={g.matches} />
      ))}
    </div>
  )
}

function GroupTable({ label, players, matches }: { label: string; players: Player[]; matches: Match[] }) {
  const stats = useMemo(() => computeRanking(players, matches), [players, matches])

  if (stats.length === 0) return null

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--bt-border)' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2" style={{ background: 'var(--bt-elevated)' }}>
        <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--bt-neon)' }}>
          {label}
        </span>
      </div>
      {/* Column headers */}
      <div
        className="grid px-4 py-2 text-[10px] font-black uppercase tracking-wider"
        style={{
          gridTemplateColumns: 'auto 1fr repeat(4, auto)',
          gap: '8px',
          color: 'var(--bt-subtle)',
          background: 'var(--bt-card)',
          borderBottom: '1px solid var(--bt-border)',
        }}
      >
        <span className="w-5 text-center">#</span>
        <span>Dupla</span>
        <span className="w-7 text-center">V</span>
        <span className="w-7 text-center">D</span>
        <span className="w-10 text-center">Saldo</span>
        <span className="w-10 text-center">PTS</span>
      </div>
      {/* Rows */}
      {stats.map((s, i) => (
        <RankRow key={s.player.id} stats={s} rank={i + 1} />
      ))}
    </div>
  )
}

function RankRow({ stats: s, rank }: { stats: ReturnType<typeof computeRanking>[number]; rank: number }) {
  const isTop = rank <= 2
  return (
    <div
      className="grid px-4 py-3 items-center border-b last:border-0 text-sm"
      style={{
        gridTemplateColumns: 'auto 1fr repeat(4, auto)',
        gap: '8px',
        borderColor: 'var(--bt-border)',
        background: isTop ? 'rgba(0,200,240,0.03)' : 'var(--bt-card)',
      }}
    >
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black"
        style={{
          background: rank === 1 ? '#f59e0b22' : rank === 2 ? 'rgba(148,163,184,0.15)' : 'var(--bt-elevated)',
          color:      rank === 1 ? '#f59e0b'   : rank === 2 ? '#94a3b8'                : 'var(--bt-subtle)',
        }}
      >
        {rank}
      </span>
      <Link
        href={`/players/${s.player.id}`}
        className="font-bold truncate hover:underline"
        style={{ color: 'var(--bt-text)' }}
      >
        {s.player.name}
      </Link>
      <span className="w-7 text-center font-bold" style={{ color: 'var(--bt-green)' }}>{s.wins}</span>
      <span className="w-7 text-center font-bold" style={{ color: '#f87171' }}>{s.losses}</span>
      <span className="w-10 text-center font-bold"
            style={{ color: s.gameDiff >= 0 ? 'var(--bt-green)' : '#f87171' }}>
        {s.gameDiff >= 0 ? '+' : ''}{s.gameDiff}
      </span>
      <span className="w-10 text-center font-black" style={{ color: 'var(--bt-neon)' }}>
        {s.wins * 3}
      </span>
    </div>
  )
}

// ── Players Tab ───────────────────────────────────────────

function PlayersTab({
  categoryData, legacyPlayers, isLegacy,
}: {
  categoryData:  CategoryWithReg[]
  legacyPlayers: Player[]
  isLegacy:      boolean
}) {
  const [query, setQuery] = useState('')

  const groups: { label: string; players: Player[]; reg: RegContext | null }[] = isLegacy
    ? [{ label: 'Jogadores', players: legacyPlayers, reg: null }]
    : categoryData.map(cd => ({ label: cd.category.name, players: cd.players, reg: cd.reg }))

  const filtered = groups.map(g => ({
    ...g,
    players: g.players.filter(p =>
      !query || p.name.toLowerCase().includes(query.toLowerCase())
    ),
  }))

  const totalPlayers = groups.reduce((s, g) => s + g.players.length, 0)

  return (
    <div className="space-y-6 animate-fade-up">

      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base pointer-events-none"
              style={{ color: 'var(--bt-subtle)' }}>🔍</span>
        <input
          type="text"
          placeholder={`Buscar entre ${totalPlayers} jogadores...`}
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-3 rounded-xl text-sm font-semibold outline-none transition-all"
          style={{
            background: 'var(--bt-card)',
            border: '1px solid var(--bt-border)',
            color: 'var(--bt-text)',
          }}
        />
      </div>

      {filtered.every(g => g.players.length === 0) && (
        <EmptyState icon="👥" text={query ? 'Nenhum jogador encontrado' : 'Nenhum jogador inscrito ainda'} />
      )}

      {filtered.map(g => g.players.length > 0 && (
        <section key={g.label}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--bt-subtle)' }}>
              {g.label}
            </p>
            {g.reg && (
              <span className="text-[10px] font-bold" style={{ color: 'var(--bt-muted)' }}>
                {g.reg.confirmedCount}/{g.label.includes('—') ? '?' : g.players.length} confirmados
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {g.players.map((p, i) => (
              <PlayerChip key={p.id} player={p} position={i + 1} />
            ))}
          </div>
        </section>
      ))}

    </div>
  )
}

function PlayerChip({ player: p, position }: { player: Player; position: number }) {
  const color = avatarColor(p.name)
  return (
    <Link
      href={`/players/${p.id}`}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
      style={{ background: 'var(--bt-card)', border: '1px solid var(--bt-border)' }}
    >
      <span className="text-[11px] font-black w-5 text-right shrink-0" style={{ color: 'var(--bt-subtle)' }}>
        {position}
      </span>
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0"
        style={{ background: color, color: '#fff' }}
      >
        {avatarInitials(p.name)}
      </div>
      <span className="text-sm font-bold truncate" style={{ color: 'var(--bt-text)' }}>
        {p.name}
      </span>
    </Link>
  )
}

// ── Shared ────────────────────────────────────────────────

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center animate-fade-up">
      <span className="text-5xl opacity-40">{icon}</span>
      <p className="text-sm font-bold" style={{ color: 'var(--bt-subtle)' }}>{text}</p>
    </div>
  )
}
