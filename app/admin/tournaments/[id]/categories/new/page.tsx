'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { assignGroups } from '@/lib/group-assignment'
import {
  PRESETS, DEFAULT_RULES, DEFAULT_TARGET_SUM, detectPreset, maxScore, rulesHint, deuceOptions,
  sumOfGamesRules,
  type MatchRules, type PresetKey,
} from '@/lib/match-rules'
import type { CategoryFormat, PlayerGender } from '@/types'

const supabase = createClient()

const EMPTY       = Array.from({ length: 8 },  () => '')
const EMPTY_MISTO  = Array.from({ length: 16 }, () => '')

const MAX_GAMES: { value: MatchRules['max_games']; label: string }[] = [
  { value: 6, label: '6 games' },
  { value: 4, label: '4 games' },
]
const TIEBREAK_OPTIONS: { value: MatchRules['tiebreak_to']; label: string }[] = [
  { value: 7,  label: 'Até 7' },
  { value: 10, label: 'Até 10' },
]

const FORMAT_CHOICES: { value: CategoryFormat; label: string; desc: string; icon: string }[] = [
  { value: 'group_playoffs', label: 'Grupos tradicionais', desc: '8 jogadores · duplas fixas por grupo', icon: '🏆' },
  { value: 'super8_misto',   label: 'Super Oito Misto',    desc: '8H + 8F · duplas rotativas · Rei/Rainha da Quadra', icon: '🔀' },
]

export default function NewCategoryPage() {
  const router = useRouter()
  const { id: tournamentId } = useParams<{ id: string }>()

  const [categoryName, setCategoryName] = useState('')
  const [format,        setFormat]       = useState<CategoryFormat>('group_playoffs')
  const [players,      setPlayers]      = useState<string[]>(EMPTY)
  const [rules,        setRules]        = useState<MatchRules>(DEFAULT_RULES)
  const [isCustomMode, setCustom]       = useState(false)
  const [scheduledAt,  setScheduledAt]  = useState('')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')

  const isMisto = format === 'super8_misto'
  const slots   = isMisto ? 16 : 8

  function changeFormat(next: CategoryFormat) {
    setFormat(next)
    setPlayers(next === 'super8_misto' ? [...EMPTY_MISTO] : [...EMPTY])
  }

  const setPlayer = (i: number, val: string) =>
    setPlayers(prev => prev.map((p, idx) => idx === i ? val : p))

  const filled       = players.filter(p => p.trim().length > 0).length
  const valid        = categoryName.trim().length > 0 && filled === slots
  const isSoma        = rules.type === 'sum_of_games'
  const activePreset  = isCustomMode || isSoma ? null : detectPreset(rules)
  const currentDeuceOptions = deuceOptions(rules.max_games)

  function applyPreset(key: PresetKey) {
    setRules({ ...PRESETS[key].rules })
    setCustom(false)
  }

  function applySumOfGames() {
    setRules(sumOfGamesRules(rules.targetSum ?? DEFAULT_TARGET_SUM))
    setCustom(false)
  }

  function patchRules<K extends keyof MatchRules>(key: K, value: MatchRules[K]) {
    setRules(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setLoading(true)
    setError('')

    try {
      // 1. Count existing categories to set sort_order
      const { count } = await supabase
        .from('categories')
        .select('id', { count: 'exact', head: true })
        .eq('tournament_id', tournamentId)

      // 2. Create category
      const { data: cat, error: catErr } = await supabase
        .from('categories')
        .insert({
          tournament_id: tournamentId,
          name:          categoryName.trim(),
          status:        'draft',
          format,
          max_games:     rules.max_games,
          deuce:         rules.deuce,
          tiebreak_to:   rules.tiebreak_to,
          rule_type:     rules.type,
          target_sum:    rules.targetSum,
          sort_order:    count ?? 0,
          scheduled_at:  scheduledAt ? new Date(scheduledAt).toISOString() : null,
        })
        .select()
        .single()
      if (catErr) throw catErr

      // 3. Create players linked to category
      //    Super Oito Misto needs a deterministic split (first 8 slots =
      //    men position 1-8, next 8 = women position 1-8) so the partner
      //    rotation is well-defined — no shuffling here.
      const playerRows = isMisto
        ? players.map((name, i) => ({
            tournament_id: tournamentId,
            category_id:   cat.id,
            name:          name.trim(),
            gender:        (i < 8 ? 'M' : 'F') as PlayerGender,
            position:      (i % 8) + 1,
          }))
        : assignGroups(players).map(a => ({
            tournament_id: tournamentId,
            category_id:   cat.id,
            name:          a.name,
            gender:        'M' as PlayerGender,   // not meaningful for this format
            position:      a.position,
          }))

      const { error: pErr } = await supabase.from('players').insert(playerRows)
      if (pErr) throw pErr

      router.push(`/admin/tournaments/${tournamentId}/categories/${cat.id}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message
        : (typeof err === 'object' && err && 'message' in err) ? String((err as { message: unknown }).message)
        : String(err)
      setError(msg || 'Erro ao criar categoria.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7 animate-fade-in max-w-lg mx-auto lg:py-4">

      {/* Header */}
      <div>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">
          Nova categoria
        </p>
        <h1 className="text-2xl font-black text-slate-800">Adicionar categoria</h1>
        <p className="text-sm text-slate-400 mt-1">
          Cada categoria tem seus próprios jogadores, partidas e ranking.
        </p>
      </div>

      {/* Category name */}
      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-600">Nome da categoria</label>
        <input
          className="w-full bg-white border-2 border-slate-200 focus:border-sky-400 rounded-xl px-4 py-3.5 text-base font-semibold focus:outline-none transition-colors"
          placeholder="Ex: Masculino D, Feminino B, Misto C…"
          value={categoryName}
          onChange={e => setCategoryName(e.target.value)}
          autoFocus
          required
        />
      </div>

      {/* Format */}
      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-600">Formato</label>
        <div className="grid grid-cols-1 gap-2">
          {FORMAT_CHOICES.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => changeFormat(opt.value)}
              className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${
                format === opt.value ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-white'
              }`}
            >
              <span className="text-xl leading-none">{opt.icon}</span>
              <div>
                <p className={`text-sm font-black ${format === opt.value ? 'text-sky-700' : 'text-slate-700'}`}>{opt.label}</p>
                <p className="text-[11px] text-slate-400 leading-snug">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Scheduled start */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-slate-600">Horário de início</label>
          <span className="text-xs text-slate-400 font-medium">Opcional</span>
        </div>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={e => setScheduledAt(e.target.value)}
          className="w-full bg-white border-2 border-slate-200 focus:border-sky-400 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none transition-colors"
        />
        {scheduledAt && (
          <p className="text-xs text-sky-600 font-semibold bg-sky-50 border border-sky-100 rounded-lg px-3 py-2">
            ⏰ Partidas ficam bloqueadas até {new Date(scheduledAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
        )}
      </div>

      {/* Players */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-slate-600">Jogadores</label>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full transition-colors ${
            filled === slots ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
          }`}>
            {filled}/{slots}
          </span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${filled === slots ? 'bg-emerald-500' : 'bg-sky-500'}`}
            style={{ width: `${(filled / slots) * 100}%` }}
          />
        </div>

        {isMisto && (
          <p className="text-[11px] font-bold text-violet-500 uppercase tracking-wide">🙋‍♂️ Homens</p>
        )}
        <div className="space-y-2">
          {players.slice(0, isMisto ? 8 : slots).map((_, i) => (
            <div key={i} className={`flex items-center gap-3 border-2 rounded-xl px-3 py-2.5 transition-colors ${
              players[i].trim() ? 'border-sky-200 bg-sky-50/50' : 'border-slate-100 bg-white'
            }`}>
              <div className={`w-8 h-8 rounded-full text-white text-xs font-black flex items-center justify-center shrink-0 transition-colors ${
                players[i].trim() ? 'bg-sky-500' : 'bg-slate-200'
              }`}>
                {players[i].trim()
                  ? players[i][0].toUpperCase()
                  : <span className="text-slate-400 text-[11px]">{i + 1}</span>}
              </div>
              <input
                className="flex-1 bg-transparent text-sm font-semibold text-slate-700 placeholder:text-slate-300 rounded"
                placeholder={isMisto ? `Homem ${i + 1}` : `Jogador ${i + 1}`}
                value={players[i]}
                onChange={e => setPlayer(i, e.target.value)}
                required
              />
              {players[i].trim() && (
                <button type="button" onClick={() => setPlayer(i, '')} className="text-slate-300 text-lg leading-none active:text-slate-500">×</button>
              )}
            </div>
          ))}
        </div>

        {isMisto && (
          <>
            <p className="text-[11px] font-bold text-pink-500 uppercase tracking-wide pt-1">🙋‍♀️ Mulheres</p>
            <div className="space-y-2">
              {players.slice(8, 16).map((_, j) => {
                const i = j + 8
                return (
                  <div key={i} className={`flex items-center gap-3 border-2 rounded-xl px-3 py-2.5 transition-colors ${
                    players[i].trim() ? 'border-pink-200 bg-pink-50/50' : 'border-slate-100 bg-white'
                  }`}>
                    <div className={`w-8 h-8 rounded-full text-white text-xs font-black flex items-center justify-center shrink-0 transition-colors ${
                      players[i].trim() ? 'bg-pink-500' : 'bg-slate-200'
                    }`}>
                      {players[i].trim()
                        ? players[i][0].toUpperCase()
                        : <span className="text-slate-400 text-[11px]">{j + 1}</span>}
                    </div>
                    <input
                      className="flex-1 bg-transparent text-sm font-semibold text-slate-700 placeholder:text-slate-300 rounded"
                      placeholder={`Mulher ${j + 1}`}
                      value={players[i]}
                      onChange={e => setPlayer(i, e.target.value)}
                      required
                    />
                    {players[i].trim() && (
                      <button type="button" onClick={() => setPlayer(i, '')} className="text-slate-300 text-lg leading-none active:text-slate-500">×</button>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Match rules */}
      <div className="space-y-4">
        <div>
          <p className="text-sm font-bold text-slate-600">Regras da partida</p>
          <p className="text-xs text-slate-400 mt-0.5">Escolha um preset ou personalize</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(PRESETS) as [PresetKey, typeof PRESETS[PresetKey]][]).map(([key, p]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className={`flex flex-col items-start gap-1.5 px-3 py-3 rounded-xl border-2 text-left transition-all active:scale-[0.97] ${
                activePreset === key ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-lg leading-none">{p.icon}</span>
                <span className={`text-sm font-black ${activePreset === key ? 'text-sky-700' : 'text-slate-700'}`}>{p.label}</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">{p.description}</p>
            </button>
          ))}
          <button
            type="button"
            onClick={applySumOfGames}
            className={`flex flex-col items-start gap-1.5 px-3 py-3 rounded-xl border-2 text-left transition-all active:scale-[0.97] col-span-2 ${
              isSoma ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-lg leading-none">🔢</span>
              <span className={`text-sm font-black ${isSoma ? 'text-sky-700' : 'text-slate-700'}`}>Soma de Games</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">Termina quando a soma dos games bater no alvo — sem vantagem, sem tie-break</p>
          </button>
        </div>

        {isSoma && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 animate-fade-in">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Soma alvo</label>
            <input
              type="number"
              min={1}
              value={rules.targetSum ?? DEFAULT_TARGET_SUM}
              onChange={e => setRules(r => ({ ...r, targetSum: parseInt(e.target.value, 10) || DEFAULT_TARGET_SUM }))}
              className="w-24 bg-white border-2 border-slate-200 focus:border-sky-400 rounded-xl px-3 py-2 text-base font-black text-slate-700 focus:outline-none transition-colors"
            />
            <p className="text-xs font-bold text-slate-500">{rulesHint(rules)}</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => { setRules(r => r.type === 'sum_of_games' ? DEFAULT_RULES : r); setCustom(prev => !prev) }}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-xs font-bold transition-all active:scale-[0.97] ${
            isCustomMode ? 'border-slate-400 bg-slate-50 text-slate-700' : 'border-dashed border-slate-200 text-slate-400'
          }`}
        >
          ⚙️ Personalizado
          {isCustomMode && <span className="text-slate-400 font-normal">— toque para fechar</span>}
        </button>

        {!isCustomMode && !isSoma && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 animate-fade-in">
            <p className="text-xs font-bold text-slate-500">{rulesHint(rules)}</p>
          </div>
        )}

        {isCustomMode && (
          <div className="space-y-4 animate-fade-in">
            <RulesRow label="Máximo de games">
              {MAX_GAMES.map(opt => (
                <OptionPill key={opt.value} selected={rules.max_games === opt.value} onClick={() => patchRules('max_games', opt.value)}>
                  {opt.label}
                </OptionPill>
              ))}
            </RulesRow>

            <RulesRow label="No game decisivo">
              <div className="flex flex-col gap-2 w-full">
                {currentDeuceOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => patchRules('deuce', opt.value)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all active:scale-[0.97] ${
                      rules.deuce === opt.value ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${rules.deuce === opt.value ? 'border-sky-500' : 'border-slate-300'}`}>
                      {rules.deuce === opt.value && <span className="w-2 h-2 rounded-full bg-sky-500 block" />}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-700">{opt.label}</p>
                      <p className="text-xs text-slate-400">{opt.sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            </RulesRow>

            <RulesRow label="Tie-break">
              {TIEBREAK_OPTIONS.map(opt => (
                <OptionPill key={opt.value} selected={rules.tiebreak_to === opt.value} onClick={() => patchRules('tiebreak_to', opt.value)}>
                  {opt.label}
                </OptionPill>
              ))}
            </RulesRow>

            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1">Resumo</p>
              <p className="text-xs font-bold text-slate-600">{rulesHint(rules)}</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Placar máximo: <strong className="text-slate-600">{maxScore(rules)}</strong> games
              </p>
            </div>
          </div>
        )}
      </div>

      {filled === slots && !isMisto && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 animate-scale-in">
          <span className="text-lg">🎲</span>
          <p className="text-sm font-semibold text-emerald-700">Grupos serão sorteados ao criar a categoria</p>
        </div>
      )}

      {filled === slots && isMisto && (
        <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 animate-scale-in">
          <span className="text-lg">🔀</span>
          <p className="text-sm font-semibold text-violet-700">8 rodadas serão geradas — cada homem joga com cada mulher uma vez</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm font-medium px-4 py-3 rounded-xl">{error}</div>
      )}

      <button
        type="submit"
        disabled={!valid || loading}
        className="w-full bg-gradient-to-r from-[#0F2044] to-[#1D4ED8] text-white font-black text-base py-4 rounded-2xl disabled:opacity-40 active:scale-[0.97] transition-transform shadow-lg shadow-blue-100"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
            Criando categoria...
          </span>
        ) : (
          isMisto ? '🔀 Criar categoria' : '🎲 Criar categoria e sortear grupos'
        )}
      </button>

    </form>
  )
}

function RulesRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function OptionPill({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-xl border-2 text-sm font-bold transition-all active:scale-[0.96] ${
        selected ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-500'
      }`}
    >
      {children}
    </button>
  )
}
