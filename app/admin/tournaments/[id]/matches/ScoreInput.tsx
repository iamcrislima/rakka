'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isValidFinalScore, maxScore } from '@/lib/match-rules'
import { submitMatchResult, editMatchResult, startMatch } from './actions'
import type { MatchRules } from '@/types'

interface Props {
  matchId:      string
  tournamentId: string
  stage:        string
  rules:        MatchRules
  /** Set when the match already has a start time recorded — shows the live clock instead of the "Iniciar" button. */
  startedAt?: string | null
  /** When set, this instance edits an already-confirmed result instead of creating a new one. */
  editMode?: { score1: number | null; score2: number | null }
}

function formatElapsed(totalSecs: number): string {
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

async function autoCompleteTournament(tournamentId: string) {
  const { data } = await supabase
    .from('matches')
    .select('status')
    .eq('tournament_id', tournamentId)
    .in('stage', ['final', 'consolation_final'])

  if (data?.length === 2 && data.every(m => m.status === 'done')) {
    await supabase
      .from('tournaments')
      .update({ status: 'done' })
      .eq('id', tournamentId)
  }
}

// ── Score field ───────────────────────────────────────────────

function ScoreField({ value, onChange, label, max, size = 'lg' }: {
  value:    number | ''
  onChange: (v: number | '') => void
  label:    string
  max:      number
  size?:    'lg' | 'sm'
}) {
  const ref = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    if (raw === '') { onChange(''); return }
    const n = parseInt(raw, 10)
    if (isNaN(n) || n < 0) return
    if (n > max) return
    onChange(n)
  }

  const lgCls = 'w-20 h-20 text-5xl rounded-2xl border-2'
  const smCls = 'w-14 h-14 text-3xl rounded-xl border'

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[10px] font-black uppercase tracking-widest text-[#888888]">{label}</span>
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
        className={`text-center font-black text-[#F0F0F0] tabular-nums
                    bg-[#111111] border-[#242424]
                    focus:border-[#C8F135] focus:outline-none
                    [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                    transition-colors ${size === 'lg' ? lgCls : smCls}`}
        aria-label={label}
      />
    </div>
  )
}

// ── Tiebreak row ──────────────────────────────────────────────

function TiebreakInput({ tb1, tb2, onChange, tiebreakTo }: {
  tb1: number | ''
  tb2: number | ''
  onChange: (t1: number | '', t2: number | '') => void
  tiebreakTo: number
}) {
  const n1 = tb1 === '' ? 0 : tb1
  const n2 = tb2 === '' ? 0 : tb2
  const valid = tb1 !== '' && tb2 !== '' &&
    Math.max(n1, n2) >= tiebreakTo &&
    Math.abs(n1 - n2) >= 1

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-px bg-amber-500/15" />
        <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest px-1">
          Tie-break · até {tiebreakTo}
        </span>
        <div className="flex-1 h-px bg-amber-500/15" />
      </div>
      <div className="flex items-center justify-around gap-2">
        <ScoreField value={tb1} onChange={v => onChange(v, tb2)} label="T1" max={99} size="sm" />
        <span className="text-base font-black text-[#444444] mt-5">×</span>
        <ScoreField value={tb2} onChange={v => onChange(tb1, v)} label="T2" max={99} size="sm" />
      </div>
      {tb1 !== '' && tb2 !== '' && !valid && (
        <p className="text-center text-xs text-amber-500 font-bold mt-2 animate-fade-in">
          Vencedor precisa chegar a {tiebreakTo} com 1+ de diferença
        </p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

export default function ScoreInput({ matchId, tournamentId, stage, rules, startedAt: initialStartedAt, editMode }: Props) {
  const router = useRouter()
  const max = maxScore(rules)

  const [s1, setS1]         = useState<number | ''>(0)
  const [s2, setS2]         = useState<number | ''>(0)
  const [tb1, setTb1]       = useState<number | ''>(0)
  const [tb2, setTb2]       = useState<number | ''>(0)
  const [saving, setSaving] = useState(false)
  const [done, setDone]     = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [startedAt, setStartedAt] = useState<string | null>(initialStartedAt ?? null)
  const [startingMatch, setStartingMatch] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!startedAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [startedAt])

  async function handleStart() {
    if (startingMatch || startedAt) return
    setStartingMatch(true)
    setStartedAt(new Date().toISOString()) // optimistic
    const result = await startMatch(matchId)
    setStartingMatch(false)
    if (!result.ok) setStartedAt(null)
  }

  function startEditing() {
    setS1(editMode?.score1 ?? 0)
    setS2(editMode?.score2 ?? 0)
    setSaveError(null)
    setEditing(true)
  }

  const isFinals = stage === 'final' || stage === 'consolation_final'
  const isSoma   = rules.type === 'sum_of_games'
  const n1 = s1 === '' ? 0 : s1
  const n2 = s2 === '' ? 0 : s2

  // Show tiebreak input when scores are tied at max_games (6×6) in super_tiebreak mode
  // — Soma de Games has no advantage/tiebreak concept, so it never gets a tiebreak step
  const isTied6x6 = !isSoma && rules.deuce === 'super_tiebreak' &&
    s1 !== '' && s2 !== '' &&
    n1 === rules.max_games && n2 === rules.max_games

  // Tiebreak validity
  const tbN1 = tb1 === '' ? 0 : tb1
  const tbN2 = tb2 === '' ? 0 : tb2
  const tbValid = isTied6x6 &&
    tb1 !== '' && tb2 !== '' &&
    Math.max(tbN1, tbN2) >= rules.tiebreak_to &&
    Math.abs(tbN1 - tbN2) >= 1

  // canSave: either a normal valid score, OR 6×6 with valid tiebreak
  const canSave = (() => {
    if (s1 === '' || s2 === '') return false
    if (isTied6x6) return tbValid
    return isValidFinalScore(n1, n2, rules)
  })()

  // Hint for main scores (not shown when 6×6 tiebreak is active)
  const hint = (() => {
    if (isTied6x6) return null
    if (s1 === '' || s2 === '') return null
    if (n1 === n2 && n1 > 0) {
      if (!isSoma && n1 === rules.max_games && rules.deuce === 'super_tiebreak') return null // will show TB
      return 'Empate não é permitido — ajuste o placar'
    }
    if (!canSave && (n1 !== 0 || n2 !== 0)) {
      if (isSoma) return `Placar inválido — a soma dos games deve ser ${rules.targetSum}`
      const winner = Math.max(n1, n2)
      const loser  = Math.min(n1, n2)
      if (winner < rules.max_games) {
        return `Alguém precisa chegar a ${rules.max_games} games`
      }
      if (rules.deuce === 'super_tiebreak' && winner === rules.max_games && winner - loser === 1) {
        return `Precisa vencer por 2 (ou chegar a ${rules.max_games + 1})`
      }
    }
    return null
  })()

  async function save() {
    if (!canSave || saving) return
    if (editing && !confirm('Tem certeza? Isso vai recalcular o ranking com o novo placar.')) return
    setSaving(true)
    setSaveError(null)

    // When 6×6 with tiebreak: convert to 7-6 / 6-7 for storage
    const finalS1 = isTied6x6 ? (tbN1 > tbN2 ? rules.max_games + 1 : rules.max_games) : n1
    const finalS2 = isTied6x6 ? (tbN2 > tbN1 ? rules.max_games + 1 : rules.max_games) : n2

    const result = editing
      ? await editMatchResult(matchId, finalS1, finalS2)
      : await submitMatchResult(matchId, finalS1, finalS2)
    if (!result.ok) {
      setSaveError(result.error ?? 'Não foi possível salvar o resultado.')
      setSaving(false)
      return
    }

    if (!editing && isFinals) await autoCompleteTournament(tournamentId)

    setSaving(false)
    if (editing) {
      setEditing(false)
      router.refresh()
      return
    }
    setDone(true)
    router.refresh()
  }

  // ── Edit-mode trigger (already-confirmed match, not yet editing) ──
  if (editMode && !editing) {
    return (
      <button
        onClick={startEditing}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#242424] text-[#888888] text-xs font-bold hover:border-[#3a3a3a] hover:text-[#F0F0F0] transition-colors"
      >
        ✏️ Editar resultado
      </button>
    )
  }

  if (done) {
    return (
      <div className="flex items-center justify-center gap-2 py-3 text-emerald-400 font-black text-sm animate-scale-in">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="9" fill="#10B981" fillOpacity=".15" />
          <polyline
            points="4.5,9 7.5,12 13.5,6"
            stroke="#10B981"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="check-stroke"
          />
        </svg>
        Resultado salvo
      </div>
    )
  }

  // Score entry is gated behind starting the match — nothing to confirm yet.
  if (!editing && !startedAt) {
    return (
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
    )
  }

  return (
    <div className="space-y-4 pt-1">

      {!editing && startedAt && (
        <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-red-400 tabular-nums">
          🔴 Em andamento · {formatElapsed(Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000)))}
        </div>
      )}

      {/* Main game scores */}
      <div className="flex items-center justify-around gap-2">
        <ScoreField value={s1} onChange={setS1} label="Time 1" max={max} />
        <span className="text-xl font-black text-[#444444] mt-5">×</span>
        <ScoreField value={s2} onChange={setS2} label="Time 2" max={max} />
      </div>

      {/* Validation hint */}
      {hint && (
        <p className="text-center text-xs text-amber-500 font-bold animate-fade-in">{hint}</p>
      )}
      {saveError && (
        <p className="text-center text-xs text-[#FF4444] font-bold animate-fade-in">⚠️ {saveError}</p>
      )}

      {/* Tiebreak input (appears on 6×6) */}
      {isTied6x6 && (
        <TiebreakInput
          tb1={tb1}
          tb2={tb2}
          onChange={(t1, t2) => { setTb1(t1); setTb2(t2) }}
          tiebreakTo={rules.tiebreak_to}
        />
      )}

      {/* Confirm */}
      <div className="flex gap-2">
        {editing && (
          <button
            onClick={() => setEditing(false)}
            disabled={saving}
            className="px-4 py-3.5 rounded-xl border border-[#242424] text-[#888888] text-sm font-bold hover:border-[#3a3a3a] transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
        )}
        <button
          onClick={save}
          disabled={!canSave || saving}
          className={`flex-1 font-black py-3.5 rounded-xl text-base transition-all active:scale-[0.97] disabled:opacity-30 ${
            editing
              ? 'bg-amber-400 text-[#0A0A0A] active:bg-amber-300'
              : isFinals
                ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-white shadow-md shadow-amber-100 active:from-amber-500 active:to-orange-500'
                : 'bg-emerald-500 text-[#0A0A0A] shadow-md shadow-emerald-100 active:bg-emerald-600'
          }`}
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
              Salvando...
            </span>
          ) : editing ? (
            '✓ Salvar correção'
          ) : (
            '✓ Confirmar resultado'
          )}
        </button>
      </div>

    </div>
  )
}
