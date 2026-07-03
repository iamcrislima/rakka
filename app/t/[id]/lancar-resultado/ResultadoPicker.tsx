'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isValidFinalScore, maxScore } from '@/lib/match-rules'
import { submitMatchResult } from '@/app/admin/tournaments/[id]/matches/actions'
import type { Match, MatchRules } from '@/types'

export interface MatchCardInfo {
  match:        Match
  courtName:    string | null
  categoryName: string | null
}

interface Props {
  tournamentName:  string
  cards:           MatchCardInfo[]
  nameMap:         Record<string, string>
  defaultRules:    MatchRules
  rulesByCategory: Record<string, MatchRules>
}

export default function ResultadoPicker({ tournamentName, cards, nameMap, defaultRules, rulesByCategory }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const name = (id: string) => nameMap[id] ?? '?'

  // Live refresh — realtime + fallback poll, so the list of "happening now"
  // matches stays current as courts finish/start games elsewhere.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`lancar-resultado-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        startTransition(() => router.refresh())
      })
      .subscribe()
    const poll = setInterval(() => startTransition(() => router.refresh()), 20_000)
    return () => { supabase.removeChannel(channel); clearInterval(poll) }
  }, [router])

  const activeCard = cards.find(c => c.match.id === selectedId) ?? null

  // If the selected match disappeared (result entered elsewhere, or moved
  // off this list on refresh), fall back to the picker instead of hanging
  // on a stale form.
  useEffect(() => {
    if (selectedId && !activeCard) setSelectedId(null)
  }, [selectedId, activeCard])

  if (activeCard) {
    const rules = activeCard.match.category_id
      ? (rulesByCategory[activeCard.match.category_id] ?? defaultRules)
      : defaultRules
    return (
      <ScoreScreen
        key={activeCard.match.id}
        tournamentName={tournamentName}
        card={activeCard}
        name={name}
        rules={rules}
        onBack={() => setSelectedId(null)}
        onSaved={() => { setSelectedId(null); startTransition(() => router.refresh()) }}
      />
    )
  }

  return <PickerList tournamentName={tournamentName} cards={cards} name={name} onSelect={setSelectedId} />
}

// ── Picker — one card per court showing whatever match is up now ───

function PickerList({ tournamentName, cards, name, onSelect }: {
  tournamentName: string
  cards:          MatchCardInfo[]
  name:           (id: string) => string
  onSelect:       (matchId: string) => void
}) {
  return (
    <div className="fixed inset-0 flex flex-col bg-[#0A0A0A] text-[#F0F0F0] overflow-y-auto">
      <div className="text-center shrink-0 px-6 pt-10 pb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#888888]">{tournamentName}</p>
        <p className="font-display text-2xl font-bold uppercase text-[#C8F135] mt-1.5">
          Informe o resultado da sua partida
        </p>
      </div>

      {cards.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center pb-16">
          <span className="text-6xl opacity-25">🏐</span>
          <p className="text-base font-bold text-[#6B6B6B]">Nenhuma partida em andamento no momento.</p>
        </div>
      ) : (
        <div className="flex-1 px-4 pb-10 space-y-3 max-w-xl w-full mx-auto">
          {cards.map(c => (
            <button
              key={c.match.id}
              onClick={() => onSelect(c.match.id)}
              className="w-full text-left bg-[#161616] border border-[#242424] rounded-2xl px-5 py-4 hover:border-[#C8F135]/40 active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {c.courtName && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1C1C1C] text-[#888888]">📍 {c.courtName}</span>
                )}
                {c.categoryName && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1C1C1C] text-[#888888]">{c.categoryName}</span>
                )}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 ml-auto shrink-0">
                  ● Ao vivo
                </span>
              </div>
              <p className="text-base font-bold leading-snug">
                {name(c.match.team1_p1)} + {name(c.match.team1_p2)}
              </p>
              <p className="text-[10px] font-black text-[#444444] uppercase tracking-widest my-1">vs</p>
              <p className="text-base font-bold leading-snug">
                {name(c.match.team2_p1)} + {name(c.match.team2_p2)}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Score entry — big, touch-friendly, isolated (no app chrome/links) ──

function ScoreScreen({ tournamentName, card, name, rules, onBack, onSaved }: {
  tournamentName: string
  card:           MatchCardInfo
  name:           (id: string) => string
  rules:          MatchRules
  onBack:         () => void
  onSaved:        () => void
}) {
  const { match } = card
  const max = maxScore(rules)
  const [s1, setS1]   = useState<number | ''>(0)
  const [s2, setS2]   = useState<number | ''>(0)
  const [tb1, setTb1] = useState<number | ''>(0)
  const [tb2, setTb2] = useState<number | ''>(0)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const isSoma = rules.type === 'sum_of_games'
  const n1 = s1 === '' ? 0 : s1
  const n2 = s2 === '' ? 0 : s2
  const isTied6x6 = !isSoma && rules.deuce === 'super_tiebreak' &&
    s1 !== '' && s2 !== '' && n1 === rules.max_games && n2 === rules.max_games

  const tbN1 = tb1 === '' ? 0 : tb1
  const tbN2 = tb2 === '' ? 0 : tb2
  const tbValid = isTied6x6 && tb1 !== '' && tb2 !== '' &&
    Math.max(tbN1, tbN2) >= rules.tiebreak_to && Math.abs(tbN1 - tbN2) >= 1

  const canSave = (() => {
    if (s1 === '' || s2 === '') return false
    if (isTied6x6) return tbValid
    return isValidFinalScore(n1, n2, rules)
  })()

  async function save() {
    if (!canSave || saving) return
    setSaving(true)
    setError(null)
    const finalS1 = isTied6x6 ? (tbN1 > tbN2 ? rules.max_games + 1 : rules.max_games) : n1
    const finalS2 = isTied6x6 ? (tbN2 > tbN1 ? rules.max_games + 1 : rules.max_games) : n2
    const result = await submitMatchResult(match.id, finalS1, finalS2)
    setSaving(false)
    if (!result.ok) {
      setError(result.error ?? 'Não foi possível salvar o resultado.')
      return
    }
    setSaved(true)
    setTimeout(onSaved, 2000)
  }

  if (saved) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#0A0A0A] text-[#F0F0F0] px-8 text-center animate-scale-in">
        <span className="text-7xl">✅</span>
        <p className="font-display text-2xl font-bold uppercase">Resultado salvo!</p>
        <p className="text-sm font-bold text-[#888888]">Voltando para a lista de partidas…</p>
      </div>
    )
  }

  const team1 = `${name(match.team1_p1)} + ${name(match.team1_p2)}`
  const team2 = `${name(match.team2_p1)} + ${name(match.team2_p2)}`

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0A0A0A] text-[#F0F0F0] px-5 py-6 overflow-y-auto">

      <div className="shrink-0 flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="text-xs font-bold text-[#888888] hover:text-[#F0F0F0] transition-colors px-2 py-1 -ml-2"
        >
          ← Voltar
        </button>
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#888888]">{tournamentName}</p>
        <span className="w-12" aria-hidden />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-8 max-w-sm w-full mx-auto">

        <div className="flex items-center gap-2 flex-wrap justify-center">
          {card.courtName && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1C1C1C] text-[#888888]">📍 {card.courtName}</span>
          )}
          {card.categoryName && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1C1C1C] text-[#888888]">{card.categoryName}</span>
          )}
        </div>

        <div className="w-full space-y-1.5 text-center">
          <p className="text-lg font-bold leading-snug">{team1}</p>
          <p className="text-xs font-black text-[#444444] uppercase tracking-widest">vs</p>
          <p className="text-lg font-bold leading-snug">{team2}</p>
        </div>

        <div className="flex items-center justify-center gap-6">
          <ScoreStepper value={s1} onChange={setS1} max={max} label={team1} />
          <span className="text-3xl font-black text-[#444444]">×</span>
          <ScoreStepper value={s2} onChange={setS2} max={max} label={team2} />
        </div>

        {isTied6x6 && (
          <div className="flex flex-col items-center gap-2 animate-fade-in">
            <span className="text-xs font-black text-amber-400 uppercase tracking-widest">
              Tie-break até {rules.tiebreak_to}
            </span>
            <div className="flex items-center gap-4">
              <ScoreStepper value={tb1} onChange={setTb1} max={99} label="TB 1" small />
              <span className="text-xl font-black text-amber-400/60">×</span>
              <ScoreStepper value={tb2} onChange={setTb2} max={99} label="TB 2" small />
            </div>
          </div>
        )}

        {error && (
          <p className="text-center text-sm font-bold text-[#FF4444] animate-fade-in">⚠️ {error}</p>
        )}

        <button
          onClick={save}
          disabled={!canSave || saving}
          className="w-full py-6 rounded-2xl bg-[#C8F135] text-[#0A0A0A] text-lg font-black uppercase tracking-wide disabled:opacity-30 active:scale-[0.97] transition-all"
        >
          {saving ? 'Salvando…' : '✓ Confirmar resultado'}
        </button>
      </div>

    </div>
  )
}

// ── Big tap-friendly +/- stepper — no keyboard needed courtside ────

function ScoreStepper({ value, onChange, max, label, small }: {
  value:    number | ''
  onChange: (v: number | '') => void
  max:      number
  label:    string
  small?:   boolean
}) {
  const n = value === '' ? 0 : value
  return (
    <div className="flex flex-col items-center gap-2">
      {!small && (
        <p className="text-[9px] font-bold text-[#6B6B6B] uppercase tracking-wide text-center max-w-[90px] truncate">{label}</p>
      )}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, n - 1))}
          className={`rounded-full border-2 border-[#242424] font-black text-[#888888] active:scale-90 active:bg-[#1C1C1C] transition-all ${
            small ? 'w-9 h-9 text-lg' : 'w-12 h-12 text-2xl'
          }`}
        >
          −
        </button>
        <span className={`font-display font-bold tabular-nums text-center ${small ? 'text-3xl w-9' : 'text-6xl w-16'}`}>
          {n}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, n + 1))}
          className={`rounded-full border-2 border-[#242424] font-black text-[#888888] active:scale-90 active:bg-[#1C1C1C] transition-all ${
            small ? 'w-9 h-9 text-lg' : 'w-12 h-12 text-2xl'
          }`}
        >
          +
        </button>
      </div>
    </div>
  )
}
