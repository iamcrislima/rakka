import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { computeRanking } from '@/lib/ranking'
import type { Match, Player, PlayerStats } from '@/types'
import BackLink from '@/app/components/BackLink'

async function getData(id: string) {
  const [{ data: players }, { data: matches }] = await Promise.all([
    supabase.from('players').select('*').eq('tournament_id', id).order('position'),
    supabase.from('matches').select('*').eq('tournament_id', id),
  ])
  return { players: (players ?? []) as Player[], matches: (matches ?? []) as Match[] }
}

export default async function RankingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { players, matches } = await getData(id)
  if (!players.length) notFound()

  const groupA   = players.filter(p => p.position <= 4)
  const groupB   = players.filter(p => p.position >= 5)
  const matchesA = matches.filter(m => m.stage === 'group_a')
  const matchesB = matches.filter(m => m.stage === 'group_b')
  const rankA    = computeRanking(groupA, matchesA)
  const rankB    = computeRanking(groupB, matchesB)

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="space-y-1">
        <BackLink href={`/admin/tournaments/${id}`} label="Torneio" className="text-sm font-bold text-[#C8F135] active:opacity-70" />
        <h1 className="text-2xl font-black text-[#F0F0F0]">Ranking</h1>
        <p className="text-xs text-[#888888]">Top 2 de cada grupo avançam para as finais</p>
      </div>

      <GroupRanking label="Grupo A" color="bg-[#C8F135]"    textColor="text-[#C8F135]"    stats={rankA} />
      <GroupRanking label="Grupo B" color="bg-[#C8F135]" textColor="text-[#C8F135]" stats={rankB} />

      {/* Finals projection */}
      {rankA.length > 0 && rankB.length > 0 && (
        <section className="space-y-2">
          <SectionLabel label="Projeção das finais" icon="⚡" color="text-amber-400" />
          <div className="bg-[#161616] rounded-2xl border border-amber-500/30 shadow-sm overflow-hidden divide-y divide-[#242424]">
            {[
              {
                emoji: '🏆', label: 'Grande Final',
                t1: [rankA[0], rankB[0]],
                t2: [rankA[1], rankB[1]],
              },
              {
                emoji: '🥉', label: 'Final Consolação',
                t1: [rankA[2], rankB[2]],
                t2: [rankA[3], rankB[3]],
              },
            ].map(row => (
              <div key={row.label} className="px-4 py-3.5 space-y-2">
                <p className="text-[10px] font-black text-[#888888] uppercase tracking-widest">
                  {row.emoji} {row.label}
                </p>
                <div className="flex items-stretch gap-3">
                  <div className="flex-1 space-y-0.5">
                    {row.t1.map((s, i) => (
                      <p key={i} className="text-sm font-bold text-[#F0F0F0] truncate">{s?.player.name ?? '?'}</p>
                    ))}
                  </div>
                  <div className="flex items-center">
                    <span className="text-[10px] font-black text-[#444444] tracking-widest">VS</span>
                  </div>
                  <div className="flex-1 text-right space-y-0.5">
                    {row.t2.map((s, i) => (
                      <p key={i} className="text-sm font-bold text-[#F0F0F0] truncate">{s?.player.name ?? '?'}</p>
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

/* ── Sub-components ──────────────────────────────────── */

function SectionLabel({ label, icon, color }: { label: string; icon: string; color: string }) {
  return (
    <div className="flex items-center gap-2 px-0.5">
      <span className="text-base leading-none">{icon}</span>
      <span className={`text-xs font-black uppercase tracking-widest ${color}`}>{label}</span>
    </div>
  )
}

function GroupRanking({ label, color, textColor, stats }: {
  label: string; color: string; textColor: string; stats: PlayerStats[]
}) {
  const hasData = stats.some(s => s.wins + s.losses > 0)

  return (
    <section className="space-y-2.5">
      <SectionLabel label={label} icon={label.includes('A') ? '🅰️' : '🅱️'} color={textColor} />

      {hasData && stats.length >= 3 && <Podium stats={stats} color={color} />}

      <div className="rounded-2xl border border-[#242424] shadow-sm overflow-hidden" style={{ background: 'var(--bt-card)' }}>
        <div className="grid grid-cols-[2.5rem_2.25rem_1fr_auto] gap-3 px-4 py-2.5 bg-[#111111] border-b border-[#242424]">
          <span className="text-[10px] font-black text-[#888888] uppercase">#</span>
          <span />
          <span className="text-[10px] font-black text-[#888888] uppercase">Jogador</span>
          <span className="text-[10px] font-black text-[#888888] uppercase text-right">V · D · Saldo</span>
        </div>
        {!hasData && (
          <p className="text-xs text-[#6B6B6B] font-medium px-4 py-4">Sem resultados ainda</p>
        )}
        <div className="stagger">
          {stats.map((s, i) => <RankRow key={s.player.id} stats={s} index={i} color={color} />)}
        </div>
      </div>
    </section>
  )
}

function RankRow({ stats, index, color }: { stats: PlayerStats; index: number; color: string }) {
  const isFirst      = index === 0
  const isQualified   = index < 2
  return (
    <div className={`grid grid-cols-[2.5rem_2.25rem_1fr_auto] gap-3 items-center px-4 border-b border-[#242424] last:border-0 transition-colors ${
      isFirst ? 'py-3.5' : 'py-3'
    } ${isQualified ? 'bg-[#1C1C1C]' : ''}`}>
      <span
        className={`font-display font-bold tabular-nums leading-none ${isFirst ? 'text-2xl' : 'text-lg'}`}
        style={{ color: isFirst ? 'var(--bt-neon)' : 'var(--bt-subtle)' }}
      >
        {index + 1}
      </span>
      <div
        className={`rounded-full text-[#0A0A0A] font-black flex items-center justify-center shrink-0 ${
          isFirst ? 'w-10 h-10 text-base' : 'w-9 h-9 text-sm'
        }`}
        style={{ background: isQualified ? 'var(--bt-neon)' : 'var(--bt-elevated)', color: isQualified ? '#0A0A0A' : 'var(--bt-muted)' }}
      >
        {stats.player.name[0]?.toUpperCase()}
      </div>
      <div className="min-w-0 flex items-center gap-1.5">
        {isFirst && <span className="text-base leading-none shrink-0">👑</span>}
        <div className="min-w-0">
          <p className={`font-bold truncate ${isFirst ? 'text-base' : 'text-sm'}`} style={{ color: 'var(--bt-text)' }}>
            {stats.player.name}
          </p>
          {isQualified && (
            <p className="text-[10px] font-bold" style={{ color: 'var(--bt-neon)' }}>✓ Classificado</p>
          )}
        </div>
      </div>
      <div className="text-right shrink-0 flex items-center gap-2 justify-end">
        <span className="font-display font-bold tabular-nums text-emerald-400" style={{ fontSize: isFirst ? '1.15rem' : '1rem' }}>
          {stats.wins}V
        </span>
        <span className="text-xs font-bold" style={{ color: 'var(--bt-subtle)' }}>·</span>
        <span className="font-display font-bold tabular-nums" style={{ fontSize: isFirst ? '1.15rem' : '1rem', color: '#FF4444' }}>
          {stats.losses}D
        </span>
        <span
          className="text-xs font-black tabular-nums px-1.5 py-0.5 rounded shrink-0"
          style={{
            color:      stats.gameDiff >= 0 ? '#22C55E' : '#FF4444',
            background: stats.gameDiff >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(255,68,68,0.12)',
          }}
        >
          {stats.gameDiff > 0 ? '+' : ''}{stats.gameDiff}
        </span>
      </div>
    </div>
  )
}

function Podium({ stats, color }: { stats: PlayerStats[]; color: string }) {
  const [first, second, third] = stats
  const heights = ['h-24', 'h-16', 'h-12']
  const medals  = ['🥇', '🥈', '🥉']
  const order   = [second, first, third]
  const orderIdx = [1, 0, 2]
  const podiumColors = [
    'bg-[#1C1C1C]',
    color,
    'bg-amber-700/50',
  ]
  // Middle slot renders whatever `color` the caller passes (always a bright
  // accent like lime) — white text there is illegible, so it needs dark text.
  const podiumTextColors = ['text-white', 'text-[#0A0A0A]', 'text-white']

  return (
    <div className="flex items-end justify-center gap-2 pt-2 pb-1">
      {order.map((s, col) => {
        if (!s) return <div key={col} className="w-20" />
        const rank = orderIdx[col]
        return (
          <div key={s.player.id} className="flex flex-col items-center gap-1 w-20">
            <span className="text-xl leading-none">{medals[rank]}</span>
            <div className={`w-9 h-9 rounded-full font-black text-xs flex items-center justify-center ${podiumColors[rank]} ${podiumTextColors[rank]}`}>
              {s.player.name[0]?.toUpperCase()}
            </div>
            <p className="text-[11px] font-bold text-[#888888] text-center truncate w-full px-1">{s.player.name}</p>
            <p className="text-[10px] font-bold text-[#888888]">{s.wins}V {s.gameDiff > 0 ? '+' : ''}{s.gameDiff}</p>
            <div className={`w-full rounded-t-lg ${heights[rank]} ${podiumColors[rank]} flex items-center justify-center`}>
              <span className={`font-black text-base ${podiumTextColors[rank]}`}>{rank + 1}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
