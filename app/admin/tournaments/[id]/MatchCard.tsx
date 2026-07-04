'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isValidFinalScore, maxScore } from '@/lib/match-rules'
import { submitMatchResult, editMatchResult, startMatch } from './matches/actions'
import type { Match, MatchRules, Court } from '@/types'

interface Props {
  m:              Match
  name:           (id: string) => string
  tournamentId:   string
  categoryId?:    string
  rules:          MatchRules
  courts?:        Court[]
  scheduledAt?:   string | null
  onScoreChange?: (matchId: string, s1: number | '', s2: number | '') => void
}

// ── Countdown helper ─────────────────────────────────────────

function formatCountdown(ms: number): string {
  if (ms <= 0) return ''
  const totalSecs = Math.ceil(ms / 1000)
  const hours = Math.floor(totalSecs / 3600)
  const mins  = Math.floor((totalSecs % 3600) / 60)
  const secs  = totalSecs % 60
  if (hours > 0) return `${hours}h ${mins.toString().padStart(2,'0')}min`
  if (mins  > 0) return `${mins}min ${secs.toString().padStart(2,'0')}s`
  return `${secs}s`
}

/** Live ticking clock while a match is in progress — "4:32". */
function formatElapsed(totalSecs: number): string {
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/** Final duration once a match is done — "18min" (or "45s" for very short ones). */
function formatDuration(totalSecs: number): string {
  if (totalSecs < 60) return `${totalSecs}s`
  return `${Math.round(totalSecs / 60)}min`
}

// ── Helpers ───────────────────────────────────────────────────

async function autoComplete(tournamentId: string, categoryId?: string) {
  if (categoryId) {
    // Check if both finals in this category are done
    const { data } = await supabase
      .from('matches')
      .select('status')
      .eq('category_id', categoryId)
      .in('stage', ['final', 'consolation_final'])
    if (data?.length === 2 && data.every(m => m.status === 'done')) {
      await supabase.from('categories').update({ status: 'done' }).eq('id', categoryId)
      // Check if ALL categories in this tournament are done
      const { data: cats } = await supabase
        .from('categories')
        .select('status')
        .eq('tournament_id', tournamentId)
      if (cats?.every(c => c.status === 'done')) {
        await supabase.from('tournaments').update({ status: 'done' }).eq('id', tournamentId)
      }
    }
  } else {
    const { data } = await supabase
      .from('matches')
      .select('status')
      .eq('tournament_id', tournamentId)
      .in('stage', ['final', 'consolation_final'])
    if (data?.length === 2 && data.every(m => m.status === 'done')) {
      await supabase.from('tournaments').update({ status: 'done' }).eq('id', tournamentId)
    }
  }
}

// ── Inline score input ────────────────────────────────────────

function ScoreDigit({ value, onChange, max, size = 'lg' }: {
  value:    number | ''
  onChange: (v: number | '') => void
  max:      number
  size?:    'lg' | 'sm'
}) {
  const ref = useRef<HTMLInputElement>(null)
  const lg  = 'w-14 h-14 text-4xl rounded-xl border-2'
  const sm  = 'w-10 h-10 text-2xl rounded-lg border'

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    if (raw === '') { onChange(''); return }
    const n = parseInt(raw, 10)
    if (isNaN(n) || n < 0 || n > max) return
    onChange(n)
  }

  return (
    <input
      ref={ref}
      type="number"
      inputMode="numeric"
      pattern="[0-9]*"
      min={0}
      max={max}
      value={value === '' ? '' : value}
      onChange={handleChange}
      onFocus={() => ref.current?.select()}
      className={`font-display text-center font-bold text-[#F0F0F0] tabular-nums bg-[#161616]
                  border-[#242424] focus:border-[#C8F135] focus:outline-none
                  [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none
                  [&::-webkit-inner-spin-button]:appearance-none transition-colors
                  ${size === 'lg' ? lg : sm}`}
    />
  )
}

// ── Team column ───────────────────────────────────────────────

function TeamColumn({ p1, p2, isWinner, align }: {
  p1: string; p2: string; isWinner: boolean | null; align: 'left' | 'right'
}) {
  const isRight = align === 'right'
  const muted   = isWinner === false  // explicitly lost

  return (
    <div className={`flex flex-col gap-1.5 ${muted ? 'opacity-40' : ''} transition-opacity`}>
      {[p1, p2].map((n, i) => (
        <div key={i} className={`flex items-center gap-2 ${isRight ? 'flex-row-reverse' : ''}`}>
          <div
            className="w-7 h-7 rounded-full text-[10px] font-black flex items-center justify-center shrink-0"
            style={{
              background: isWinner ? '#22C55E' : muted ? '#1C1C1C' : '#242424',
              color:      isWinner ? '#0A0A0A' : '#888888',
            }}
          >
            {n[0]?.toUpperCase() ?? '?'}
          </div>
          <span className={`text-sm font-bold truncate max-w-[80px] sm:max-w-[100px] ${
            isWinner ? 'text-emerald-400' : 'text-[#F0F0F0]'
          }`}>
            {n}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Score center ──────────────────────────────────────────────

interface ScoreCenterProps {
  isDone:     boolean
  editing:    boolean
  storedS1:   number | null
  storedS2:   number | null
  s1: number | ''; s2: number | ''
  tb1: number | ''; tb2: number | ''
  onS1: (v: number | '') => void
  onS2: (v: number | '') => void
  onTb1: (v: number | '') => void
  onTb2: (v: number | '') => void
  isTied6x6: boolean
  rules: MatchRules
  maxGames: number
}

function ScoreCenter({
  isDone, editing, storedS1, storedS2,
  s1, s2, tb1, tb2, onS1, onS2, onTb1, onTb2,
  isTied6x6, rules, maxGames,
}: ScoreCenterProps) {
  const showStatic = isDone && !editing

  // Was result decided by tiebreak? (stored as max_games+1)
  const wasTiebreak = showStatic &&
    rules.deuce === 'super_tiebreak' &&
    (storedS1 === maxGames + 1 || storedS2 === maxGames + 1)

  const s1Wins = showStatic && (storedS1 ?? 0) > (storedS2 ?? 0)
  const s2Wins = showStatic && (storedS2 ?? 0) > (storedS1 ?? 0)

  return (
    <div className="flex flex-col items-center gap-1 px-3 sm:px-5">

      {/* Main score row */}
      <div className="flex items-center gap-2 sm:gap-3">
        {showStatic ? (
          <>
            <span className={`font-display text-4xl sm:text-5xl font-bold tabular-nums leading-none ${
              s1Wins ? 'text-[#C8F135]' : 'text-[#6B6B6B]'
            }`}>{storedS1 ?? '—'}</span>
            <span className="text-lg font-black text-[#444444]">×</span>
            <span className={`font-display text-4xl sm:text-5xl font-bold tabular-nums leading-none ${
              s2Wins ? 'text-[#C8F135]' : 'text-[#6B6B6B]'
            }`}>{storedS2 ?? '—'}</span>
          </>
        ) : (
          <>
            <ScoreDigit value={s1} onChange={onS1} max={maxScore(rules)} />
            <span className="text-lg font-black text-[#444444] select-none">×</span>
            <ScoreDigit value={s2} onChange={onS2} max={maxScore(rules)} />
          </>
        )}
      </div>

      {/* Tiebreak — display */}
      {showStatic && wasTiebreak && (
        <span className="text-[10px] font-bold text-[#6B6B6B] tracking-wide uppercase">TB</span>
      )}

      {/* Tiebreak — input (appears at 6×6) */}
      {!showStatic && isTied6x6 && (
        <div className="flex items-center gap-1.5 animate-fade-in mt-0.5">
          <span className="text-xs font-black text-amber-400 select-none">(</span>
          <ScoreDigit value={tb1} onChange={onTb1} max={99} size="sm" />
          <span className="text-xs font-black text-amber-300 select-none">×</span>
          <ScoreDigit value={tb2} onChange={onTb2} max={99} size="sm" />
          <span className="text-xs font-black text-amber-400 select-none">)</span>
        </div>
      )}

      {/* Tiebreak label */}
      {!showStatic && isTied6x6 && (
        <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">
          tie-break até {rules.tiebreak_to}
        </span>
      )}

      {editing && (
        <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest mt-0.5">✏️ Editando</span>
      )}
    </div>
  )
}

// ── Match card (root) ─────────────────────────────────────────

export default function MatchCard({ m, name, tournamentId, categoryId, rules, courts, scheduledAt, onScoreChange }: Props) {
  const router = useRouter()

  const [s1, setS1Raw]            = useState<number | ''>(0)
  const [s2, setS2Raw]            = useState<number | ''>(0)
  const [tb1, setTb1]             = useState<number | ''>(0)
  const [tb2, setTb2]             = useState<number | ''>(0)

  function setS1(v: number | '') { setS1Raw(v); onScoreChange?.(m.id, v, s2) }
  function setS2(v: number | '') { setS2Raw(v); onScoreChange?.(m.id, s1, v) }
  const [saving, setSaving]       = useState(false)
  const [saved,  setSaved]        = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [editing, setEditing]     = useState(false)
  const [courtId, setCourtId]     = useState<string | null>(m.court_id)
  const [editingCourt, setEditingCourt] = useState(false)
  const [overridden, setOverridden] = useState(m.override_active)
  const [now,     setNow]         = useState(() => Date.now())
  const [startedAt, setStartedAt] = useState<string | null>(m.started_at)
  const [startingMatch, setStartingMatch] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  // Tick every second so countdown updates and lock expires automatically
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const scheduledMs  = scheduledAt ? new Date(scheduledAt).getTime() : null
  const msRemaining  = scheduledMs ? scheduledMs - now : 0
  const isLocked     = !overridden && msRemaining > 0

  async function assignCourt(cid: string | null) {
    setCourtId(cid)
    setEditingCourt(false)
    await supabase.from('matches').update({ court_id: cid }).eq('id', m.id)
  }

  async function activateNow() {
    await supabase.from('matches').update({ override_active: true }).eq('id', m.id)
    setOverridden(true)
  }

  async function handleStart() {
    if (startingMatch || startedAt) return
    setStartingMatch(true)
    setStartError(null)
    const iso = new Date().toISOString()
    setStartedAt(iso) // optimistic — clock starts ticking immediately
    const result = await startMatch(m.id)
    setStartingMatch(false)
    if (!result.ok) {
      setStartedAt(null) // roll back the optimistic start — server rejected it (e.g. player conflict)
      setStartError(result.error ?? 'Não foi possível iniciar a partida.')
    }
  }

  const isDone      = m.status === 'done' || saved
  const elapsedSeconds = startedAt ? Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000)) : 0
  const isFinal     = m.stage === 'final'
  const isConsolation = m.stage === 'consolation_final'
  const isFinals    = isFinal || isConsolation
  const maxGames    = rules.max_games

  // Derived from stored result
  const t1Wins = isDone && (m.score1 ?? 0) > (m.score2 ?? 0)
  const t2Wins = isDone && (m.score2 ?? 0) > (m.score1 ?? 0)

  // Tie condition — Soma de Games never reaches 6×6, so no tiebreak step there
  const isSoma = rules.type === 'sum_of_games'
  const n1 = s1 === '' ? 0 : s1
  const n2 = s2 === '' ? 0 : s2
  const isTied6x6 = !isSoma && rules.deuce === 'super_tiebreak' &&
    s1 !== '' && s2 !== '' &&
    n1 === maxGames && n2 === maxGames

  // Tiebreak validity
  const tbN1 = tb1 === '' ? 0 : tb1
  const tbN2 = tb2 === '' ? 0 : tb2
  const tbValid = isTied6x6 &&
    tb1 !== '' && tb2 !== '' &&
    Math.max(tbN1, tbN2) >= rules.tiebreak_to &&
    Math.abs(tbN1 - tbN2) >= 1

  const canSave = (() => {
    if ((isDone && !editing) || s1 === '' || s2 === '') return false
    if (isTied6x6) return tbValid
    return isValidFinalScore(n1, n2, rules)
  })()

  const scoreHint = (!canSave && s1 !== '' && s2 !== '' && !isTied6x6 && isSoma)
    ? `Placar inválido — a soma dos games deve ser ${rules.targetSum}`
    : null

  async function save() {
    if (!canSave || saving) return
    const isCorrection = editing
    if (isCorrection && !confirm('Tem certeza? Isso vai recalcular o ranking com o novo placar.')) return
    setSaving(true)
    setSaveError(null)
    const finalS1 = isTied6x6 ? (tbN1 > tbN2 ? maxGames + 1 : maxGames) : n1
    const finalS2 = isTied6x6 ? (tbN2 > tbN1 ? maxGames + 1 : maxGames) : n2
    const result = isCorrection
      ? await editMatchResult(m.id, finalS1, finalS2)
      : await submitMatchResult(m.id, finalS1, finalS2)
    if (!result.ok) {
      setSaveError(result.error ?? 'Não foi possível salvar o resultado.')
      setSaving(false)
      return
    }
    if (!isCorrection && isFinals) await autoComplete(tournamentId, categoryId)
    setSaving(false)
    setEditing(false)
    if (!isCorrection) setSaved(true)
    router.refresh()
  }

  function startEditing() {
    setS1Raw(m.score1 ?? 0)
    setS2Raw(m.score2 ?? 0)
    setSaveError(null)
    setEditing(true)
  }

  // ── Card border + tint
  const cardBorder = isFinal && !isDone ? 'border-2 border-amber-400/50 ring-pulse' :
    isFinals   ? 'border border-amber-500/30' :
    isDone     ? 'border border-emerald-500/20' : 'border border-[#242424]'

  const headerBg = isFinal && !isDone  ? 'bg-gradient-to-r from-amber-500/25 to-orange-500/25' :
    isFinals && !isDone ? 'bg-amber-500/15' :
    isDone              ? 'bg-emerald-500/10' : 'bg-[#111111]'

  const bodyBg = isFinal && !isDone ? 'bg-amber-500/[0.04]' : 'bg-[#161616]'

  // Score entry only opens up once the organizer has tapped "Iniciar jogo" —
  // before that, there's nothing to type in yet, just the matchup.
  const notStarted = !isDone && !isLocked && !startedAt
  const inProgress = !isDone && !isLocked && !!startedAt

  // ── Status badge (Concluído / Agendado / Em andamento / Não iniciado)
  const statusBadge = isDone
    ? { label: '✓ Concluído', bg: 'rgba(34,197,94,0.15)', color: '#22C55E' }
    : isLocked
      ? { label: '🔒 Agendado', bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' }
      : inProgress
        ? { label: '🔴 Em andamento', bg: 'rgba(239,68,68,0.15)', color: '#FF4444' }
        : { label: '○ Não iniciado', bg: 'rgba(255,255,255,0.06)', color: '#888888' }

  return (
    <div className={`rounded-2xl overflow-hidden shadow-sm ${cardBorder}`}>

      {/* ── Header — every badge here is `inline-flex items-center leading-none`
          so its own emoji+text sits centered within its own pill, regardless
          of the emoji glyph's ascent/descent (which differs from the
          surrounding font and, left at the default line-height, makes pills
          look glued to the top of the row even though the row itself
          already centers them via items-center). ── */}
      <div className={`flex items-center justify-between px-4 py-2 ${headerBg}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex items-center leading-none text-[11px] font-black uppercase tracking-widest shrink-0 ${
            isFinals && !isDone ? 'text-amber-400' : isDone ? 'text-emerald-400' : 'text-[#888888]'
          }`}>
            {isFinal        ? '🏆 Grande Final'    :
             isConsolation  ? '🥉 Final Consolação' :
                             `Rodada ${m.round}`}
          </span>
          {courtId && courts && courts.length > 0 && (
            <span className={`inline-flex items-center leading-none text-[10px] font-bold px-2 py-0.5 rounded-full truncate max-w-[120px] ${
              isFinals && !isDone ? 'bg-amber-500/15 text-amber-400' :
              isDone             ? 'bg-emerald-500/15 text-emerald-400' :
                                   'bg-[#1C1C1C] text-[#888888]'
            }`}>
              📍 {courts.find(c => c.id === courtId)?.name ?? ''}
            </span>
          )}
          {isDone && m.duration_seconds != null && (
            <span className="inline-flex items-center leading-none text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1C1C1C] text-[#888888] shrink-0">
              ⏱ {formatDuration(m.duration_seconds)}
            </span>
          )}
          {!isDone && !isLocked && startedAt && (
            <span className="inline-flex items-center leading-none text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 shrink-0 tabular-nums">
              ⏱ {formatElapsed(elapsedSeconds)}
            </span>
          )}
        </div>
        <span
          className="inline-flex items-center leading-none text-[10px] font-black uppercase tracking-wide shrink-0 px-2 py-0.5 rounded-full"
          style={{ background: statusBadge.bg, color: statusBadge.color }}
        >
          {statusBadge.label}
        </span>
      </div>

      {/* ── Locked body ── */}
      {isLocked ? (
        <div className="px-4 py-5 bg-[#111111]/60">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <TeamColumn p1={name(m.team1_p1)} p2={name(m.team1_p2)} isWinner={null} align="left" />
            <div className="flex flex-col items-center gap-1.5 px-3 shrink-0">
              <span className="text-2xl leading-none">🕐</span>
              <span className="text-xl font-black text-[#F0F0F0] tabular-nums">
                {new Date(scheduledAt!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-[11px] font-bold text-[#888888] text-center">
                Começa em {formatCountdown(msRemaining)}
              </span>
            </div>
            <TeamColumn p1={name(m.team2_p1)} p2={name(m.team2_p2)} isWinner={null} align="right" />
          </div>
        </div>
      ) : (
        /* ── Normal scoreboard body ── */
        <div className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-5 ${bodyBg}`}>
          <TeamColumn
            p1={name(m.team1_p1)} p2={name(m.team1_p2)}
            isWinner={isDone ? t1Wins : null}
            align="left"
          />
          {notStarted ? (
            <div className="flex flex-col items-center gap-1.5 px-3 sm:px-5">
              <span className="text-2xl leading-none text-[#444444]">VS</span>
              <span className="text-[9px] font-bold text-[#6B6B6B] uppercase tracking-wider text-center">
                Aguardando início
              </span>
            </div>
          ) : (
            <ScoreCenter
              isDone={isDone}
              editing={editing}
              storedS1={m.score1} storedS2={m.score2}
              s1={s1} s2={s2} tb1={tb1} tb2={tb2}
              onS1={setS1} onS2={setS2} onTb1={setTb1} onTb2={setTb2}
              isTied6x6={isTied6x6}
              rules={rules}
              maxGames={maxGames}
            />
          )}
          <TeamColumn
            p1={name(m.team2_p1)} p2={name(m.team2_p2)}
            isWinner={isDone ? t2Wins : null}
            align="right"
          />
        </div>
      )}

      {/* ── Court assignment ── */}
      {courts && courts.length > 0 && (
        <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
          {editingCourt ? (
            <>
              <span className="text-[10px] font-black text-[#6B6B6B] uppercase tracking-wider shrink-0">Atribuir quadra:</span>
              {courtId && (
                <button
                  onClick={() => assignCourt(null)}
                  className="text-xs font-bold px-2.5 py-1 rounded-full border border-[#242424] bg-[#161616] text-[#888888] hover:border-[#FF4444]/40 hover:text-[#FF4444] transition-colors"
                >
                  Remover
                </button>
              )}
              {courts.map(c => (
                <button
                  key={c.id}
                  onClick={() => assignCourt(c.id)}
                  className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-colors ${
                    courtId === c.id
                      ? 'bg-[#C8F135] text-[#0A0A0A] border-[#C8F135]'
                      : 'bg-[#161616] text-[#888888] border-[#242424] hover:border-[#3a3a3a] hover:text-[#C8F135]'
                  }`}
                >
                  {c.name}
                </button>
              ))}
              <button
                onClick={() => setEditingCourt(false)}
                className="text-[10px] font-bold text-[#6B6B6B] px-1.5 py-1 shrink-0"
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditingCourt(true)}
              className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border transition-colors ${
                courtId
                  ? 'bg-[#161616] text-[#888888] border-[#242424] hover:border-[#3a3a3a] hover:text-[#C8F135]'
                  : 'bg-[#161616] text-amber-400/80 border-amber-500/20 hover:border-amber-500/40'
              }`}
            >
              📍 {courtId ? (courts.find(c => c.id === courtId)?.name ?? 'Quadra') : 'Sem quadra atribuída'}
              <span className="text-[#6B6B6B]">✎</span>
            </button>
          )}
        </div>
      )}

      {/* ── Override / confirm / edit footer ── */}
      {isLocked ? (
        <div className="px-4 pb-4">
          <button
            onClick={activateNow}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-amber-500/30 bg-amber-500/10 text-amber-400 text-sm font-black hover:bg-amber-500/20 transition-colors active:scale-[0.97]"
          >
            ⚡ Ativar agora
          </button>
        </div>
      ) : isDone && !editing ? (
        <div className="px-4 pb-4">
          <button
            onClick={startEditing}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#242424] text-[#888888] text-xs font-bold hover:border-[#3a3a3a] hover:text-[#F0F0F0] transition-colors"
          >
            ✏️ Editar resultado
          </button>
        </div>
      ) : notStarted ? (
        /* ── Score entry is gated behind this — nothing to confirm yet ── */
        <div className="px-4 pb-4 space-y-2">
          {startError && (
            <p className="text-center text-xs font-bold text-[#FF4444] animate-fade-in">⚠️ {startError}</p>
          )}
          <button
            onClick={handleStart}
            disabled={startingMatch}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#C8F135] text-[#0A0A0A] text-sm font-black uppercase tracking-wide hover:bg-[#D4F54A] transition-colors active:scale-[0.97] disabled:opacity-50"
          >
            {startingMatch ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-[#0A0A0A]/30 border-t-[#0A0A0A] rounded-full animate-spin inline-block" />
                Iniciando...
              </span>
            ) : (
              '▶ Iniciar jogo'
            )}
          </button>
        </div>
      ) : (!isDone || editing) && (
        <div className="px-4 pb-4 space-y-2">
          {scoreHint && (
            <p className="text-center text-xs font-bold text-[#FF4444] animate-fade-in">{scoreHint}</p>
          )}
          {saveError && (
            <p className="text-center text-xs font-bold text-[#FF4444] animate-fade-in">⚠️ {saveError}</p>
          )}
          <div className="flex gap-2">
            {editing && (
              <button
                onClick={() => { setEditing(false); setSaveError(null) }}
                disabled={saving}
                className="px-4 py-3 rounded-xl border border-[#242424] text-[#888888] text-sm font-bold hover:border-[#3a3a3a] transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
            )}
            <button
              onClick={save}
              disabled={!canSave || saving}
              className={`flex-1 font-black py-3 rounded-xl text-sm transition-all active:scale-[0.97] disabled:opacity-25 ${
                editing
                  ? 'bg-amber-400 text-[#0A0A0A] hover:bg-amber-300'
                  : isFinals
                    ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-[#0A0A0A]'
                    : 'bg-[#C8F135] text-[#0A0A0A] hover:bg-[#D4F54A]'
              }`}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
                  Salvando...
                </span>
              ) : editing ? (
                canSave ? '✓ Salvar correção' : 'Preencha o placar'
              ) : (
                canSave ? '✓ Confirmar resultado' : 'Preencha o placar'
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

// ── Match duration stats — avg/min/max across completed matches ────

export function MatchDurationStats({ matches }: { matches: Match[] }) {
  const durations = matches
    .map(m => m.duration_seconds)
    .filter((d): d is number => d != null)

  if (durations.length === 0) return null

  const avg = Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
  const min = Math.min(...durations)
  const max = Math.max(...durations)

  return (
    <div className="grid grid-cols-3 gap-2">
      {[
        { label: 'Média',  value: avg },
        { label: 'Mais rápida', value: min },
        { label: 'Mais longa',  value: max },
      ].map(({ label, value }) => (
        <div key={label} className="rounded-xl border border-[#242424] bg-[#161616] px-3 py-2.5 text-center">
          <p className="font-display text-lg font-bold text-[#F0F0F0] tabular-nums leading-none">
            {formatDuration(value)}
          </p>
          <p className="text-[9px] font-bold text-[#6B6B6B] uppercase tracking-wider mt-1">{label}</p>
        </div>
      ))}
    </div>
  )
}
