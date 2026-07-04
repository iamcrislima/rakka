'use client'

/**
 * Step 0 is a full-screen suspense intro (category name reveal). Steps 1-4
 * are the split-screen result (Rei da Quadra / Rainha da Quadra). Each half
 * stacks vertically: podium on top (1st→2nd→3rd, top to bottom), a wide gap,
 * then the 4th-8th list below it (discreet — smaller, dimmer), in normal
 * ranking order (4th on top, 8th on the bottom).
 *
 * King and Queen always reveal the same position together on the same
 * click — 2nd and 1st appear in the same step, never separated.
 *
 * Controls: space / arrow-right / click-anywhere advances, arrow-left back.
 * The step indicator (bottom-right) is intentionally tiny/muted — it's for
 * the organizer to track pacing, not for the audience.
 */

import { useState, useEffect, useCallback } from 'react'
import QRCode from 'qrcode'
import type { PlayerStats } from '@/types'

export interface CeremonyStats {
  matchesPlayed:         number
  uniquePairs:           number
  totalGames:            number
  totalDurationSeconds:  number | null
}

interface Props {
  tournamentId:   string
  tournamentName: string
  categoryName:   string
  kingRanking:    PlayerStats[]
  queenRanking:   PlayerStats[]
  stats:          CeremonyStats
}

const TOTAL_STEPS = 5 // 0 = suspense intro, 1-4 = reveal steps

const KING_ACCENT  = '#C8F135'
const QUEEN_ACCENT = '#f472b6'
const SILVER       = '#C0C0C0'
const BRONZE       = '#CD7F32'

/** List positions (4th→8th), top-to-bottom render order — normal ranking order. */
function listPositions(revealStep: number): number[] {
  return revealStep <= 0 ? [5, 6, 7, 8] : [4, 5, 6, 7, 8]
}

/** Podium positions (1st→3rd), top-to-bottom render order — 1st on top. */
function podiumPositions(revealStep: number): number[] {
  if (revealStep < 2) return []
  if (revealStep === 2) return [3]
  return [1, 2, 3]
}

export default function RevelationCeremony({ tournamentId, tournamentName, categoryName, kingRanking, queenRanking, stats }: Props) {
  const [step, setStep] = useState(0)
  const isSuspense = step === 0
  const isFinal     = step === TOTAL_STEPS - 1
  const revealStep  = step - 1 // reveal-sequence step, only meaningful when step >= 1

  const next = useCallback(() => setStep(s => Math.min(s + 1, TOTAL_STEPS - 1)), [])
  const prev = useCallback(() => setStep(s => Math.max(s - 1, 0)), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === 'Space' || e.code === 'ArrowRight') { e.preventDefault(); next() }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); prev() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev])

  const [mounted, setMounted] = useState(false)
  useEffect(() => { if (isFinal) setMounted(true) }, [isFinal])

  return (
    <div
      onClick={next}
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden cursor-pointer select-none bg-[#0A0A0A] text-[#F0F0F0] px-4 sm:px-10 py-4 sm:py-6"
    >
      {/* Fixed Rakka logo — same position on every step (including suspense),
          since this is exactly the moment people photograph the screen. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/rakka-logo-full.svg"
        alt="Rakka"
        className="absolute top-4 sm:top-6 left-4 sm:left-8 h-6 sm:h-8 w-auto z-20 opacity-90"
      />

      {isSuspense ? (
        <SuspenseScreen tournamentName={tournamentName} categoryName={categoryName} stats={stats} />
      ) : (
        <>
          {/* Header */}
          <div className="text-center shrink-0 mb-3 sm:mb-5 animate-fade-in">
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] truncate text-[#888888]">
              {tournamentName} · {categoryName}
            </p>
          </div>

          {/* Split screen — Rei da Quadra | Rainha da Quadra */}
          <div className="relative flex-1 min-h-0 grid grid-cols-2 gap-6 sm:gap-10">
            <div className="absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2" style={{ background: '#1C1C1C' }} />

            <GenderHalf label="Rei da Quadra"    accent={KING_ACCENT}  ranking={kingRanking}  revealStep={revealStep} showConfetti={isFinal && mounted} />
            <GenderHalf label="Rainha da Quadra" accent={QUEEN_ACCENT} ranking={queenRanking} revealStep={revealStep} showConfetti={isFinal && mounted} />
          </div>
        </>
      )}

      {/* Share banner — final step only, discreet lower-third */}
      {isFinal && <ShareBanner tournamentId={tournamentId} />}

      {/* Discreet step indicator — organizer-facing only */}
      <div className="absolute bottom-3 right-4 flex items-center gap-1.5 opacity-40">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <span
            key={i}
            style={{
              width:        i === step ? 14 : 4,
              height:       4,
              borderRadius: 2,
              background:   i === step ? '#888888' : '#333333',
              transition:   'all 300ms ease',
            }}
          />
        ))}
        <span className="text-[9px] font-bold tabular-nums text-[#6B6B6B] ml-1">{step + 1}/{TOTAL_STEPS}</span>
      </div>
    </div>
  )
}

// ── Suspense intro — tournament/category header, live stats, countdown ──

function formatTotalDuration(totalSecs: number): string {
  const totalMins = Math.round(totalSecs / 60)
  const hours = Math.floor(totalMins / 60)
  const mins  = totalMins % 60
  if (hours > 0) return `${hours}h${mins.toString().padStart(2, '0')}`
  return `${mins}min`
}

function SuspenseScreen({ tournamentName, categoryName, stats }: {
  tournamentName: string; categoryName: string; stats: CeremonyStats
}) {
  const statItems: { value: string; label: string; badge?: string }[] = [
    { value: String(stats.matchesPlayed), label: 'Partidas disputadas' },
    { value: String(stats.uniquePairs),   label: 'Duplas formadas',    badge: 'Só no Super Oito Misto' },
    { value: String(stats.totalGames),    label: 'Games jogados' },
  ]
  if (stats.totalDurationSeconds != null) {
    statItems.push({ value: formatTotalDuration(stats.totalDurationSeconds), label: 'Tempo total de jogo' })
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-between text-center px-6 py-8 sm:py-10">

      {/* Top — tournament (small) then category (big) */}
      <div className="animate-fade-up" style={{ animationDelay: '0ms' }}>
        <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.3em] text-[#888888]">
          {tournamentName}
        </p>
        <p
          className="font-display font-bold uppercase mt-1"
          style={{ fontSize: 'clamp(2.2rem, 7vw, 5rem)', color: '#C8F135', lineHeight: 1.05 }}
        >
          {categoryName}
        </p>
      </div>

      {/* Middle — big-number stats row */}
      <div
        className="animate-fade-up flex items-start justify-center gap-6 sm:gap-12 flex-wrap"
        style={{ animationDelay: '250ms' }}
      >
        {statItems.map(s => (
          <div key={s.label} className="flex flex-col items-center gap-1 min-w-[5.5rem]">
            <p className="font-display font-bold tabular-nums text-[#F0F0F0]" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', lineHeight: 1 }}>
              {s.value}
            </p>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#888888]">{s.label}</p>
            {s.badge && (
              <span className="text-[9px] font-black uppercase tracking-wide text-[#C8F135]/70">{s.badge}</span>
            )}
          </div>
        ))}
      </div>

      {/* Bottom — reveal cue, manual advance only (no timer — the organizer
          controls pacing on the mic, not a clock). */}
      <div className="animate-fade-up flex flex-col items-center gap-2" style={{ animationDelay: '500ms' }}>
        <span className="text-2xl sm:text-3xl opacity-30">🏆</span>
        <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.3em] text-[#888888]">
          Fique agora com o ranking da categoria {categoryName}
        </p>
        <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-[#C8F135]/80 animate-pulse">
          Toque ou pressione espaço para revelar
        </p>
      </div>

    </div>
  )
}

// ── Gender half — label + podium (top) + list (below) ──────────

function GenderHalf({ label, accent, ranking, revealStep, showConfetti }: {
  label: string; accent: string; ranking: PlayerStats[]; revealStep: number; showConfetti: boolean
}) {
  const podiumPos = podiumPositions(revealStep)
  const listPos   = listPositions(revealStep)

  return (
    <div className="flex flex-col min-h-0 h-full">
      <p
        className="font-display text-center font-bold uppercase tracking-widest shrink-0 mb-2 sm:mb-4"
        style={{ fontSize: 'clamp(1rem, 2.2vw, 1.6rem)', color: accent }}
      >
        {label}
      </p>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Podium — 1st on top, 2nd, 3rd */}
        <div className="flex flex-col gap-1.5 sm:gap-2 shrink-0">
          {podiumPos.map(pos => (
            <PodiumRow key={pos} pos={pos} stats={ranking[pos - 1]} accent={accent} showConfetti={showConfetti} />
          ))}
        </div>

        {/* Wide separation, then the discreet 4th-8th list */}
        {listPos.length > 0 && (
          <div className="mt-5 sm:mt-8 flex flex-col gap-1 sm:gap-1.5 opacity-60 min-h-0">
            {listPos.map(pos => (
              <ListRow key={pos} pos={pos} stats={ranking[pos - 1]} accent={accent} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Game-diff helper ─────────────────────────────────────────

function DiffText({ value }: { value: number }) {
  return (
    <span className={value >= 0 ? 'text-emerald-400' : 'text-[#FF4444]'}>
      {value > 0 ? '+' : ''}{value}
    </span>
  )
}

// ── List row (4th-8th) — discreet ───────────────────────────

function ListRow({ pos, stats, accent }: { pos: number; stats: PlayerStats; accent: string }) {
  if (!stats) return null
  return (
    <div
      className="flex items-center gap-2 sm:gap-3 rounded-lg px-2.5 sm:px-3.5 py-1.5 sm:py-2 animate-row-in"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <span
        className="font-display font-bold tabular-nums shrink-0"
        style={{ fontSize: 'clamp(0.7rem,1.1vw,0.9rem)', color: accent, width: '2ch' }}
      >
        {pos}º
      </span>
      <span
        className="flex-1 font-bold truncate text-left leading-tight"
        style={{ fontSize: 'clamp(0.7rem,1.3vw,1rem)' }}
      >
        {stats.player.name}
      </span>
      <span className="hidden sm:inline text-[9px] font-bold shrink-0 text-right tabular-nums" style={{ color: '#888888' }}>
        {stats.wins}V · {stats.losses}D · <DiffText value={stats.gameDiff} />
      </span>
    </div>
  )
}

// ── Podium row (1st, 2nd, 3rd) ──────────────────────────────

function PodiumRow({ pos, stats, accent, showConfetti }: {
  pos: number; stats: PlayerStats; accent: string; showConfetti: boolean
}) {
  if (!stats) return null
  const isChamp  = pos === 1
  const isSilver = pos === 2
  const isBronze = pos === 3

  if (isChamp) {
    return (
      <div
        className="relative flex items-center gap-3 sm:gap-6 rounded-2xl px-4 sm:px-9 py-4 sm:py-8 overflow-hidden animate-champion-celebrate"
        style={{
          background: `radial-gradient(circle at 15% 30%, ${accent}3A, transparent 70%), ${accent}1C`,
          border:     `3px solid ${accent}`,
          ['--glow-a' as string]: `${accent}33`,
          ['--glow-b' as string]: `${accent}88`,
        } as React.CSSProperties}
      >
        {showConfetti && <RowConfetti accent={accent} />}
        <span className="relative z-10 text-4xl sm:text-6xl leading-none shrink-0">🏆</span>
        <div className="relative z-10 flex-1 min-w-0">
          <p
            className="font-display font-black uppercase truncate text-left leading-tight"
            style={{ fontSize: 'clamp(1.8rem,4vw,3.2rem)', color: '#F0F0F0' }}
          >
            {stats.player.name}
          </p>
          <p className="text-xs sm:text-sm font-bold text-left tabular-nums" style={{ color: accent }}>
            {stats.wins}V · {stats.losses}D · <DiffText value={stats.gameDiff} />
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-2 sm:gap-3 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 animate-row-in"
      style={{
        background: isSilver ? `${SILVER}14` : `${BRONZE}14`,
        border:     `1px solid ${isSilver ? `${SILVER}55` : `${BRONZE}55`}`,
      }}
    >
      <span
        className="font-display font-bold tabular-nums shrink-0"
        style={{ fontSize: 'clamp(0.9rem,1.6vw,1.2rem)', color: isSilver ? SILVER : BRONZE, width: '2ch' }}
      >
        {pos}º
      </span>
      <span
        className="flex-1 font-bold truncate text-left leading-tight"
        style={{ fontSize: 'clamp(0.9rem,1.8vw,1.3rem)' }}
      >
        {stats.player.name}
      </span>
      <span className="hidden sm:inline text-[10px] font-bold shrink-0 text-right tabular-nums" style={{ color: '#888888' }}>
        {stats.wins}V · {stats.losses}D · <DiffText value={stats.gameDiff} />
      </span>
    </div>
  )
}

// ── Confetti scoped to the champion row (CSS-only, client-mounted to ──
// ── avoid SSR/hydration mismatch). Clipped by the row's own bounds so ──
// ── it rains specifically around the 1st-place name, not the screen. ──

function RowConfetti({ accent }: { accent: string }) {
  const colors = [accent, '#FFFFFF', KING_ACCENT]
  const pieces = Array.from({ length: 28 }, (_, i) => ({
    left:     Math.random() * 100,
    delay:    Math.random() * 1.6,
    duration: 1.6 + Math.random() * 1.4,
    color:    colors[i % colors.length],
  }))

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left:              `${p.left}%`,
            backgroundColor:   p.color,
            animationDelay:    `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  )
}

// ── Share banner — final step only, links to the Stories-format share ──
// screen via QR code. Stops click-propagation so tapping the banner never
// gets swallowed by the ceremony's "click anywhere to advance" handler.

function ShareBanner({ tournamentId }: { tournamentId: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const link = `${window.location.origin}/t/${tournamentId}/compartilhar`
    QRCode.toDataURL(link, { width: 120, margin: 1, color: { dark: '#0A0A0A', light: '#FFFFFF' } })
      .then(d => { if (!cancelled) setDataUrl(d) })
      .catch(() => { if (!cancelled) setDataUrl(null) })
    return () => { cancelled = true }
  }, [tournamentId])

  return (
    <div
      onClick={e => e.stopPropagation()}
      className="absolute left-1/2 -translate-x-1/2 bottom-10 sm:bottom-12 z-20 flex items-center gap-3 px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(6px)' }}
    >
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt="QR code" width={56} height={56} className="rounded-lg bg-white p-1 shrink-0" />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-white/10 animate-pulse shrink-0" />
      )}
      <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wide text-white/70 max-w-[10rem] leading-snug">
        Compartilhe o resultado com seus amigos
      </p>
    </div>
  )
}
