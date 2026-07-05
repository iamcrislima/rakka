'use client'

/**
 * Super8MistoHub — dedicated view for the Super Oito Misto format.
 * Deliberately separate from CategoryHub: no bracket, no fixed pairs,
 * no group A/B split — just 8 rounds of rotating mixed doubles and an
 * individual Rei/Rainha da Quadra leaderboard.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Tournament, Category, Player, Match, MatchRules, Court, PlayerGender } from '@/types'
import type { MatchSeed } from '@/lib/match-generator'
import { computeSuper8MistoResult, getCurrentSuper8MistoRound, type Super8MistoValidation, SUPER8_MISTO_MATCHES, SUPER8_MISTO_ROUNDS } from '@/lib/super8-misto'
import { computeRoundSchedule, type RoundPrediction } from '@/lib/round-schedule'
import { rulesHint } from '@/lib/match-rules'
import MatchCard, { MatchDurationStats } from '../../MatchCard'
import StartGroupStageButton from '../../StartGroupStageButton'
import BackLink from '@/app/components/BackLink'

type TabId = 'matches' | 'players' | 'ranking'

interface HubProps {
  tournament: Tournament
  category:   Category
  players:    Player[]
  matches:    Match[]
  rules:      MatchRules
  validation: Super8MistoValidation
  matchSeeds: MatchSeed[]
  courts?:    Court[]
}

export default function Super8MistoHub(props: HubProps) {
  const { tournament, category, matches } = props
  const [tab, setTab] = useState<TabId>('matches')
  const hasMatches = matches.length > 0
  const matchesComplete = hasMatches && matches.every(m => m.status === 'done')
  const allDone    = matchesComplete && category.status !== 'done'

  return (
    <div>
      <Banner tournament={tournament} category={category} rules={props.rules} />

      {/* Mobile tabs */}
      {hasMatches && (
        <div className="lg:hidden flex gap-1 mt-4 bg-[#1C1C1C] rounded-xl p-1">
          {(['matches', 'players', 'ranking'] as TabId[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-xs font-black transition-colors ${
                tab === t ? 'bg-[#161616] text-[#C8F135] shadow-sm' : 'text-[#888888]'
              }`}
            >
              {t === 'matches' ? '🔀 Partidas' : t === 'players' ? '👤 Jogadores' : '👑 Ranking'}
            </button>
          ))}
        </div>
      )}

      <div className="lg:hidden pt-4 pb-10">
        {!hasMatches
          ? <SetupPanel {...props} />
          : tab === 'matches' ? <MatchesPanel {...props} />
          : tab === 'players' ? <PlayersPanel {...props} />
          : <RankingPanel {...props} />}
        {matchesComplete && <CeremonyLink tournamentId={tournament.id} categoryId={category.id} />}
        {allDone && <FinishCategoryButton categoryId={category.id} />}
      </div>

      {/* Desktop */}
      <div className="hidden lg:grid grid-cols-[minmax(0,1fr)_400px] gap-8 pt-6 items-start">
        <div>
          {!hasMatches ? <SetupPanel {...props} /> : <MatchesPanel {...props} />}
        </div>
        <div className="sticky top-24 space-y-4">
          {hasMatches && <PlayersPanel {...props} />}
          {hasMatches && <RankingPanel {...props} />}
          {matchesComplete && <CeremonyLink tournamentId={tournament.id} categoryId={category.id} />}
          {allDone && <FinishCategoryButton categoryId={category.id} />}
        </div>
      </div>
    </div>
  )
}

// ── Ceremony link — enabled only once every match in THIS category is
// done; opens in a new tab since it typically runs on a separate physical
// screen while the organizer keeps working here (same reasoning as Modo TV). ──

function CeremonyLink({ tournamentId, categoryId }: { tournamentId: string; categoryId: string }) {
  return (
    <a
      href={`/t/${tournamentId}/tv/revelacao?categoryId=${categoryId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-wide transition-transform active:scale-[0.97]"
      style={{ background: '#C8F135', color: '#0A0A0A' }}
    >
      🎉 Cerimônia de Revelação
    </a>
  )
}

// ── Banner ────────────────────────────────────────────────────

function Banner({ tournament, category, rules }: { tournament: Tournament; category: Category; rules: MatchRules }) {
  const done = category.status === 'done'
  return (
    <div className={`rounded-2xl px-5 lg:px-7 py-4 lg:py-5 text-white overflow-hidden relative ${
      done ? 'bg-gradient-to-br from-emerald-700 to-emerald-900' : 'bg-gradient-to-br from-violet-700 to-fuchsia-800'
    }`}>
      <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
      <div className="relative flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <BackLink href={`/admin/tournaments/${tournament.id}`} label={tournament.name} className="text-white/50 hover:text-white/80 text-sm font-bold shrink-0" />
          <div className="w-px h-5 bg-white/20 hidden lg:block" />
          <h1 className="font-display text-xl lg:text-2xl font-bold uppercase tracking-tight leading-tight truncate">{category.name}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-black uppercase tracking-widest bg-white/15 px-2.5 py-1 rounded-full">
            🔀 Super Oito Misto
          </span>
          <span className="text-xs font-bold text-white/60 bg-white/10 px-3 py-1.5 rounded-full">
            {rulesHint(rules)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Setup panel (before rounds are generated) ────────────────

function SetupPanel({ tournament, category, players, matchSeeds, validation, courts }: HubProps) {
  const router = useRouter()
  const men   = players.filter(p => p.gender === 'M')
  const women = players.filter(p => p.gender === 'F')

  async function deletePlayer(id: string) {
    const supabase = createClient()
    await supabase.from('players').delete().eq('id', id)
    router.refresh()
  }

  async function renamePlayer(id: string, name: string) {
    const supabase = createClient()
    await supabase.from('players').update({ name }).eq('id', id)
    router.refresh()
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-[#161616] rounded-2xl border border-[#242424] shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <p className="text-xs font-black text-[#888888] uppercase tracking-widest">Jogadores cadastrados</p>
          <span className="text-xs font-bold text-[#888888]">{men.length}/8 homens · {women.length}/8 mulheres</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <PlayerCount label="Homens"   list={men}   color="bg-[#C8F135]" needed={8} onDelete={deletePlayer} onRename={renamePlayer} />
          <PlayerCount label="Mulheres" list={women} color="bg-pink-500"   needed={8} onDelete={deletePlayer} onRename={renamePlayer} />
        </div>
        {!validation.valid && (
          <p className="text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            ⚠️ {validation.error}
          </p>
        )}
        <AddPlayerForm tournamentId={tournament.id} categoryId={category.id} menCount={men.length} womenCount={women.length} />
      </div>

      <ScheduleAndCourtsCard tournament={tournament} category={category} courts={courts ?? []} />

      {validation.valid && (
        <div className="bg-[#161616] rounded-2xl border border-[#242424] shadow-sm p-5 space-y-3">
          <p className="text-sm font-bold text-[#F0F0F0]">
            8 rodadas · {SUPER8_MISTO_MATCHES} partidas · cada homem joga com cada mulher exatamente uma vez
          </p>
          <StartGroupStageButton
            tournamentId={tournament.id}
            categoryId={category.id}
            players={players}
            matchSeeds={matchSeeds}
            label="▶ Gerar Rodadas"
            hasCourts={(courts ?? []).length > 0}
          />
        </div>
      )}
    </div>
  )
}

function PlayerCount({ label, list, color, needed, onDelete, onRename }: {
  label: string; list: Player[]; color: string; needed: number
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => Promise<void>
}) {
  const ok = list.length === needed
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#888888]">{label}</span>
        <span className={`text-xs font-black px-1.5 py-0.5 rounded-full ${ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[#1C1C1C] text-[#888888]'}`}>
          {list.length}/{needed}
        </span>
      </div>
      <div className="space-y-1">
        {list.map(p => (
          <PlayerRow key={p.id} player={p} color={color} onRename={onRename} onDelete={onDelete} />
        ))}
        {list.length === 0 && <p className="text-[11px] text-[#6B6B6B]">—</p>}
      </div>
    </div>
  )
}

// ── Player row — name is always editable in place (pencil icon); gender is
// never editable through this UI at all (pre- or post-generation) — changing
// a player's gender would require re-running the man/woman rotation algorithm,
// so the only supported path for that is delete + re-add. Delete itself is
// only offered pre-generation (no `onDelete`), since once rounds exist every
// match references these player ids directly. ──
function PlayerRow({ player, color, onRename, onDelete }: {
  player:   Player
  color:    string
  onRename: (id: string, name: string) => Promise<void>
  onDelete?: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue]     = useState(player.name)
  const [saving, setSaving]   = useState(false)

  async function save() {
    const trimmed = value.trim()
    if (!trimmed || trimmed === player.name) { setValue(player.name); setEditing(false); return }
    setSaving(true)
    await onRename(player.id, trimmed)
    setSaving(false)
    setEditing(false)
  }

  function cancel() {
    setValue(player.name)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 bg-[#111111] rounded-lg px-2 py-1 border border-[#C8F135]/40">
        <input
          autoFocus
          value={value}
          disabled={saving}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
          className="flex-1 min-w-0 bg-transparent text-[11px] font-semibold text-[#F0F0F0] focus:outline-none"
        />
        <button type="button" onClick={save} disabled={saving || !value.trim()} className="text-[#C8F135] text-xs font-black shrink-0 disabled:opacity-40">✓</button>
        <button type="button" onClick={cancel} disabled={saving} className="text-[#6B6B6B] hover:text-[#F0F0F0] transition-colors text-xs font-black shrink-0">✕</button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 bg-[#111111] rounded-lg px-2 py-1">
      <span className={`w-4 h-4 rounded-full text-white text-[8px] font-black flex items-center justify-center shrink-0 ${color}`}>
        {player.name[0]?.toUpperCase()}
      </span>
      <span className="flex-1 text-[11px] font-semibold text-[#888888] truncate">{player.name}</span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Editar nome"
        className="text-[#6B6B6B] hover:text-[#C8F135] transition-colors text-xs shrink-0"
      >
        ✎
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(player.id)}
          className="text-[#6B6B6B] hover:text-[#FF4444] transition-colors text-xs font-black px-0.5 shrink-0"
        >
          ×
        </button>
      )}
    </div>
  )
}

// ── Add player form ───────────────────────────────────────────

function AddPlayerForm({ tournamentId, categoryId, menCount, womenCount }: {
  tournamentId: string; categoryId: string; menCount: number; womenCount: number
}) {
  const router = useRouter()
  const [name, setName]     = useState('')
  const [gender, setGender] = useState<PlayerGender>('M')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const count = gender === 'M' ? menCount : womenCount
  const full  = count >= 8

  async function add() {
    const trimmed = name.trim()
    if (!trimmed || full || saving) return
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.from('players').insert({
      tournament_id: tournamentId,
      category_id:   categoryId,
      name:          trimmed,
      gender,
      position:      count + 1,
    })
    if (err) { setError(err.message); setSaving(false); return }
    setName('')
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="border-t border-[#242424] pt-3 space-y-2">
      <p className="text-[10px] font-black text-[#888888] uppercase tracking-widest">Adicionar jogador</p>
      <div className="flex gap-2">
        <div className="flex rounded-xl overflow-hidden border-2 border-[#242424] shrink-0">
          {(['M', 'F'] as const).map(g => (
            <button
              key={g}
              type="button"
              onClick={() => setGender(g)}
              className={`px-3 py-2 text-xs font-black transition-colors ${
                gender === g
                  ? g === 'M' ? 'bg-[#C8F135] text-[#0A0A0A]' : 'bg-pink-500 text-[#0A0A0A]'
                  : 'bg-[#111111] text-[#888888]'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder={gender === 'M' ? 'Nome do homem' : 'Nome da mulher'}
          className="flex-1 min-w-0 bg-[#111111] border-2 border-[#242424] focus:border-[#C8F135] rounded-xl px-3 py-2 text-sm font-semibold text-[#F0F0F0] focus:outline-none transition-colors"
        />
        <button
          type="button"
          onClick={add}
          disabled={saving || !name.trim() || full}
          className="px-4 py-2 bg-[#C8F135] text-[#0A0A0A] text-sm font-black rounded-xl disabled:opacity-40 hover:bg-[#D4F54A] transition-colors shrink-0"
        >
          +
        </button>
      </div>
      {full && <p className="text-[11px] text-[#888888]">{gender === 'M' ? 'Homens' : 'Mulheres'} completo (8/8)</p>}
      {error && <p className="text-[11px] text-[#FF4444] font-semibold">{error}</p>}
    </div>
  )
}

// ── Schedule + courts card ──────────────────────────────────────
// Real data only: category.scheduled_at (editable here) and the actual
// courts row count for this tournament (managed on /tv-admin — linked,
// not duplicated, since courts are tournament-scoped, not per-category).

function ScheduleAndCourtsCard({ tournament, category, courts }: {
  tournament: Tournament; category: Category; courts: Court[]
}) {
  const router   = useRouter()
  const supabase = createClient()

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

  // ── Round interval — default gap used to stagger PREDICTED round start
  // times before any real match duration exists (see lib/round-schedule.ts).
  const [intervalValue, setIntervalValue] = useState(category.round_interval_minutes ?? 30)
  const [savingInterval, setSavingInterval] = useState(false)

  async function saveInterval(minutes: number) {
    const clamped = Math.max(5, Math.min(120, minutes))
    setIntervalValue(clamped)
    setSavingInterval(true)
    await supabase.from('categories').update({ round_interval_minutes: clamped }).eq('id', category.id)
    setSavingInterval(false)
    router.refresh()
  }

  return (
    <div className="bg-[#161616] rounded-2xl border border-[#242424] shadow-sm p-5 space-y-3">
      {/* Scheduled time */}
      <div className="border border-[#242424] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 bg-[#111111]">
          <div className="flex items-center gap-2">
            <span className="text-sm">🕐</span>
            <span className="text-xs font-black text-[#888888] uppercase tracking-wide">Horário de início</span>
          </div>
          <button
            onClick={() => setEditingTime(e => !e)}
            className="text-[10px] font-black text-[#C8F135] uppercase tracking-wider transition-colors"
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

      {/* Round interval — only matters once a start time is set; it's the
          default gap used to predict round 2+ before real durations exist. */}
      {category.scheduled_at && (
        <div className="flex items-center justify-between px-3 py-2.5 bg-[#111111] border border-[#242424] rounded-xl gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm shrink-0">⏱️</span>
            <span className="text-xs font-black text-[#888888] uppercase tracking-wide truncate">Intervalo entre rodadas</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <input
              type="number"
              min={5}
              max={120}
              step={5}
              value={intervalValue}
              onChange={e => setIntervalValue(Number(e.target.value))}
              onBlur={e => saveInterval(Number(e.target.value))}
              disabled={savingInterval}
              className="w-14 text-center bg-[#161616] border-2 border-[#242424] focus:border-[#C8F135] rounded-lg py-1 text-sm font-black text-[#F0F0F0] focus:outline-none
                         [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-xs text-[#888888] font-semibold">min</span>
          </div>
        </div>
      )}

      {/* Courts — tournament-scoped, managed in /tv-admin. Carries where we
          came from so the organizer can jump straight back to this category
          instead of re-navigating Torneios → Torneio → Categoria from scratch. */}
      <Link
        href={`/admin/tournaments/${tournament.id}/tv-admin?from=${encodeURIComponent(`/admin/tournaments/${tournament.id}/categories/${category.id}`)}&label=${encodeURIComponent(category.name)}`}
        className="flex items-center justify-between px-3 py-2.5 bg-[#111111] border border-[#242424] rounded-xl hover:border-[#3a3a3a] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">🏟️</span>
          <span className="text-xs font-black text-[#888888] uppercase tracking-wide">
            {courts.length} quadra{courts.length !== 1 ? 's' : ''} cadastrada{courts.length !== 1 ? 's' : ''}
          </span>
        </div>
        <span className="text-[10px] font-black text-[#C8F135] uppercase tracking-wider">Gerenciar →</span>
      </Link>
    </div>
  )
}

// ── Matches panel ─────────────────────────────────────────────

function MatchesPanel({ tournament, category, players, matches, rules, courts }: HubProps) {
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]))
  const name      = (id: string) => playerMap[id]?.name ?? '?'
  const done      = matches.filter(m => m.status === 'done').length

  const nextMatch = [...matches].sort((a, b) => a.round - b.round).find(m => m.status === 'pending')

  const rounds = Array.from({ length: SUPER8_MISTO_ROUNDS }, (_, i) => i + 1)
    .map(r => matches.filter(m => m.round === r))
    .filter(ms => ms.length > 0)

  // Tick every 30s so "Atrasado" flips on automatically without a manual refresh.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  const schedule = computeRoundSchedule(matches, category.scheduled_at, category.round_interval_minutes ?? 30, new Date(now))

  // ── Deep-link from the "Jogos ao vivo" panel on the tournament page —
  // ?focus=<matchId> scrolls straight to that card and rings it briefly,
  // instead of leaving the organizer to hunt through every round. ──
  const focusId = useSearchParams().get('focus')
  useEffect(() => {
    if (!focusId) return
    const el = document.getElementById(`match-${focusId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusId])

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
          done === matches.length ? 'text-emerald-400 bg-emerald-50' : 'text-[#C8F135] bg-[#1C1C1C]'
        }`}>
          {done}/{matches.length} partidas concluídas
        </span>
      </div>

      {nextMatch && <NextMatchCard match={nextMatch} name={name} courts={courts} />}

      <MatchDurationStats matches={matches} />

      {rounds.map((ms, idx) => {
        const prediction = schedule.get(ms[0].round)
        return (
          <section key={idx} className="space-y-2.5">
            <div className="flex items-center gap-2 px-0.5 flex-wrap">
              <span className="text-xs font-black uppercase tracking-widest text-[#C8F135]">Rodada {ms[0].round}</span>
              {prediction && !prediction.isComplete && <RoundTimingBadge prediction={prediction} />}
            </div>
            <div className="stagger grid grid-cols-1 2xl:grid-cols-2 gap-2.5">
              {ms.map(m => (
                <div
                  key={m.id}
                  id={`match-${m.id}`}
                  className={m.id === focusId ? 'rounded-2xl ring-2 ring-[#C8F135] transition-shadow' : ''}
                >
                  <MatchCard
                    m={m}
                    name={name}
                    tournamentId={tournament.id}
                    categoryId={category.id}
                    rules={rules}
                    courts={courts}
                    scheduledAt={category.scheduled_at}
                  />
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

// ── Round timing badge — "Previsto: HH:MM" for an estimate, or "Atrasado"
// once the current time has passed a round's predicted start without it
// having begun. Purely informational — doesn't gate/lock anything (that's
// MatchCard's separate scheduledAt-based lock, used only for round 1). ──
function RoundTimingBadge({ prediction }: { prediction: RoundPrediction }) {
  const time = prediction.predictedStart.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  if (prediction.isDelayed) {
    return (
      <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">
        ⚠️ Atrasado — previsto {time}
      </span>
    )
  }

  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1C1C1C] text-[#888888]">
      🕐 Previsto: {time}
    </span>
  )
}

// ── Next match — highlighted so an organizer can find it at a glance ──

function NextMatchCard({ match, name, courts }: {
  match: Match; name: (id: string) => string; courts?: Court[]
}) {
  const court = courts?.find(c => c.id === match.court_id)
  return (
    <div className="rounded-2xl border-2 border-[#C8F135] bg-[#1C1C1C] px-4 sm:px-5 py-4 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#C8F135]">▶ Próximo jogo · Rodada {match.round}</span>
        <span
          className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full"
          style={
            court
              ? { background: 'rgba(34,197,94,0.15)', color: '#22C55E' }
              : { background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }
          }
        >
          {court ? `📍 ${court.name}` : '⚠️ Sem quadra atribuída'}
        </span>
      </div>
      <div className="flex items-center justify-center gap-3 text-center">
        <span className="font-display text-base sm:text-lg font-bold text-[#F0F0F0]">
          {name(match.team1_p1)} + {name(match.team1_p2)}
        </span>
        <span className="text-xs font-black text-[#444444] shrink-0">vs</span>
        <span className="font-display text-base sm:text-lg font-bold text-[#F0F0F0]">
          {name(match.team2_p1)} + {name(match.team2_p2)}
        </span>
      </div>
    </div>
  )
}

// ── Players panel (post-generation) — name-only edit. Once rounds are
// generated every match references these player ids directly, so no
// add/delete here — just a way to fix a typo without redoing the draw. ──

function PlayersPanel({ players }: HubProps) {
  const router = useRouter()
  const men   = players.filter(p => p.gender === 'M')
  const women = players.filter(p => p.gender === 'F')

  async function renamePlayer(id: string, name: string) {
    const supabase = createClient()
    await supabase.from('players').update({ name }).eq('id', id)
    router.refresh()
  }

  return (
    <div className="bg-[#161616] rounded-2xl border border-[#242424] shadow-sm p-4 space-y-3 animate-fade-in">
      <p className="text-[10px] font-black text-[#888888] uppercase tracking-widest">Jogadores cadastrados</p>
      <p className="text-[11px] text-[#6B6B6B] -mt-2">Toque no lápis para corrigir um nome</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-[#888888]">Homens</span>
          <div className="space-y-1">
            {men.map(p => <PlayerRow key={p.id} player={p} color="bg-[#C8F135]" onRename={renamePlayer} />)}
          </div>
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-[#888888]">Mulheres</span>
          <div className="space-y-1">
            {women.map(p => <PlayerRow key={p.id} player={p} color="bg-pink-500" onRename={renamePlayer} />)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Ranking panel — Rei / Rainha da Quadra ────────────────────

// Same "hide from round 5" rule as the TV mode's ranking rotator — but here
// it's just the DEFAULT, since anyone glancing at the organizer's own screen
// (over the shoulder, or on the laptop itself) can otherwise see who's
// winning before the reveal. Always manually overridable, and remembered
// per category via localStorage.
function RankingPanel({ category, players, matches }: HubProps) {
  const { kingRanking, queenRanking } = computeSuper8MistoResult(players, matches)
  const round = getCurrentSuper8MistoRound(matches)
  const autoHideDefault = round >= 5
  const storageKey = `s8misto-ranking-hidden-${category.id}`

  const [hidden, setHidden] = useState<boolean | null>(null)
  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey)
    setHidden(stored !== null ? stored === '1' : autoHideDefault)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const isHidden = hidden ?? autoHideDefault

  function toggle() {
    const next = !isHidden
    window.localStorage.setItem(storageKey, next ? '1' : '0')
    setHidden(next)
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#161616] border border-[#242424] hover:border-[#3a3a3a] transition-colors"
      >
        <span className="text-xs font-bold text-[#888888]">
          {isHidden ? '🙈 Ranking oculto' : '👁️ Ranking visível'}
        </span>
        <span className="text-[10px] font-black uppercase tracking-widest text-[#C8F135]">
          {isHidden ? 'Mostrar' : 'Ocultar'}
        </span>
      </button>

      {isHidden ? (
        <div className="rounded-2xl border border-dashed border-[#242424] px-4 py-10 text-center">
          <p className="text-sm font-bold text-[#6B6B6B]">Ranking oculto — clique acima para mostrar</p>
        </div>
      ) : (
        <div className="space-y-5">
          <GenderRanking title="Rei da Quadra"    icon="👑" color="bg-[#C8F135]" textColor="text-[#C8F135]" stats={kingRanking} />
          <GenderRanking title="Rainha da Quadra" icon="👑" color="bg-pink-500"   textColor="text-pink-600"   stats={queenRanking} />
        </div>
      )}
    </div>
  )
}

function GenderRanking({ title, icon, color, textColor, stats }: {
  title: string; icon: string; color: string; textColor: string
  stats: ReturnType<typeof computeSuper8MistoResult>['kingRanking']
}) {
  const hasData = stats.some(s => s.wins + s.losses > 0)
  const champion = stats[0]

  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2 px-0.5">
        <span className="text-base leading-none">{icon}</span>
        <span className={`text-xs font-black uppercase tracking-widest ${textColor}`}>{title}</span>
      </div>

      {hasData && champion && (
        <div className={`rounded-2xl p-4 ${color} flex items-center gap-3 shadow-sm`} style={{ color: '#0A0A0A' }}>
          <span className="text-3xl leading-none">{icon}</span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{title}</p>
            <p className="text-lg font-black truncate">{champion.player.name}</p>
            <p className="text-xs font-bold opacity-80">
              {champion.wins}V · {champion.losses}D · saldo {champion.gameDiff > 0 ? '+' : ''}{champion.gameDiff}
            </p>
          </div>
        </div>
      )}

      <div className="bg-[#161616] rounded-2xl border border-[#242424] shadow-sm overflow-hidden">
        <div className="grid grid-cols-[1.75rem_2.25rem_1fr_auto] gap-3 px-4 py-2.5 bg-[#111111] border-b border-[#242424]">
          <span className="text-[10px] font-black text-[#888888]">#</span>
          <span />
          <span className="text-[10px] font-black text-[#888888] uppercase">Jogador</span>
          <span className="text-[10px] font-black text-[#888888] text-right">V · D · Saldo</span>
        </div>
        {!hasData && <p className="text-xs text-[#6B6B6B] font-medium px-4 py-4">Sem resultados ainda</p>}
        <div className="stagger">
          {stats.map((s, i) => {
            const isFirst = i === 0 && hasData
            return (
              <div key={s.player.id} className={`grid grid-cols-[1.75rem_2.25rem_1fr_auto] gap-3 items-center px-4 border-b border-[#242424] last:border-0 transition-colors ${
                isFirst ? 'py-3.5 bg-[#1C1C1C]' : 'py-3'
              }`}>
                <span className={`font-display font-black tabular-nums ${isFirst ? `text-xl ${textColor}` : 'text-sm text-[#6B6B6B]'}`}>
                  {i + 1}
                </span>
                <div className={`rounded-full text-white font-black flex items-center justify-center shrink-0 ${
                  isFirst ? `w-10 h-10 text-base ${color}` : 'w-9 h-9 text-sm bg-[#1C1C1C]'
                }`}>
                  {s.player.name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className={`font-bold text-[#F0F0F0] truncate ${isFirst ? 'text-base' : 'text-sm'}`}>{s.player.name}</p>
                  {isFirst && <p className={`text-[10px] font-bold ${textColor}`}>{title === 'Rei da Quadra' ? '👑 Rei da Quadra' : '👑 Rainha da Quadra'}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-black tabular-nums text-[#F0F0F0] ${isFirst ? 'text-base' : 'text-sm'}`}>{s.wins}V · {s.losses}D</p>
                  <p className={`text-xs font-bold tabular-nums ${s.gameDiff >= 0 ? 'text-emerald-400' : 'text-[#FF4444]'}`}>
                    {s.gameDiff > 0 ? '+' : ''}{s.gameDiff}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ── Finish category ───────────────────────────────────────────

function FinishCategoryButton({ categoryId }: { categoryId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function finish() {
    setLoading(true)
    const supabase = createClient()
    await supabase.from('categories').update({ status: 'done' }).eq('id', categoryId)
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={finish}
      disabled={loading}
      className="mt-4 w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black text-sm py-3.5 rounded-xl disabled:opacity-50 active:scale-[0.97] transition-transform shadow-md shadow-emerald-100"
    >
      {loading ? 'Encerrando...' : '🏁 Encerrar categoria'}
    </button>
  )
}
