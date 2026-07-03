'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import type { Player } from '@/types'
import type { MatchWithContext, ProfileStats, AchievementDef, GroupRank } from './page'
import { useTopbar } from '@/app/components/TopbarContext'

// ── Helpers ───────────────────────────────────────────────────

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

// ── Props ─────────────────────────────────────────────────────

interface Props {
  player:           Player
  matches:          MatchWithContext[]
  nameMap:          Record<string, string>
  allPlayerIds:     string[]
  stats:            ProfileStats
  achievements:     AchievementDef[]
  avatarColor:      string
  currentGroupRank: GroupRank | null
}

// ── Root ─────────────────────────────────────────────────────

export default function PlayerProfile({
  player, matches, nameMap, allPlayerIds, stats, achievements, avatarColor, currentGroupRank,
}: Props) {
  const { setMeta } = useTopbar()
  useEffect(() => {
    setMeta({ title: player.name, subtitle: 'Perfil do jogador', eyebrow: 'Jogador' })
    return () => setMeta({ title: '', subtitle: null, eyebrow: null })
  }, [player.name]) // eslint-disable-line react-hooks/exhaustive-deps

  const unlockedCount = achievements.filter(a => a.unlocked).length

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-8">

      {/* ── Hero ──────────────────────────────────────────── */}
      <HeroSection
        player={player}
        stats={stats}
        avatarColor={avatarColor}
        unlockedCount={unlockedCount}
        totalAchievements={achievements.length}
        currentGroupRank={currentGroupRank}
      />

      {/* ── Stats row ─────────────────────────────────────── */}
      <StatsRow stats={stats} />

      {/* ── Body ──────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">

        {/* Match history */}
        <MatchHistory
          matches={matches}
          allPlayerIds={allPlayerIds}
          nameMap={nameMap}
        />

        {/* Achievements */}
        <AchievementsPanel achievements={achievements} />
      </div>
    </div>
  )
}

// ── Hero ──────────────────────────────────────────────────────

const RANK_MEDAL: Record<number, { icon: string; color: string; glow: string }> = {
  1: { icon: '🥇', color: '#f59e0b', glow: 'rgba(245,158,11,0.35)' },
  2: { icon: '🥈', color: '#94a3b8', glow: 'rgba(148,163,184,0.25)' },
  3: { icon: '🥉', color: '#b45309', glow: 'rgba(180,83,9,0.25)'   },
}

function HeroSection({ player, stats, avatarColor, unlockedCount, totalAchievements, currentGroupRank }: {
  player:             Player
  stats:              ProfileStats
  avatarColor:        string
  unlockedCount:      number
  totalAchievements:  number
  currentGroupRank:   GroupRank | null
}) {
  const medal = currentGroupRank ? RANK_MEDAL[currentGroupRank.rank] : null

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{ background: 'linear-gradient(135deg, var(--bt-bg) 0%, var(--bt-card) 55%, var(--bt-bg) 100%)', border: '1px solid var(--bt-border)' }}
    >
      {/* Background layers */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Colour orb behind avatar */}
        <div className="absolute -top-20 -left-10 w-80 h-80 rounded-full"
             style={{ background: avatarColor, filter: 'blur(80px)', opacity: 0.14 }} />
        {/* Subtle neon orb top-right */}
        <div className="absolute -top-10 right-0 w-64 h-64 rounded-full"
             style={{ background: 'var(--bt-neon)', filter: 'blur(90px)', opacity: 0.07 }} />
        {/* Gold orb when ranked #1 */}
        {medal && (
          <div className="absolute bottom-0 right-8 w-56 h-56 rounded-full"
               style={{ background: medal.color, filter: 'blur(80px)', opacity: 0.08 }} />
        )}
        {/* Grid */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.025]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="hero-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hero-grid)" />
        </svg>
        {/* Bottom vignette */}
        <div className="absolute bottom-0 left-0 right-0 h-16"
             style={{ background: 'linear-gradient(to top, rgba(6,14,28,0.6), transparent)' }} />
      </div>

      {/* ── Main content ── */}
      <div className="relative px-5 sm:px-8 pt-8 pb-6">

        {/* Top row: rank badge (top-right) */}
        {currentGroupRank && (
          <div className="absolute top-5 right-5 sm:top-7 sm:right-7 flex flex-col items-center gap-1">
            <div
              className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center shadow-xl"
              style={{
                background: medal ? `${medal.color}18` : 'var(--bt-elevated)',
                border:     `1px solid ${medal ? `${medal.color}40` : 'var(--bt-border)'}`,
                boxShadow:  medal ? `0 0 20px ${medal.glow}` : 'none',
              }}
            >
              <span className="text-2xl leading-none">{medal?.icon ?? '🏅'}</span>
              <span
                className="text-[11px] font-black leading-tight"
                style={{ color: medal?.color ?? 'var(--bt-muted)' }}
              >
                #{currentGroupRank.rank}°
              </span>
            </div>
            <p className="text-[9px] font-black uppercase tracking-wider text-center"
               style={{ color: 'var(--bt-subtle)' }}>
              {currentGroupRank.group}
            </p>
          </div>
        )}

        {/* Avatar + name row */}
        <div className="flex items-end gap-5 mb-5 pr-20 sm:pr-24">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center text-3xl font-black text-white"
              style={{
                background:  avatarColor,
                boxShadow:   `0 0 0 3px ${avatarColor}40, 0 8px 32px ${avatarColor}50`,
              }}
            >
              {initials(player.name)}
            </div>
            {/* Streak fire badge */}
            {stats.currentStreak >= 2 && (
              <div
                className="absolute -bottom-2 -right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-black shadow-lg"
                style={{ background: '#ea580c', color: '#fff' }}
              >
                🔥{stats.currentStreak}
              </div>
            )}
          </div>

          {/* Name + sport label */}
          <div className="min-w-0 pb-1">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] mb-1"
               style={{ color: 'var(--bt-neon)' }}>
              Rakka
            </p>
            <h1
              className="font-display font-bold uppercase leading-tight"
              style={{
                fontSize: 'clamp(1.4rem, 4vw, 2rem)',
                color: 'var(--bt-text)',
                letterSpacing: '-0.01em',
              }}
            >
              {player.name}
            </h1>
          </div>
        </div>

        {/* ── Stat pills row ── */}
        <div className="flex flex-wrap gap-2 mb-5">
          {/* Win/Loss pill */}
          {stats.total > 0 && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--bt-border)' }}
            >
              <span className="font-display font-bold tabular-nums text-base" style={{ color: 'var(--bt-green)' }}>
                {stats.wins}V
              </span>
              <span style={{ color: 'var(--bt-subtle)' }}>·</span>
              <span className="font-display font-bold tabular-nums text-base" style={{ color: 'var(--bt-red)' }}>
                {stats.losses}D
              </span>
            </div>
          )}

          {/* Win rate */}
          {stats.total >= 3 && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black"
              style={{ background: 'rgba(0,200,240,0.1)', color: 'var(--bt-neon)', border: '1px solid rgba(0,200,240,0.2)' }}
            >
              📈 {stats.winRate}%
            </div>
          )}

          {/* Streak badge — full pill version */}
          {stats.currentStreak >= 2 && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black"
              style={{ background: 'rgba(249,115,22,0.12)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.25)' }}
            >
              🔥 {stats.currentStreak} sequência
            </div>
          )}

          {/* Achievements */}
          {unlockedCount > 0 && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black"
              style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}
            >
              🏅 {unlockedCount}/{totalAchievements}
            </div>
          )}
        </div>

        {/* ── Rank context line ── */}
        {currentGroupRank && (
          <p className="text-xs font-semibold" style={{ color: 'var(--bt-muted)' }}>
            {currentGroupRank.rank}° de {currentGroupRank.totalInGroup} no {currentGroupRank.group}
            <span style={{ color: 'var(--bt-subtle)' }}> · </span>
            <span className="truncate" style={{ color: 'var(--bt-subtle)' }}>
              {currentGroupRank.tournamentName}
            </span>
          </p>
        )}

      </div>

      {/* ── Win streak fire bar ── */}
      {stats.currentStreak >= 3 && (
        <div
          className="relative px-5 sm:px-8 py-3 flex items-center gap-3"
          style={{ background: 'linear-gradient(90deg, rgba(234,88,12,0.15), transparent)', borderTop: '1px solid rgba(234,88,12,0.2)' }}
        >
          <span className="text-lg" style={{ animation: 'live-dot 0.8s ease-in-out infinite' }}>🔥</span>
          <div className="flex-1">
            <p className="text-xs font-black" style={{ color: '#fb923c' }}>
              {stats.currentStreak} vitórias seguidas!
            </p>
            <p className="text-[10px]" style={{ color: 'rgba(251,146,60,0.6)' }}>
              Máximo histórico: {stats.maxStreak}
            </p>
          </div>
          {/* Fire bar */}
          <div className="flex gap-0.5">
            {Array.from({ length: Math.min(stats.currentStreak, 8) }).map((_, i) => (
              <div
                key={i}
                className="w-1.5 rounded-full"
                style={{
                  height: `${10 + i * 3}px`,
                  background: `hsl(${30 - i * 3}, 90%, ${60 - i * 2}%)`,
                  opacity: 0.7 + i * 0.04,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Stats row ─────────────────────────────────────────────────

function StatsRow({ stats }: { stats: ProfileStats }) {
  const cards = [
    {
      value:  stats.wins,
      label:  'Vitórias',
      icon:   '✅',
      color:  'var(--bt-green)',
      bg:     'rgba(34,197,94,0.08)',
      border: 'rgba(34,197,94,0.15)',
    },
    {
      value:  stats.losses,
      label:  'Derrotas',
      icon:   '❌',
      color:  'var(--bt-red)',
      bg:     'rgba(248,113,113,0.08)',
      border: 'rgba(248,113,113,0.15)',
    },
    {
      value:  `${stats.winRate}%`,
      label:  'Aproveit.',
      icon:   '📈',
      color:  'var(--bt-neon)',
      bg:     'rgba(0,200,240,0.08)',
      border: 'rgba(0,200,240,0.15)',
    },
    {
      value:  stats.total,
      label:  'Partidas',
      icon:   '🎾',
      color:  'var(--bt-text)',
      bg:     'var(--bt-card)',
      border: 'var(--bt-border)',
    },
    {
      value:  stats.maxStreak,
      label:  'Máx. sequência',
      icon:   '🔥',
      color:  '#fb923c',
      bg:     'rgba(249,115,22,0.08)',
      border: 'rgba(249,115,22,0.15)',
    },
    {
      value:  stats.gameDiff > 0 ? `+${stats.gameDiff}` : stats.gameDiff,
      label:  'Saldo games',
      icon:   '⚡',
      color:  stats.gameDiff >= 0 ? 'var(--bt-green)' : 'var(--bt-red)',
      bg:     'var(--bt-card)',
      border: 'var(--bt-border)',
    },
  ]

  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map(c => (
        <div
          key={c.label}
          className="rounded-xl px-4 py-4 flex flex-col items-center gap-1.5 text-center"
          style={{ background: c.bg, border: `1px solid ${c.border}` }}
        >
          <span className="text-xl leading-none">{c.icon}</span>
          <p className="font-display text-3xl font-bold tabular-nums leading-none" style={{ color: c.color }}>
            {c.value}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--bt-muted)' }}>
            {c.label}
          </p>
        </div>
      ))}
    </div>
  )
}

// ── Match History ─────────────────────────────────────────────

function MatchHistory({ matches, allPlayerIds, nameMap }: {
  matches:      MatchWithContext[]
  allPlayerIds: string[]
  nameMap:      Record<string, string>
}) {
  const resolved = matches.map(m => {
    const myId    = allPlayerIds.find(pid =>
      m.team1_p1 === pid || m.team1_p2 === pid || m.team2_p1 === pid || m.team2_p2 === pid
    ) ?? allPlayerIds[0]
    const onTeam1 = m.team1_p1 === myId || m.team1_p2 === myId
    const won     = m.status === 'done'
      ? (onTeam1 ? (m.score1 ?? 0) > (m.score2 ?? 0) : (m.score2 ?? 0) > (m.score1 ?? 0))
      : null

    const myScore  = onTeam1 ? m.score1 : m.score2
    const oppScore = onTeam1 ? m.score2 : m.score1

    const partnerId = onTeam1
      ? (m.team1_p1 === myId ? m.team1_p2 : m.team1_p1)
      : (m.team2_p1 === myId ? m.team2_p2 : m.team2_p1)
    const opp1Id = onTeam1 ? m.team2_p1 : m.team1_p1
    const opp2Id = onTeam1 ? m.team2_p2 : m.team1_p2

    return { m, won, myScore, oppScore, partnerId, opp1Id, opp2Id }
  })

  const done = resolved.filter(r => r.m.status === 'done')

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--bt-card)', border: '1px solid var(--bt-border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3.5 border-b"
        style={{ background: 'var(--bt-elevated)', borderColor: 'var(--bt-border)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">📋</span>
          <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--bt-text)' }}>
            Histórico de Partidas
          </span>
        </div>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ color: 'var(--bt-muted)', background: 'var(--bt-hover, var(--bt-elevated))' }}>
          {done.length} partidas
        </span>
      </div>

      {done.length === 0 ? (
        <div className="px-5 py-10 text-center space-y-2">
          <p className="text-3xl">🎾</p>
          <p className="text-sm font-bold" style={{ color: 'var(--bt-muted)' }}>Nenhuma partida registrada ainda</p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--bt-border)' }}>
          {done.slice(0, 15).map(({ m, won, myScore, oppScore, partnerId, opp1Id, opp2Id }) => (
            <MatchHistoryRow
              key={m.id}
              won={won!}
              myScore={myScore}
              oppScore={oppScore}
              partnerName={partnerId ? nameMap[partnerId] : null}
              opp1Name={nameMap[opp1Id] ?? '?'}
              opp2Name={nameMap[opp2Id] ?? '?'}
              tournamentName={m.tournament_name}
              stage={m.stage}
              round={m.round}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function MatchHistoryRow({ won, myScore, oppScore, partnerName, opp1Name, opp2Name, tournamentName, stage, round }: {
  won:            boolean
  myScore:        number | null
  oppScore:       number | null
  partnerName:    string | null
  opp1Name:       string
  opp2Name:       string
  tournamentName: string
  stage:          string
  round:          number
}) {
  const isFinal = stage === 'final' || stage === 'consolation_final'

  const stageLabel = stage === 'final'             ? '🏆 Final'
                   : stage === 'consolation_final' ? '🥉 Consolação'
                   : `R${round}`

  return (
    <div className="px-4 py-3 flex items-center gap-3 transition-colors hover:bg-white/[0.02]">

      {/* Result dot */}
      <div
        className="w-1.5 h-8 rounded-full shrink-0"
        style={{ background: won ? 'var(--bt-green)' : 'var(--bt-red)' }}
      />

      {/* Main */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-bold truncate" style={{ color: won ? 'var(--bt-green)' : 'var(--bt-text)' }}>
            {won ? 'Vitória' : 'Derrota'}
          </span>
          {partnerName && (
            <>
              <span className="text-[10px]" style={{ color: 'var(--bt-subtle)' }}>c/</span>
              <span className="text-xs font-semibold truncate" style={{ color: 'var(--bt-muted)' }}>
                {partnerName}
              </span>
            </>
          )}
          <span className="text-[10px]" style={{ color: 'var(--bt-subtle)' }}>vs</span>
          <span className="text-xs font-semibold truncate" style={{ color: 'var(--bt-muted)' }}>
            {opp1Name}{opp2Name && opp2Name !== '?' ? ` + ${opp2Name}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold" style={{ color: isFinal ? '#fbbf24' : 'var(--bt-subtle)' }}>
            {stageLabel}
          </span>
          <span className="text-[9px]" style={{ color: 'var(--bt-subtle)' }}>·</span>
          <span className="text-[10px]" style={{ color: 'var(--bt-subtle)' }} title={tournamentName}>
            {tournamentName.length > 22 ? tournamentName.slice(0, 22) + '…' : tournamentName}
          </span>
        </div>
      </div>

      {/* Score */}
      <div className="shrink-0 flex items-center gap-1.5 tabular-nums">
        <span
          className="font-display text-xl font-bold"
          style={{ color: won ? 'var(--bt-green)' : 'var(--bt-subtle)' }}
        >
          {myScore ?? '—'}
        </span>
        <span className="text-xs" style={{ color: 'var(--bt-subtle)' }}>×</span>
        <span
          className="font-display text-xl font-bold"
          style={{ color: won ? 'var(--bt-subtle)' : 'var(--bt-red)' }}
        >
          {oppScore ?? '—'}
        </span>
      </div>
    </div>
  )
}

// ── Achievements ──────────────────────────────────────────────

function AchievementsPanel({ achievements }: { achievements: AchievementDef[] }) {
  const unlocked = achievements.filter(a => a.unlocked)
  const locked   = achievements.filter(a => !a.unlocked)

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--bt-card)', border: '1px solid var(--bt-border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3.5 border-b"
        style={{ background: 'var(--bt-elevated)', borderColor: 'var(--bt-border)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">🏅</span>
          <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--bt-text)' }}>
            Conquistas
          </span>
        </div>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ color: 'var(--bt-neon)', background: 'rgba(0,200,240,0.1)' }}>
          {unlocked.length}/{achievements.length}
        </span>
      </div>

      <div className="p-4 space-y-4">

        {/* Unlocked */}
        {unlocked.length > 0 && (
          <div className="space-y-2">
            <p className="text-[9px] font-black uppercase tracking-widest px-1"
               style={{ color: 'var(--bt-subtle)' }}>
              Desbloqueadas
            </p>
            <div className="grid grid-cols-2 gap-2">
              {unlocked.map(a => (
                <AchievementBadge key={a.id} achievement={a} />
              ))}
            </div>
          </div>
        )}

        {/* Locked */}
        {locked.length > 0 && (
          <div className="space-y-2">
            <p className="text-[9px] font-black uppercase tracking-widest px-1"
               style={{ color: 'var(--bt-subtle)' }}>
              Bloqueadas
            </p>
            <div className="grid grid-cols-2 gap-2">
              {locked.map(a => (
                <AchievementBadge key={a.id} achievement={a} locked />
              ))}
            </div>
          </div>
        )}

        {unlocked.length === 0 && locked.length === 0 && (
          <p className="text-xs text-center py-4" style={{ color: 'var(--bt-subtle)' }}>
            Nenhuma conquista
          </p>
        )}
      </div>
    </div>
  )
}

function AchievementBadge({ achievement: a, locked }: { achievement: AchievementDef; locked?: boolean }) {
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all"
      style={{
        background:  locked ? 'var(--bt-elevated)' : 'rgba(251,191,36,0.08)',
        border:      `1px solid ${locked ? 'var(--bt-border)' : 'rgba(251,191,36,0.2)'}`,
        opacity:     locked ? 0.45 : 1,
      }}
    >
      <span className={`text-xl leading-none ${locked ? 'grayscale' : ''}`}>
        {locked ? '🔒' : a.icon}
      </span>
      <div className="min-w-0">
        <p
          className="text-[11px] font-bold leading-tight truncate"
          style={{ color: locked ? 'var(--bt-muted)' : '#fbbf24' }}
        >
          {a.label}
        </p>
        <p className="text-[9px] leading-tight mt-0.5 truncate" style={{ color: 'var(--bt-subtle)' }}>
          {a.desc}
        </p>
      </div>
    </div>
  )
}
