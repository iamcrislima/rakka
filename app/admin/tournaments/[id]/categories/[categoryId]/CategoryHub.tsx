'use client'

/**
 * CategoryHub — same layout as TournamentHub but scoped to one category.
 * Status and rules come from the Category row, not the Tournament.
 * All action buttons receive categoryId so they target the right records.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BackLink from '@/app/components/BackLink'
import type { Tournament, Category, Player, Match, MatchRules, PlayerStats, Court } from '@/types'
import type { KnockoutSeed, MatchSeed } from '@/lib/match-generator'
import { computeRanking } from '@/lib/ranking'
import { rulesHint } from '@/lib/match-rules'
import MatchCard, { MatchDurationStats } from '../../MatchCard'
import GenerateFinalsButton from '../../GenerateFinalsButton'
import ShuffleGroupsButton from '../../ShuffleGroupsButton'
import StartGroupStageButton from '../../StartGroupStageButton'

type TabId = 'matches' | 'ranking' | 'bracket' | 'info'

interface HubProps {
  tournament:  Tournament
  category:    Category
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

const STATUS_CFG: Record<string, { label: string; dot: string; shape: string }> = {
  draft:       { label: 'Rascunho',       dot: 'bg-[#444444]',               shape: '○' },
  group_stage: { label: 'Fase de grupos', dot: 'bg-[#C8F135] animate-pulse', shape: '▶' },
  finals:      { label: 'Finais',         dot: 'bg-amber-400 animate-pulse', shape: '◆' },
  done:        { label: 'Encerrado',      dot: 'bg-emerald-400',             shape: '✓' },
}

export default function CategoryHub(props: HubProps) {
  const { tournament, category, finalsSeeds } = props
  const [tab, setTab] = useState<TabId>('matches')

  const groupMatches  = props.matches.filter(m => m.stage === 'group_a' || m.stage === 'group_b')
  const finalsMatches = props.matches.filter(m => m.stage === 'final' || m.stage === 'consolation_final')
  const allGroupDone  = groupMatches.length === 6 && groupMatches.every(m => m.status === 'done')
  const infoAlert     = category.status === 'draft' || finalsSeeds !== null

  const matchesTabProps = { ...props, allGroupDone, finalsMatches, groupMatches }

  return (
    <div>
      <DesktopBanner tournament={tournament} category={category} rules={props.rules} />
      <MobileBanner  tournament={tournament} category={category} />

      {/* Mobile */}
      <div className="lg:hidden pt-4 pb-24">
        {tab === 'matches' && <MatchesTab {...matchesTabProps} />}
        {tab === 'ranking' && <RankingTab  {...props} />}
        {tab === 'bracket' && <BracketTab  {...props} finalsMatches={finalsMatches} />}
        {tab === 'info'    && <InfoTab     {...props} />}
      </div>

      {/* Desktop */}
      <div className="hidden lg:grid grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_440px] gap-8 pt-6 items-start">
        <div>
          <MatchesTab {...matchesTabProps} />
        </div>
        <div className="sticky top-24 space-y-6 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
          {(category.status === 'draft' || finalsSeeds) && (
            <InfoActionsCard {...props} />
          )}
          <RankingTab {...props} />
          <BracketTab {...props} finalsMatches={finalsMatches} />
        </div>
      </div>

      {/* Mobile bottom tabs */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0A0A0A]/95 backdrop-blur-sm border-t border-[#242424]">
        <div className="max-w-md mx-auto grid grid-cols-4 px-2 pb-safe">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex flex-col items-center gap-0.5 py-3 text-center transition-colors ${
                tab === t.id ? 'text-[#C8F135]' : 'text-[#888888]'
              }`}
            >
              <span className="text-xl leading-none">{t.icon}</span>
              <span className={`text-[10px] font-bold ${tab === t.id ? 'text-[#C8F135]' : 'text-[#888888]'}`}>
                {t.label}
              </span>
              {t.id === 'info' && infoAlert && tab !== 'info' && (
                <span className="absolute top-2 right-4 w-2 h-2 bg-amber-400 rounded-full" />
              )}
              {tab === t.id && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#C8F135] rounded-full" />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

// ── Banners ───────────────────────────────────────────────────

function DesktopBanner({ tournament, category, rules }: { tournament: Tournament; category: Category; rules: MatchRules }) {
  const cfg  = STATUS_CFG[category.status] ?? STATUS_CFG.draft
  const done = category.status === 'done'

  return (
    <div className={`hidden lg:flex items-center justify-between rounded-2xl px-7 py-5 text-white overflow-hidden relative ${
      done ? 'bg-gradient-to-br from-emerald-700 to-emerald-900' : 'bg-gradient-to-br from-[#161616] to-[#0A0A0A] border border-[#242424]'
    }`}>
      <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full pointer-events-none" style={{ background: done ? 'rgba(255,255,255,0.05)' : 'var(--bt-neon-dim)' }} />
      <div className="flex items-center gap-4">
        <BackLink href={`/admin/tournaments/${tournament.id}`} label={tournament.name} className="text-white/50 hover:text-white/80 text-sm font-bold shrink-0" />
        <div className="w-px h-5 bg-white/20" />
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight leading-tight">{category.name}</h1>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {category.scheduled_at && (
          <ScheduledBadge scheduledAt={category.scheduled_at} />
        )}
        <span className="text-xs font-bold text-white/50 bg-white/10 px-3 py-1.5 rounded-full">
          {rulesHint(rules)}
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
          <span className="text-sm font-black text-white/80">{cfg.shape} {cfg.label}</span>
        </div>
      </div>
    </div>
  )
}

function MobileBanner({ tournament, category }: { tournament: Tournament; category: Category }) {
  const cfg  = STATUS_CFG[category.status] ?? STATUS_CFG.draft
  const done = category.status === 'done'

  return (
    <div className={`lg:hidden relative rounded-2xl px-5 py-4 text-white overflow-hidden ${
      done ? 'bg-gradient-to-br from-emerald-700 to-emerald-900' : 'bg-gradient-to-br from-[#161616] to-[#0A0A0A] border border-[#242424]'
    }`}>
      <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/5" />
      <div className="relative">
        <BackLink href={`/admin/tournaments/${tournament.id}`} label={tournament.name} className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white/60 mb-1" />
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          <span className="text-[10px] font-black uppercase tracking-widest text-white/50">{cfg.shape} {cfg.label}</span>
        </div>
        <h1 className="font-display text-xl font-bold uppercase leading-tight">{category.name}</h1>
        {category.scheduled_at && (
          <div className="mt-2">
            <ScheduledBadge scheduledAt={category.scheduled_at} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Scheduled time badge ──────────────────────────────────────

function ScheduledBadge({ scheduledAt }: { scheduledAt: string }) {
  const d   = new Date(scheduledAt)
  const now = new Date()
  const started = d <= now
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
      started
        ? 'bg-emerald-500/20 text-emerald-300'
        : 'bg-amber-500/20 text-amber-300'
    }`}>
      {started ? '✓' : '🕐'}
      {started ? 'Iniciado' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
    </span>
  )
}

// ── Info actions card ─────────────────────────────────────────

function InfoActionsCard({ tournament, category, players, rules, finalsSeeds, matchSeeds }: HubProps) {
  const supabase = createClient()
  const router   = useRouter()
  const groupA   = players.filter(p => p.position <= 4)
  const groupB   = players.filter(p => p.position >= 5)
  const canStart = category.status === 'draft' && players.length === 8

  // ── Scheduled time editor state
  function toLocalInput(iso: string | null): string {
    if (!iso) return ''
    const d = new Date(iso)
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }
  const [editingTime, setEditingTime] = useState(false)
  const [timeValue,   setTimeValue]   = useState(() => toLocalInput(category.scheduled_at))
  const [savingTime,  setSavingTime]  = useState(false)

  async function saveScheduledTime() {
    setSavingTime(true)
    await supabase
      .from('categories')
      .update({ scheduled_at: timeValue ? new Date(timeValue).toISOString() : null })
      .eq('id', category.id)
    setSavingTime(false)
    setEditingTime(false)
    router.refresh()
  }

  return (
    <div className="bg-[#161616] rounded-2xl border border-amber-500/30 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
        <span className="text-sm">⚙️</span>
        <p className="text-xs font-black text-amber-400 uppercase tracking-widest">Ações</p>
      </div>
      <div className="px-4 py-4 space-y-3">

        {/* ── Scheduled time ── */}
        <div className="border border-[#242424] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 bg-[#111111]">
            <div className="flex items-center gap-2">
              <span className="text-sm">🕐</span>
              <span className="text-xs font-black text-[#888888] uppercase tracking-wide">Horário de início</span>
            </div>
            <button
              onClick={() => setEditingTime(e => !e)}
              className="text-[10px] font-black text-[#C8F135] hover:text-[#C8F135] uppercase tracking-wider transition-colors"
            >
              {editingTime ? 'Cancelar' : category.scheduled_at ? 'Editar' : 'Definir'}
            </button>
          </div>
          {!editingTime && (
            <p className="px-3 py-2 text-sm font-bold text-[#F0F0F0]">
              {category.scheduled_at
                ? new Date(category.scheduled_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                : <span className="text-[#6B6B6B] font-medium">Sem horário definido — inicia imediatamente</span>}
            </p>
          )}
          {editingTime && (
            <div className="px-3 pb-3 pt-2 space-y-2 animate-fade-in">
              <input
                type="datetime-local"
                value={timeValue}
                onChange={e => setTimeValue(e.target.value)}
                className="w-full bg-[#161616] border-2 border-[#242424] focus:border-[#C8F135] rounded-lg px-3 py-2 text-sm font-semibold text-[#F0F0F0] focus:outline-none transition-colors"
              />
              <div className="flex gap-2">
                {timeValue && (
                  <button
                    onClick={() => { setTimeValue(''); saveScheduledTime() }}
                    className="flex-1 py-1.5 text-xs font-bold text-[#888888] border border-[#242424] rounded-lg hover:bg-[#111111] transition-colors"
                  >
                    Remover
                  </button>
                )}
                <button
                  onClick={saveScheduledTime}
                  disabled={savingTime}
                  className="flex-1 py-1.5 text-xs font-black text-[#0A0A0A] bg-[#C8F135] hover:bg-[#D4F54A] rounded-lg disabled:opacity-50 transition-colors"
                >
                  {savingTime ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Grupo A', list: groupA, color: 'bg-[#C8F135]' },
            { label: 'Grupo B', list: groupB, color: 'bg-[#C8F135]' },
          ].map(g => (
            <div key={g.label} className="space-y-1">
              <div className="flex items-center gap-1">
                <span className={`w-4 h-4 rounded text-white text-[9px] font-black flex items-center justify-center ${g.color}`}>
                  {g.label.slice(-1)}
                </span>
                <span className="text-[10px] font-bold text-[#888888]">{g.label}</span>
              </div>
              {g.list.map(p => (
                <p key={p.id} className="text-xs font-semibold text-[#888888] truncate pl-5">{p.name}</p>
              ))}
              {g.list.length === 0 && <p className="text-xs text-[#6B6B6B] pl-5">—</p>}
            </div>
          ))}
        </div>
        <p className="text-xs text-[#888888] font-medium border-t border-[#242424] pt-3">{rulesHint(rules)}</p>
        {canStart && (
          <div className="space-y-2 pt-1">
            <ShuffleGroupsButton tournamentId={tournament.id} categoryId={category.id} players={players} />
            <StartGroupStageButton tournamentId={tournament.id} categoryId={category.id} players={players} matchSeeds={matchSeeds} />
          </div>
        )}
        {finalsSeeds && (
          <GenerateFinalsButton tournamentId={tournament.id} categoryId={category.id} seeds={finalsSeeds} />
        )}
      </div>
    </div>
  )
}

// ── Matches tab ───────────────────────────────────────────────

interface MatchesTabProps extends HubProps {
  allGroupDone:  boolean
  finalsMatches: Match[]
  groupMatches:  Match[]
}

function MatchesTab({ tournament, category, players, matches, rules, finalsSeeds, allGroupDone, finalsMatches, groupMatches, courts }: MatchesTabProps) {
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]))
  const name      = (id: string) => playerMap[id]?.name ?? '?'

  const groupDone  = groupMatches.filter(m => m.status === 'done').length
  const finalsDone = finalsMatches.filter(m => m.status === 'done').length
  const totalDone  = matches.filter(m => m.status === 'done').length

  const sortedGroup  = [...groupMatches].sort((a, b) => a.stage.localeCompare(b.stage) || a.round - b.round)
  const sortedFinals = [...finalsMatches].sort((a, b) => a.stage === 'final' ? -1 : 1)

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-2 flex-wrap">
        <ProgressPill done={groupDone === 6}   label={`${groupDone}/6 grupos`}   color="sky" />
        {finalsMatches.length > 0 && (
          <ProgressPill done={finalsDone === 2} label={`${finalsDone}/2 finais`} color="amber" />
        )}
        {totalDone === matches.length && matches.length > 0 && (
          <span className="text-xs font-bold text-emerald-400 bg-emerald-50 px-2.5 py-1 rounded-full">✓ Todos concluídos</span>
        )}
      </div>

      <MatchDurationStats matches={matches} />

      {/* Finals CTA — mobile */}
      {finalsSeeds && (
        <div className="lg:hidden rounded-2xl overflow-hidden border border-amber-500/30 shadow-lg shadow-amber-50 animate-scale-in">
          <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-5 py-4 text-white">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Fase de grupos concluída</p>
            <p className="text-lg font-black">Hora das finais! ⚡</p>
          </div>
          <div className="bg-[#161616] px-5 py-4 space-y-3">
            {finalsSeeds.map(s => (
              <div key={s.stage} className="space-y-1.5">
                <p className="text-[10px] font-black text-amber-400 uppercase tracking-wide">
                  {s.stage === 'final' ? '🏆 Grande Final' : '🥉 Final Consolação'}
                </p>
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex-1">
                    <p className="font-bold text-[#F0F0F0]">{name(s.team1_p1)}</p>
                    <p className="font-bold text-[#F0F0F0]">{name(s.team1_p2)}</p>
                  </div>
                  <span className="text-[10px] font-black text-[#444444] tracking-widest">VS</span>
                  <div className="flex-1 text-right">
                    <p className="font-bold text-[#F0F0F0]">{name(s.team2_p1)}</p>
                    <p className="font-bold text-[#F0F0F0]">{name(s.team2_p2)}</p>
                  </div>
                </div>
                {s.stage === 'final' && <div className="h-px bg-[#1C1C1C] mt-2" />}
              </div>
            ))}
          </div>
          <div className="bg-[#161616] px-4 pb-4">
            <GenerateFinalsButton tournamentId={tournament.id} categoryId={category.id} seeds={finalsSeeds} />
          </div>
        </div>
      )}

      {/* Finals matches */}
      {sortedFinals.length > 0 && (
        <section className="space-y-2.5">
          <SectionLabel icon="⚡" label="Finais" color="text-amber-400" />
          <div className="stagger grid grid-cols-1 2xl:grid-cols-2 gap-2.5">
            {sortedFinals.map(m => (
              <MatchCard key={m.id} m={m} name={name} tournamentId={tournament.id} categoryId={category.id} rules={rules} courts={courts} scheduledAt={category.scheduled_at} />
            ))}
          </div>
        </section>
      )}

      {/* Group matches */}
      {(['group_a', 'group_b'] as const).map(stage => {
        const ms = sortedGroup.filter(m => m.stage === stage)
        if (!ms.length) return null
        const cfg = stage === 'group_a'
          ? { label: 'Grupo A', icon: '🅰️', color: 'text-[#C8F135]' }
          : { label: 'Grupo B', icon: '🅱️', color: 'text-[#C8F135]' }
        return (
          <section key={stage} className="space-y-2.5">
            <SectionLabel icon={cfg.icon} label={cfg.label} color={cfg.color} />
            <div className="stagger grid grid-cols-1 2xl:grid-cols-2 gap-2.5">
              {ms.map(m => (
                <MatchCard key={m.id} m={m} name={name} tournamentId={tournament.id} categoryId={category.id} rules={rules} courts={courts} scheduledAt={category.scheduled_at} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

// ── Ranking tab ───────────────────────────────────────────────

function RankingTab({ players, matches }: HubProps) {
  const groupA = players.filter(p => p.position <= 4)
  const groupB = players.filter(p => p.position >= 5)
  const rankA  = computeRanking(groupA, matches.filter(m => m.stage === 'group_a'))
  const rankB  = computeRanking(groupB, matches.filter(m => m.stage === 'group_b'))

  return (
    <div className="space-y-5 animate-fade-in">
      <GroupRankingSection label="Grupo A" color="bg-[#C8F135]"    textColor="text-[#C8F135]"    stats={rankA} />
      <GroupRankingSection label="Grupo B" color="bg-[#C8F135]" textColor="text-[#C8F135]" stats={rankB} />

      {rankA.some(s => s.wins + s.losses > 0) && rankB.some(s => s.wins + s.losses > 0) && (
        <section className="space-y-2">
          <SectionLabel icon="⚡" label="Projeção das finais" color="text-amber-400" />
          <div className="bg-[#161616] rounded-2xl border border-amber-100 shadow-sm overflow-hidden divide-y divide-[#242424]">
            {[
              { emoji: '🏆', label: 'Grande Final',     t1: [rankA[0], rankB[0]], t2: [rankA[1], rankB[1]] },
              { emoji: '🥉', label: 'Final Consolação', t1: [rankA[2], rankB[2]], t2: [rankA[3], rankB[3]] },
            ].map(row => (
              <div key={row.label} className="px-4 py-3.5 space-y-2">
                <p className="text-[10px] font-black text-[#888888] uppercase tracking-widest">{row.emoji} {row.label}</p>
                <div className="flex items-stretch gap-3">
                  <div className="flex-1 space-y-0.5">
                    {row.t1.map((s, i) => <p key={i} className="text-sm font-bold text-[#F0F0F0] truncate">{s?.player.name ?? '?'}</p>)}
                  </div>
                  <span className="flex items-center text-[10px] font-black text-[#444444] tracking-widest">VS</span>
                  <div className="flex-1 text-right space-y-0.5">
                    {row.t2.map((s, i) => <p key={i} className="text-sm font-bold text-[#F0F0F0] truncate">{s?.player.name ?? '?'}</p>)}
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

function GroupRankingSection({ label, color, textColor, stats }: {
  label: string; color: string; textColor: string; stats: PlayerStats[]
}) {
  const hasData = stats.some(s => s.wins + s.losses > 0)
  const icon    = label.includes('A') ? '🅰️' : '🅱️'

  return (
    <section className="space-y-2.5">
      <SectionLabel icon={icon} label={label} color={textColor} />
      {hasData && stats.length >= 3 && <RankingPodium stats={stats} color={color} />}
      <div className="rounded-2xl border border-[#242424] shadow-sm overflow-hidden" style={{ background: 'var(--bt-card)' }}>
        <div className="grid grid-cols-[2.5rem_2.25rem_1fr_auto] gap-3 px-4 py-2.5 bg-[#111111] border-b border-[#242424]">
          <span className="text-[10px] font-black text-[#888888]">#</span>
          <span />
          <span className="text-[10px] font-black text-[#888888] uppercase">Jogador</span>
          <span className="text-[10px] font-black text-[#888888] text-right">V · D · Saldo</span>
        </div>
        {!hasData && <p className="text-xs text-[#6B6B6B] font-medium px-4 py-4">Sem resultados ainda</p>}
        <div className="stagger">
          {stats.map((s, i) => {
            const isFirst = i === 0
            const isQualified = i < 2
            return (
              <div key={s.player.id} className={`grid grid-cols-[2.5rem_2.25rem_1fr_auto] gap-3 items-center px-4 border-b border-[#242424] last:border-0 ${isFirst ? 'py-3.5' : 'py-3'} ${isQualified ? 'bg-[#1C1C1C]' : ''}`}>
                <span className={`font-display font-bold tabular-nums leading-none ${isFirst ? 'text-2xl' : 'text-lg'}`}
                      style={{ color: isFirst ? 'var(--bt-neon)' : 'var(--bt-subtle)' }}>
                  {i + 1}
                </span>
                <div className={`rounded-full font-black flex items-center justify-center shrink-0 ${isFirst ? 'w-10 h-10 text-base' : 'w-9 h-9 text-sm'}`}
                     style={{ background: isQualified ? 'var(--bt-neon)' : 'var(--bt-elevated)', color: isQualified ? '#0A0A0A' : 'var(--bt-muted)' }}>
                  {s.player.name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex items-center gap-1.5">
                  {isFirst && <span className="text-base leading-none shrink-0">👑</span>}
                  <div className="min-w-0">
                    <p className={`font-bold truncate ${isFirst ? 'text-base' : 'text-sm'}`} style={{ color: 'var(--bt-text)' }}>{s.player.name}</p>
                    {isQualified && <p className="text-[10px] font-bold" style={{ color: 'var(--bt-neon)' }}>✓ Classificado</p>}
                  </div>
                </div>
                <div className="text-right shrink-0 flex items-center gap-2 justify-end">
                  <span className="font-display font-bold tabular-nums text-emerald-400" style={{ fontSize: isFirst ? '1.15rem' : '1rem' }}>{s.wins}V</span>
                  <span className="text-xs font-bold" style={{ color: 'var(--bt-subtle)' }}>·</span>
                  <span className="font-display font-bold tabular-nums" style={{ fontSize: isFirst ? '1.15rem' : '1rem', color: '#FF4444' }}>{s.losses}D</span>
                  <span className="text-xs font-black tabular-nums px-1.5 py-0.5 rounded shrink-0"
                        style={{ color: s.gameDiff >= 0 ? '#22C55E' : '#FF4444', background: s.gameDiff >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(255,68,68,0.12)' }}>
                    {s.gameDiff > 0 ? '+' : ''}{s.gameDiff}
                  </span>
                </div>
              </div>
            )
          })}
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
  const colors     = ['bg-[#C0C0C0]', color, 'bg-amber-700/50']
  // Silver and gold slots are both bright/light backgrounds — white text on
  // them is illegible, so they need dark text; bronze stays light-on-dark.
  const textColors = ['text-[#0A0A0A]', 'text-[#0A0A0A]', 'text-white']

  return (
    <div className="flex items-end justify-center gap-3 pt-2 pb-1">
      {order.map((s, col) => {
        if (!s) return <div key={col} className="w-20" />
        const rank = orderIdx[col]
        return (
          <div key={s.player.id} className="flex flex-col items-center gap-1 w-20">
            <span className="text-xl leading-none">{medals[col]}</span>
            <div className={`w-9 h-9 rounded-full font-black text-xs flex items-center justify-center ${colors[col]} ${textColors[col]}`}>
              {s.player.name[0]?.toUpperCase()}
            </div>
            <p className="text-[11px] font-bold text-[#888888] text-center truncate w-full px-1">{s.player.name}</p>
            <p className="text-[10px] font-bold text-[#888888]">{s.wins}V {s.gameDiff > 0 ? '+' : ''}{s.gameDiff}</p>
            <div className={`w-full rounded-t-lg ${heights[col]} ${colors[col]} flex items-center justify-center`}>
              <span className={`font-black text-base ${textColors[col]}`}>{rank + 1}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Bracket tab ───────────────────────────────────────────────

function BracketTab({ players, matches, finalsMatches }: HubProps & { finalsMatches: Match[] }) {
  const playerMap        = Object.fromEntries(players.map(p => [p.id, p]))
  const name             = (id: string) => playerMap[id]?.name ?? '?'
  const finalMatch       = finalsMatches.find(m => m.stage === 'final')
  const consolationMatch = finalsMatches.find(m => m.stage === 'consolation_final')

  if (!finalMatch && !consolationMatch) {
    return (
      <div className="animate-fade-in space-y-4">
        <div className="bg-[#161616] rounded-2xl border border-[#242424] shadow-sm px-5 py-8 text-center space-y-2">
          <p className="text-3xl">⚡</p>
          <p className="font-bold text-[#888888]">Finais ainda não geradas</p>
          <p className="text-sm text-[#888888]">Complete a fase de grupos para desbloquear as chaves</p>
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
          <div key={m.id} className={`rounded-2xl overflow-hidden border shadow-sm ${isFinal ? 'border-amber-500/30' : 'border-[#242424]'}`}>
            <div className={`px-4 py-2.5 flex items-center justify-between ${isFinal ? 'bg-gradient-to-r from-amber-400 to-orange-400' : 'bg-[#111111]'}`}>
              <span className={`text-xs font-black uppercase tracking-widest ${isFinal ? 'text-white' : 'text-[#888888]'}`}>
                {isFinal ? '🏆 Grande Final' : '🥉 Final Consolação'}
              </span>
              {isDone && (
                <span className={`text-[10px] font-black uppercase ${isFinal ? 'text-white/70' : 'text-emerald-400'}`}>✓ Concluído</span>
              )}
            </div>
            <div className={`px-5 py-5 grid grid-cols-[1fr_auto_1fr] gap-3 items-center ${isFinal ? 'bg-amber-50/30' : 'bg-[#161616]'}`}>
              <div className={`space-y-0.5 ${t1Wins ? '' : isDone ? 'opacity-50' : ''}`}>
                {[m.team1_p1, m.team1_p2].map((pid, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full text-white text-[10px] font-black flex items-center justify-center shrink-0 ${t1Wins ? 'bg-emerald-500' : isFinal ? 'bg-amber-300' : 'bg-[#1C1C1C]'}`}>
                      {name(pid)[0]?.toUpperCase()}
                    </div>
                    <p className={`text-sm font-bold truncate ${t1Wins ? 'text-emerald-400' : 'text-[#F0F0F0]'}`}>{name(pid)}</p>
                  </div>
                ))}
                {isDone && <p className={`text-3xl font-black tabular-nums pt-1 ${t1Wins ? 'text-emerald-400' : 'text-[#6B6B6B]'}`}>{m.score1}</p>}
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-black text-[#444444] tracking-widest">VS</span>
              </div>
              <div className={`space-y-0.5 text-right ${t2Wins ? '' : isDone ? 'opacity-50' : ''}`}>
                {[m.team2_p1, m.team2_p2].map((pid, i) => (
                  <div key={i} className="flex items-center gap-2 flex-row-reverse">
                    <div className={`w-7 h-7 rounded-full text-white text-[10px] font-black flex items-center justify-center shrink-0 ${t2Wins ? 'bg-emerald-500' : isFinal ? 'bg-amber-300' : 'bg-[#1C1C1C]'}`}>
                      {name(pid)[0]?.toUpperCase()}
                    </div>
                    <p className={`text-sm font-bold truncate ${t2Wins ? 'text-emerald-400' : 'text-[#F0F0F0]'}`}>{name(pid)}</p>
                  </div>
                ))}
                {isDone && <p className={`text-3xl font-black tabular-nums pt-1 text-right ${t2Wins ? 'text-emerald-400' : 'text-[#6B6B6B]'}`}>{m.score2}</p>}
              </div>
            </div>
            {!isDone && (
              <div className={`px-4 py-2 border-t text-center text-[11px] font-bold ${isFinal ? 'border-amber-100 text-amber-500 bg-amber-50/30' : 'border-[#242424] text-[#888888] bg-[#111111]'}`}>
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
    { label: 'Grupo A', stage: 'group_a', color: 'bg-[#C8F135]' },
    { label: 'Grupo B', stage: 'group_b', color: 'bg-[#C8F135]' },
  ]
  return (
    <div className="space-y-3">
      {groups.map(g => {
        const ms = matches.filter(m => m.stage === g.stage).sort((a, b) => a.round - b.round)
        if (!ms.length) return null
        return (
          <div key={g.stage} className="bg-[#161616] rounded-2xl border border-[#242424] shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-[#111111] border-b border-[#242424] flex items-center gap-2">
              <span className={`w-5 h-5 rounded text-white text-[10px] font-black flex items-center justify-center ${g.color}`}>{g.label.slice(-1)}</span>
              <span className="text-xs font-black text-[#888888] uppercase tracking-wide">{g.label}</span>
            </div>
            <div className="divide-y divide-[#242424]">
              {ms.map(m => {
                const done   = m.status === 'done'
                const t1Wins = done && (m.score1 ?? 0) > (m.score2 ?? 0)
                const t2Wins = done && (m.score2 ?? 0) > (m.score1 ?? 0)
                return (
                  <div key={m.id} className="px-4 py-3 flex items-center gap-3">
                    <span className="text-[10px] font-black text-[#6B6B6B] w-4">R{m.round}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold truncate ${t1Wins ? 'text-emerald-400' : 'text-[#F0F0F0]'}`}>
                        {name(m.team1_p1)} + {name(m.team1_p2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {done ? (
                        <>
                          <span className={`text-sm font-black tabular-nums ${t1Wins ? 'text-emerald-400' : 'text-[#6B6B6B]'}`}>{m.score1}</span>
                          <span className="text-[10px] text-[#444444] font-bold">×</span>
                          <span className={`text-sm font-black tabular-nums ${t2Wins ? 'text-emerald-400' : 'text-[#6B6B6B]'}`}>{m.score2}</span>
                        </>
                      ) : (
                        <span className="text-[10px] font-bold text-[#6B6B6B]">—</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <p className={`text-xs font-bold truncate ${t2Wins ? 'text-emerald-400' : 'text-[#F0F0F0]'}`}>
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

// ── Info tab ──────────────────────────────────────────────────

function InfoTab({ tournament, category, players, rules, finalsSeeds, matchSeeds }: HubProps) {
  const groupA   = players.filter(p => p.position <= 4)
  const groupB   = players.filter(p => p.position >= 5)
  const canStart = category.status === 'draft' && players.length === 8

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="bg-[#161616] rounded-2xl border border-[#242424] shadow-sm px-4 py-4 space-y-2">
        <p className="text-[10px] font-black text-[#888888] uppercase tracking-widest">Regras</p>
        <p className="text-sm font-bold text-[#F0F0F0]">{rulesHint(rules)}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Grupo A', list: groupA, color: 'bg-[#C8F135]' },
          { label: 'Grupo B', list: groupB, color: 'bg-[#C8F135]' },
        ].map(g => (
          <div key={g.label} className="bg-[#161616] rounded-2xl p-3 shadow-sm border border-[#242424] space-y-2">
            <div className="flex items-center gap-1.5">
              <span className={`w-5 h-5 rounded text-white text-[10px] font-black flex items-center justify-center ${g.color}`}>{g.label.slice(-1)}</span>
              <span className="text-xs font-bold text-[#888888]">{g.label}</span>
            </div>
            <div className="space-y-1.5">
              {g.list.map(p => (
                <div key={p.id} className="flex items-center gap-2 bg-[#111111] rounded-xl px-2.5 py-1.5">
                  <div className={`w-6 h-6 rounded-full text-white text-[10px] font-black flex items-center justify-center shrink-0 ${g.color}`}>
                    {p.name[0]?.toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold text-[#F0F0F0] truncate">{p.name}</span>
                </div>
              ))}
              {g.list.length === 0 && <p className="text-xs text-[#6B6B6B] px-1">Sem jogadores</p>}
            </div>
          </div>
        ))}
      </div>
      {canStart && (
        <div className="space-y-2.5">
          <ShuffleGroupsButton tournamentId={tournament.id} categoryId={category.id} players={players} />
          <StartGroupStageButton tournamentId={tournament.id} categoryId={category.id} players={players} matchSeeds={matchSeeds} />
        </div>
      )}
      {finalsSeeds && (
        <GenerateFinalsButton tournamentId={tournament.id} categoryId={category.id} seeds={finalsSeeds} />
      )}
    </div>
  )
}

// ── Shared primitives ─────────────────────────────────────────

function ProgressPill({ label, color, done }: { label: string; color: 'sky' | 'amber'; done: boolean }) {
  if (done) return (
    <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-50 px-2.5 py-1 rounded-full">✓ {label}</span>
  )
  const cls = color === 'amber' ? 'text-amber-400 bg-amber-50' : 'text-[#C8F135] bg-[#1C1C1C]'
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
