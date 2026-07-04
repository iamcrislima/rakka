'use client'

import { useState } from 'react'
import { PRESETS, deuceOptions, rulesHint, detectPreset, toMatchRules, DEFAULT_TARGET_SUM } from '@/lib/match-rules'
import type { MatchRules, CategoryFormat, CategoryGender, CategoryLevel } from '@/types'
import { createTournamentFromBuilder, type CategoryInput } from './actions'
import AdminPageContainer from '@/app/components/AdminPageContainer'

// ── Types ─────────────────────────────────────────────────────

type TType     = 'super' | 'doubles'
type EntryMode = 'manual' | 'registration'

interface CategoryDraft extends Omit<CategoryInput, 'deuce'> {
  _key:  string
  deuce: 'tiebreak' | 'super_tiebreak'
}

interface WizardState {
  tournamentName: string
  type:           TType
  categories:     CategoryDraft[]
}

// ── Constants ─────────────────────────────────────────────────

const LIMIT_OPTS = [8, 12, 16, 24, 32] as const

const GENDERS: { value: CategoryGender; label: string; short: string }[] = [
  { value: 'mens',   label: 'Masculino', short: 'Masc' },
  { value: 'womens', label: 'Feminino',  short: 'Fem'  },
  { value: 'mixed',  label: 'Misto',     short: 'Misto' },
]

const LEVELS: CategoryLevel[] = ['E', 'D', 'C', 'B', 'Open']

const GENDER_LABEL: Record<CategoryGender, string> = {
  mens:   'Masculino',
  womens: 'Feminino',
  mixed:  'Misto',
}

const FORMAT_OPTS: { value: CategoryFormat; label: string; desc: string }[] = [
  { value: 'round_robin',    label: 'Round Robin',        desc: 'Todos jogam contra todos' },
  { value: 'group_playoffs', label: 'Grupos + Playoffs',  desc: 'Top 2 avançam para o mata-mata' },
  { value: 'super8_misto',   label: 'Super Oito Misto',   desc: '8M+8F · duplas rotativas, sem dupla fixa · Rei/Rainha da Quadra' },
]

function makeCategoryName(gender: CategoryGender | null, level: CategoryLevel | null): string {
  if (gender && level) return `${GENDER_LABEL[gender]} ${level}`
  if (gender) return GENDER_LABEL[gender]
  if (level) return level
  return ''
}

function newCat(gender: CategoryGender | null = null, level: CategoryLevel | null = null): CategoryDraft {
  return {
    _key:               Math.random().toString(36).slice(2),
    name:               makeCategoryName(gender, level),
    playerLimit:        8,
    entryMode:          'manual',
    maxGames:           6,
    deuce:              'super_tiebreak',
    tiebreakTo:         7,
    ruleType:           'standard',
    targetSum:          null,
    priceEnabled:       false,
    price:              '',
    paymentMode:        'individual',
    format:             'group_playoffs',
    consolationBracket: false,
    gender,
    level,
  }
}

// ── Step indicators ───────────────────────────────────────────

const STEP_LABELS: Record<string, string> = {
  basics:     'Evento',
  categories: 'Categorias',
  entry:      'Inscrição',
  rules:      'Regras',
  payment:    'Pagamento',
  review:     'Revisar',
}

function StepDots({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 shrink-0">
      {steps.map((s, i) => {
        const done   = i < current
        const active = i === current
        return (
          <div key={s} className="flex items-center gap-1 shrink-0">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black transition-colors ${
              active ? 'bg-[#C8F135] text-[#0A0A0A]' :
              done   ? 'bg-emerald-500/15 text-emerald-400' :
                       'bg-[#1C1C1C] text-[#888888]'
            }`}>
              {done ? '✓' : <span className="tabular-nums">{i + 1}</span>}
              <span className="hidden sm:inline">{STEP_LABELS[s]}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-4 h-px ${done ? 'bg-emerald-500/40' : 'bg-[#242424]'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 1: Basics ────────────────────────────────────────────

function StepBasics({ state, setState }: {
  state:    WizardState
  setState: React.Dispatch<React.SetStateAction<WizardState>>
}) {
  return (
    <div className="space-y-7">
      <div>
        <h2 className="font-display text-xl font-bold uppercase text-[#F0F0F0]">Novo torneio</h2>
        <p className="text-sm text-[#888888] mt-1">Como vamos chamar este evento?</p>
      </div>

      {/* Name — capped narrower than the step column itself so a single-line
          field doesn't turn into a giant bar just because the page is wide. */}
      <div className="space-y-2 max-w-md">
        <label className="text-xs font-black text-[#888888] uppercase tracking-widest">
          Nome do evento
        </label>
        <input
          autoFocus
          placeholder="Ex: Copa de Verão 2026"
          value={state.tournamentName}
          onChange={e => setState(s => ({ ...s, tournamentName: e.target.value }))}
          className="w-full bg-[#111111] border-2 border-[#242424] focus:border-[#C8F135] rounded-xl px-4 py-3 text-base font-semibold focus:outline-none transition-colors"
        />
      </div>

      {/* Type */}
      <div className="space-y-3">
        <label className="text-xs font-black text-[#888888] uppercase tracking-widest">
          Formato do torneio
        </label>
        <div className="grid grid-cols-2 gap-3">
          {([
            {
              value: 'super' as const,
              icon:  '🎾',
              label: 'Super',
              desc:  'Rotação individual',
              note:  '8 a 32 jogadores por categoria',
            },
            {
              value: 'doubles' as const,
              icon:  '👥',
              label: 'Duplas',
              desc:  'Pares fixos',
              note:  'Parceiros por toda a disputa',
            },
          ]).map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setState(s => ({ ...s, type: opt.value }))}
              className={`relative flex flex-col gap-2 p-4 rounded-2xl text-left transition-all ${
                state.type === opt.value
                  ? 'border-[3px] border-[#C8F135] bg-[#1C1C1C]'
                  : 'border-2 border-[#242424] hover:border-[#3a3a3a] bg-[#161616]'
              }`}
            >
              {/* Filled checkmark badge — "selected" is a distinct concept
                  from the keyboard focus ring, not just a color match. */}
              {state.type === opt.value && (
                <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#C8F135] text-[#0A0A0A] text-[11px] font-black flex items-center justify-center leading-none">
                  ✓
                </span>
              )}
              <span className="text-3xl">{opt.icon}</span>
              <div>
                <p className={`font-black text-sm ${state.type === opt.value ? 'text-[#C8F135]' : 'text-[#F0F0F0]'}`}>
                  {opt.label}
                </p>
                <p className={`text-xs font-semibold mt-0.5 ${state.type === opt.value ? 'text-[#C8F135]' : 'text-[#888888]'}`}>
                  {opt.desc}
                </p>
                <p className="text-[10px] text-[#888888] mt-1">{opt.note}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Step 2: Categories ────────────────────────────────────────

function CategoryCard({
  cat,
  isDoubles,
  onUpdate,
  onRemove,
}: {
  cat:      CategoryDraft
  isDoubles: boolean
  onUpdate: (patch: Partial<CategoryDraft>) => void
  onRemove: () => void
}) {
  const limitLabel = isDoubles ? 'duplas' : 'jogadores'

  return (
    <div className="bg-[#161616] border-2 border-[#242424] rounded-2xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-base">🏷️</span>
        <p className="flex-1 text-sm font-black text-[#F0F0F0]">{cat.name}</p>
        <button
          type="button"
          onClick={onRemove}
          className="text-[#6B6B6B] hover:text-[#FF4444] transition-colors font-black text-sm px-1"
        >
          ✕
        </button>
      </div>

      {/* Size */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-black text-[#888888] uppercase tracking-widest">
          Limite de {limitLabel}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {LIMIT_OPTS.map(n => (
            <button
              key={n}
              type="button"
              onClick={() => onUpdate({ playerLimit: n })}
              className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 transition-colors ${
                cat.playerLimit === n
                  ? 'border-[#C8F135] bg-[#1C1C1C] text-[#C8F135]'
                  : 'border-[#242424] text-[#888888] hover:border-[#3a3a3a]'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Format */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-black text-[#888888] uppercase tracking-widest">Modo</p>
        <div className="grid grid-cols-2 gap-2">
          {FORMAT_OPTS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onUpdate({
                format: opt.value,
                consolationBracket: opt.value === 'round_robin' ? false : cat.consolationBracket,
                // Super Oito Misto always needs exactly 8 men + 8 women — not a preference.
                playerLimit: opt.value === 'super8_misto' ? 16 : cat.playerLimit,
              })}
              className={`flex flex-col gap-0.5 p-3 rounded-xl border-2 text-left transition-all ${
                cat.format === opt.value
                  ? 'border-[#C8F135] bg-[#1C1C1C]'
                  : 'border-[#242424] hover:border-[#3a3a3a]'
              }`}
            >
              <p className={`text-xs font-black ${cat.format === opt.value ? 'text-[#C8F135]' : 'text-[#F0F0F0]'}`}>
                {opt.label}
              </p>
              <p className="text-[10px] text-[#888888] leading-snug">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Consolation bracket */}
      {cat.format === 'group_playoffs' && (
        <button
          type="button"
          onClick={() => onUpdate({ consolationBracket: !cat.consolationBracket })}
          className={`flex items-center gap-3 w-full p-3 rounded-xl border-2 text-left transition-all ${
            cat.consolationBracket
              ? 'border-[#C8F135] bg-[#1C1C1C]'
              : 'border-[#242424] hover:border-[#3a3a3a]'
          }`}
        >
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
            cat.consolationBracket ? 'border-[#C8F135] bg-[#C8F135]' : 'border-[#444444]'
          }`}>
            {cat.consolationBracket && <span className="text-[#0A0A0A] text-[10px] font-black leading-none">✓</span>}
          </div>
          <div>
            <p className={`text-xs font-black ${cat.consolationBracket ? 'text-[#C8F135]' : 'text-[#F0F0F0]'}`}>
              Chave de consolação
            </p>
            <p className="text-[10px] text-[#888888]">Disputa de 3º lugar entre eliminados</p>
          </div>
        </button>
      )}
    </div>
  )
}

function StepCategories({ state, setState }: {
  state:    WizardState
  setState: React.Dispatch<React.SetStateAction<WizardState>>
}) {
  const [activeGender, setActiveGender] = useState<CategoryGender>('mens')
  const [customName,   setCustomName]   = useState('')
  const [showCustom,   setShowCustom]   = useState(false)
  const isDoubles = state.type === 'doubles'

  function hasCat(gender: CategoryGender, level: CategoryLevel) {
    return state.categories.some(c => c.gender === gender && c.level === level)
  }

  function toggleCat(gender: CategoryGender, level: CategoryLevel) {
    if (hasCat(gender, level)) {
      setState(s => ({
        ...s,
        categories: s.categories.filter(c => !(c.gender === gender && c.level === level)),
      }))
    } else {
      setState(s => ({ ...s, categories: [...s.categories, newCat(gender, level)] }))
    }
  }

  function addCustom(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    if (state.categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) return
    setState(s => ({ ...s, categories: [...s.categories, newCat(null, null)] }))
    // Update name on the newly added cat
    setState(s => ({
      ...s,
      categories: s.categories.map((c, i) =>
        i === s.categories.length - 1 ? { ...c, name: trimmed } : c
      ),
    }))
    setCustomName('')
    setShowCustom(false)
  }

  function updateCat(key: string, patch: Partial<CategoryDraft>) {
    setState(s => ({
      ...s,
      categories: s.categories.map(c => c._key === key ? { ...c, ...patch } : c),
    }))
  }

  function removeCat(key: string) {
    setState(s => ({ ...s, categories: s.categories.filter(c => c._key !== key) }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold uppercase text-[#F0F0F0]">Categorias</h2>
        <p className="text-sm text-[#888888] mt-1">Cada categoria é uma chave independente.</p>
      </div>

      {/* Gender/level matrix */}
      <div className="space-y-3 max-w-2xl">
        <p className="text-xs font-black text-[#888888] uppercase tracking-widest">Adicionar categoria</p>

        {/* Gender tabs */}
        <div className="flex gap-2">
          {GENDERS.map(g => (
            <button
              key={g.value}
              type="button"
              onClick={() => setActiveGender(g.value)}
              className={`flex-1 py-2 rounded-xl text-xs font-black border-2 transition-colors ${
                activeGender === g.value
                  ? 'border-[#C8F135] bg-[#1C1C1C] text-[#C8F135]'
                  : 'border-[#242424] text-[#888888] hover:border-[#3a3a3a]'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* Level pills */}
        <div className="flex gap-2">
          {LEVELS.map(lvl => {
            const active = hasCat(activeGender, lvl)
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => toggleCat(activeGender, lvl)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-black border-2 transition-all ${
                  active
                    ? 'border-[#C8F135] bg-[#C8F135] text-[#0A0A0A]'
                    : 'border-[#242424] text-[#888888] hover:border-[#C8F135] hover:text-[#C8F135]'
                }`}
              >
                {active ? '✓' : lvl}
              </button>
            )
          })}
        </div>
      </div>

      {/* Custom category */}
      <div className="max-w-2xl">
        {!showCustom ? (
          <button
            type="button"
            onClick={() => setShowCustom(true)}
            className="text-xs font-bold text-[#888888] hover:text-[#C8F135] transition-colors"
          >
            + Categoria personalizada
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              autoFocus
              placeholder="Nome da categoria"
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustom(customName)}
              className="flex-1 bg-[#111111] border-2 border-[#242424] focus:border-[#C8F135] rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none transition-colors"
            />
            <button
              type="button"
              onClick={() => addCustom(customName)}
              disabled={!customName.trim()}
              className="px-4 py-2.5 bg-[#C8F135] text-[#0A0A0A] text-sm font-black rounded-xl disabled:opacity-40 hover:bg-[#D4F54A] transition-colors"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => { setShowCustom(false); setCustomName('') }}
              className="px-3 py-2.5 border-2 border-[#242424] text-[#888888] text-sm font-bold rounded-xl hover:border-[#3a3a3a] transition-colors"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Category cards */}
      {state.categories.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-black text-[#888888] uppercase tracking-widest">
            {state.categories.length} categori{state.categories.length !== 1 ? 'as' : 'a'} selecionada{state.categories.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {state.categories.map(cat => (
              <CategoryCard
                key={cat._key}
                cat={cat}
                isDoubles={isDoubles}
                onUpdate={patch => updateCat(cat._key, patch)}
                onRemove={() => removeCat(cat._key)}
              />
            ))}
          </div>
        </div>
      )}

      {state.categories.length === 0 && (
        <p className="text-xs text-amber-400 font-semibold flex items-center gap-1.5">
          <span>⚠️</span> Selecione pelo menos uma categoria para continuar.
        </p>
      )}
    </div>
  )
}

// ── Step 3: Entry mode ────────────────────────────────────────

function StepEntry({ state, setState }: {
  state:    WizardState
  setState: React.Dispatch<React.SetStateAction<WizardState>>
}) {
  const isDoubles = state.type === 'doubles'

  function setMode(key: string, mode: EntryMode) {
    setState(s => ({
      ...s,
      categories: s.categories.map(c => c._key === key ? { ...c, entryMode: mode } : c),
    }))
  }

  function applyAll(mode: EntryMode) {
    setState(s => ({
      ...s,
      categories: s.categories.map(c => ({ ...c, entryMode: mode })),
    }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold uppercase text-[#F0F0F0]">Modo de inscrição</h2>
        <p className="text-sm text-[#888888] mt-1">
          Como os {isDoubles ? 'participantes' : 'jogadores'} entrarão em cada categoria?
        </p>
      </div>

      {/* Apply all shortcuts */}
      <div className="flex gap-2 max-w-2xl">
        <button type="button" onClick={() => applyAll('manual')}
          className="flex-1 py-2 text-xs font-bold border-2 border-[#242424] rounded-xl text-[#888888] hover:border-[#3a3a3a] transition-colors">
          Manual para todas
        </button>
        <button type="button" onClick={() => applyAll('registration')}
          className="flex-1 py-2 text-xs font-bold border-2 border-emerald-500/30 rounded-xl text-emerald-400 hover:border-emerald-500/60 transition-colors">
          Inscrição aberta para todas
        </button>
      </div>

      {/* Per-category */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {state.categories.map(cat => (
          <div key={cat._key} className="bg-[#161616] border-2 border-[#242424] rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">🏷️</span>
              <p className="text-sm font-black text-[#F0F0F0]">{cat.name}</p>
              <span className="text-[10px] font-bold text-[#6B6B6B]">
                {cat.playerLimit} {isDoubles ? 'duplas' : 'jogadores'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'manual'       as const, icon: '✏️', label: 'Cadastro manual',  desc: 'Você insere os nomes' },
                { value: 'registration' as const, icon: '🔗', label: 'Inscrição aberta', desc: 'Link compartilhável'  },
              ]).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMode(cat._key, opt.value)}
                  className={`flex flex-col gap-1 p-3 rounded-xl border-2 text-left transition-all ${
                    cat.entryMode === opt.value
                      ? 'border-[#C8F135] bg-[#1C1C1C]'
                      : 'border-[#242424] hover:border-[#3a3a3a]'
                  }`}
                >
                  <span className="text-base">{opt.icon}</span>
                  <p className={`text-xs font-black ${cat.entryMode === opt.value ? 'text-[#C8F135]' : 'text-[#F0F0F0]'}`}>
                    {opt.label}
                  </p>
                  <p className="text-[10px] text-[#888888] leading-snug">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Step 4: Match rules ───────────────────────────────────────

function RulesEditor({ cat, onChange }: {
  cat:      CategoryDraft
  onChange: (patch: Partial<CategoryDraft>) => void
}) {
  const rules: MatchRules = toMatchRules(cat)
  const isSoma   = cat.ruleType === 'sum_of_games'
  const preset   = isSoma ? 'custom' : detectPreset(rules)
  const [custom, setCustom] = useState(!isSoma && preset === 'custom')

  function applyPreset(key: keyof typeof PRESETS) {
    const r = PRESETS[key].rules
    onChange({ ruleType: 'standard', maxGames: r.max_games, deuce: r.deuce, tiebreakTo: r.tiebreak_to })
    setCustom(false)
  }

  function applySumOfGames() {
    onChange({ ruleType: 'sum_of_games', targetSum: cat.targetSum ?? DEFAULT_TARGET_SUM })
    setCustom(false)
  }

  function toggleCustom() {
    if (custom) { setCustom(false); return }
    onChange({ ruleType: 'standard' })
    setCustom(true)
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {(Object.entries(PRESETS) as [keyof typeof PRESETS, typeof PRESETS[keyof typeof PRESETS]][]).map(([k, p]) => (
          <button
            key={k}
            type="button"
            onClick={() => applyPreset(k)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-xs font-bold transition-colors ${
              preset === k && !custom
                ? 'border-[#C8F135] bg-[#1C1C1C] text-[#C8F135]'
                : 'border-[#242424] text-[#888888] hover:border-[#3a3a3a]'
            }`}
          >
            {p.icon} {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={applySumOfGames}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-xs font-bold transition-colors ${
            isSoma
              ? 'border-[#C8F135] bg-[#1C1C1C] text-[#C8F135]'
              : 'border-[#242424] text-[#888888] hover:border-[#3a3a3a]'
          }`}
        >
          🔢 Soma de Games
        </button>
        <button
          type="button"
          onClick={toggleCustom}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-xs font-bold transition-colors ${
            custom
              ? 'border-[#666666] bg-[#1C1C1C] text-[#F0F0F0]'
              : 'border-[#242424] text-[#888888] hover:border-[#3a3a3a]'
          }`}
        >
          ⚙️ Personalizado
        </button>
      </div>

      {isSoma && (
        <div className="bg-[#111111] rounded-xl p-3 space-y-2 border border-[#242424]">
          <p className="text-[10px] font-black text-[#888888] uppercase tracking-widest">Soma alvo</p>
          <input
            type="number"
            min={1}
            value={cat.targetSum ?? DEFAULT_TARGET_SUM}
            onChange={e => onChange({ targetSum: parseInt(e.target.value, 10) || DEFAULT_TARGET_SUM })}
            className="w-24 bg-[#161616] border-2 border-[#242424] focus:border-[#C8F135] rounded-xl px-3 py-2 text-base font-black text-[#F0F0F0] focus:outline-none transition-colors"
          />
          <p className="text-[11px] text-[#888888] font-medium">{rulesHint(rules)}</p>
        </div>
      )}

      {!custom && !isSoma && (
        <p className="text-[11px] text-[#888888] font-medium">{rulesHint(rules)}</p>
      )}

      {custom && (
        <div className="bg-[#111111] rounded-xl p-3 space-y-3 border border-[#242424]">
          <div className="space-y-1.5">
            <p className="text-[10px] font-black text-[#888888] uppercase tracking-widest">Jogos</p>
            <div className="flex gap-2">
              {([4, 6] as const).map(n => (
                <button key={n} type="button"
                  onClick={() => onChange({ maxGames: n })}
                  className={`px-4 py-2 rounded-xl text-sm font-black border-2 transition-colors ${
                    cat.maxGames === n
                      ? 'border-[#C8F135] bg-[#1C1C1C] text-[#C8F135]'
                      : 'border-[#242424] text-[#888888]'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-black text-[#888888] uppercase tracking-widest">Empate</p>
            <div className="space-y-1.5">
              {deuceOptions(cat.maxGames).map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => onChange({ deuce: opt.value })}
                  className={`w-full flex items-start gap-2 p-2.5 rounded-xl border-2 text-left transition-colors ${
                    cat.deuce === opt.value
                      ? 'border-[#C8F135] bg-[#1C1C1C]'
                      : 'border-[#242424] hover:border-[#3a3a3a]'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                    cat.deuce === opt.value ? 'border-[#C8F135]' : 'border-[#444444]'
                  }`}>
                    {cat.deuce === opt.value && <div className="w-2 h-2 bg-[#C8F135] rounded-full" />}
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${cat.deuce === opt.value ? 'text-[#C8F135]' : 'text-[#F0F0F0]'}`}>
                      {opt.label}
                    </p>
                    <p className="text-[10px] text-[#888888]">{opt.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-black text-[#888888] uppercase tracking-widest">Tie-break até</p>
            <div className="flex gap-2">
              {([7, 10] as const).map(n => (
                <button key={n} type="button"
                  onClick={() => onChange({ tiebreakTo: n })}
                  className={`px-4 py-2 rounded-xl text-sm font-black border-2 transition-colors ${
                    cat.tiebreakTo === n
                      ? 'border-[#C8F135] bg-[#1C1C1C] text-[#C8F135]'
                      : 'border-[#242424] text-[#888888]'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StepRules({ state, setState }: {
  state:    WizardState
  setState: React.Dispatch<React.SetStateAction<WizardState>>
}) {
  function updateCat(key: string, patch: Partial<CategoryDraft>) {
    setState(s => ({
      ...s,
      categories: s.categories.map(c => c._key === key ? { ...c, ...patch } : c),
    }))
  }

  function applyAllRules(key: string) {
    const src = state.categories.find(c => c._key === key)
    if (!src) return
    setState(s => ({
      ...s,
      categories: s.categories.map(c => ({
        ...c,
        maxGames:   src.maxGames,
        deuce:      src.deuce,
        tiebreakTo: src.tiebreakTo,
        ruleType:   src.ruleType,
        targetSum:  src.targetSum,
      })),
    }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold uppercase text-[#F0F0F0]">Regras das partidas</h2>
        <p className="text-sm text-[#888888] mt-1">Configure o formato de cada categoria.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {state.categories.map((cat, i) => (
          <div key={cat._key} className="bg-[#161616] border-2 border-[#242424] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">🏷️</span>
                <p className="text-sm font-black text-[#F0F0F0]">{cat.name}</p>
              </div>
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => applyAllRules(cat._key)}
                  className="text-[10px] font-bold text-[#C8F135] hover:text-[#C8F135] transition-colors"
                >
                  Aplicar a todas ↓
                </button>
              )}
            </div>
            <RulesEditor
              cat={cat}
              onChange={(patch) => updateCat(cat._key, patch)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Step 5: Payment ───────────────────────────────────────────

function StepPayment({ state, setState }: {
  state:    WizardState
  setState: React.Dispatch<React.SetStateAction<WizardState>>
}) {
  const isDoubles = state.type === 'doubles'
  const regCats   = state.categories.filter(c => c.entryMode === 'registration')

  function updateCat(key: string, patch: Partial<CategoryDraft>) {
    setState(s => ({
      ...s,
      categories: s.categories.map(c => c._key === key ? { ...c, ...patch } : c),
    }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold uppercase text-[#F0F0F0]">Pagamento</h2>
        <p className="text-sm text-[#888888] mt-1">
          Configure a cobrança nas categorias com inscrição aberta.
        </p>
      </div>

      <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
        <span className="text-lg shrink-0 mt-0.5">💡</span>
        <p className="text-xs text-amber-400 leading-snug">
          O valor é exibido para os jogadores no link de inscrição. O recebimento do pagamento é gerenciado por você fora do sistema.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {regCats.map(cat => (
          <div key={cat._key} className="bg-[#161616] border-2 border-[#242424] rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm">🔗</span>
              <p className="text-sm font-black text-[#F0F0F0]">{cat.name}</p>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                inscrição aberta
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {([
                { value: false, icon: '🆓', label: 'Gratuito' },
                { value: true,  icon: '💳', label: 'Com cobrança' },
              ] as const).map(opt => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => updateCat(cat._key, { priceEnabled: opt.value })}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-colors ${
                    cat.priceEnabled === opt.value
                      ? 'border-[#C8F135] bg-[#1C1C1C]'
                      : 'border-[#242424] hover:border-[#3a3a3a]'
                  }`}
                >
                  <span className="text-base">{opt.icon}</span>
                  <span className={`text-xs font-black ${cat.priceEnabled === opt.value ? 'text-[#C8F135]' : 'text-[#F0F0F0]'}`}>
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>

            {cat.priceEnabled && (
              <div className="space-y-3 animate-fade-in">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-[#888888] uppercase tracking-widest">
                    Valor (R$)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#888888]">R$</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="50,00"
                      value={cat.price}
                      onChange={e => updateCat(cat._key, { price: e.target.value })}
                      className="flex-1 border-2 border-[#242424] focus:border-[#C8F135] rounded-xl px-3 py-2 text-sm font-bold focus:outline-none
                                 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-[#888888] uppercase tracking-widest">
                    Cobrança por
                  </label>
                  <div className="flex gap-2">
                    {([
                      { value: 'individual' as const, label: isDoubles ? 'Dupla' : 'Jogador' },
                      { value: 'pair'       as const, label: 'Par'    },
                    ]).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateCat(cat._key, { paymentMode: opt.value })}
                        className={`flex-1 py-2 rounded-xl border-2 text-xs font-bold transition-colors ${
                          cat.paymentMode === opt.value
                            ? 'border-[#C8F135] bg-[#1C1C1C] text-[#C8F135]'
                            : 'border-[#242424] text-[#888888] hover:border-[#3a3a3a]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Step 6: Review ────────────────────────────────────────────

const FORMAT_LABEL: Record<CategoryFormat, string> = {
  round_robin:    'Round Robin',
  group_playoffs: 'Grupos + Playoffs',
  super8_misto:   'Super Oito Misto',
}

const ENTRY_LABEL: Record<EntryMode, string> = {
  manual:       'Cadastro manual',
  registration: 'Inscrição aberta',
}

function StepReview({ state, submitting, error }: {
  state:      WizardState
  submitting: boolean
  error:      string
}) {
  const isDoubles = state.type === 'doubles'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold uppercase text-[#F0F0F0]">Tudo pronto?</h2>
        <p className="text-sm text-[#888888] mt-1">Revise antes de criar.</p>
      </div>

      <div className="rounded-2xl p-5 space-y-1 border border-[#242424] max-w-2xl">
        <p className="text-[10px] font-black text-[#888888] uppercase tracking-widest">Torneio</p>
        <p className="text-xl font-black text-[#F0F0F0] leading-tight">{state.tournamentName || '—'}</p>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#1C1C1C] rounded-full text-xs font-bold text-[#888888]">
          {isDoubles ? '👥 Duplas' : '🎾 Super'}
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-black text-[#888888] uppercase tracking-widest">
          {state.categories.length} categori{state.categories.length !== 1 ? 'as' : 'a'}
        </p>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {state.categories.map(cat => {
            const rules: MatchRules = toMatchRules(cat)
            return (
              <div key={cat._key} className="bg-[#161616] border border-[#242424] rounded-2xl p-4 space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-[#F0F0F0]">{cat.name}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    cat.entryMode === 'registration'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-[#1C1C1C] text-[#888888]'
                  }`}>
                    {ENTRY_LABEL[cat.entryMode]}
                  </span>
                </div>
                <p className="text-xs text-[#888888] font-medium">
                  {cat.playerLimit} {isDoubles ? 'duplas' : 'jogadores'}
                  {' · '}{FORMAT_LABEL[cat.format]}
                  {cat.format === 'group_playoffs' && cat.consolationBracket && ' · com consolação'}
                  {' · '}{rulesHint(rules)}
                </p>
                {cat.entryMode === 'registration' && cat.priceEnabled && cat.price && (
                  <p className="text-xs font-bold text-[#C8F135]">
                    R$ {parseFloat(cat.price).toFixed(2)} / {cat.paymentMode === 'pair' ? 'par' : isDoubles ? 'dupla' : 'jogador'}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-[#FF4444] text-sm font-medium px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {submitting && (
        <div className="flex items-center gap-3 text-sm text-[#888888] font-medium">
          <span className="w-4 h-4 border-2 border-[#444444] border-t-[#C8F135] rounded-full animate-spin" />
          Criando torneio...
        </div>
      )}
    </div>
  )
}

// ── Success view ──────────────────────────────────────────────

function SuccessView({ tournamentId, tournamentName, registrationLinks, manualCategories }: {
  tournamentId:       string
  tournamentName:     string
  registrationLinks:  Array<{ categoryName: string; token: string }>
  manualCategories:   string[]
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  function copy(token: string) {
    navigator.clipboard.writeText(`${origin}/registrations/${token}`)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-2 py-4">
        <p className="text-5xl">🎉</p>
        <p className="text-2xl font-black text-[#F0F0F0]">Torneio criado!</p>
        <p className="text-sm text-[#888888]">{tournamentName}</p>
      </div>

      <a
        href={`/admin/tournaments/${tournamentId}`}
        className="btn-primary flex items-center justify-center gap-2 w-full py-3.5 font-black"
      >
        🏆 Acessar torneio
      </a>

      {registrationLinks.length > 0 && (
        <div className="bg-[#161616] border border-[#242424] rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 bg-[#111111] border-b border-[#242424]">
            <p className="text-xs font-black text-[#888888] uppercase tracking-widest">🔗 Links de inscrição</p>
            <p className="text-[11px] text-[#888888] mt-0.5">Compartilhe com os jogadores</p>
          </div>
          <div className="divide-y divide-[#242424]">
            {registrationLinks.map(({ categoryName, token }) => (
              <div key={token} className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-[#F0F0F0]">{categoryName}</p>
                  <p className="text-[11px] text-[#888888] font-mono truncate">/registrations/{token}</p>
                </div>
                <button
                  onClick={() => copy(token)}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    copied === token
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-[#1C1C1C] text-[#C8F135] hover:bg-[#242424]'
                  }`}
                >
                  {copied === token ? '✓ Copiado' : 'Copiar link'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {manualCategories.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-1.5">
          <p className="text-xs font-black text-amber-400 uppercase tracking-widest">📋 Cadastro manual</p>
          <p className="text-xs text-amber-400 leading-snug">
            Acesse cada categoria no torneio para adicionar os jogadores manualmente.
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {manualCategories.map(name => (
              <span key={name} className="text-[11px] font-bold text-amber-400 bg-amber-500/15 px-2.5 py-1 rounded-lg">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Wizard shell ──────────────────────────────────────────────

type StepId = 'basics' | 'categories' | 'entry' | 'rules' | 'payment' | 'review'

function computeSteps(state: WizardState): StepId[] {
  const hasRegistration = state.categories.some(c => c.entryMode === 'registration')
  return [
    'basics',
    'categories',
    'entry',
    'rules',
    ...(hasRegistration ? (['payment'] as StepId[]) : []),
    'review',
  ]
}

function canAdvance(step: StepId, state: WizardState): boolean {
  if (step === 'basics')     return state.tournamentName.trim().length > 0
  if (step === 'categories') return state.categories.length > 0 && state.categories.every(c => c.name.trim())
  return true
}

export default function BuilderWizard() {
  const [stepIdx,    setStepIdx]    = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')
  const [success,    setSuccess]    = useState<{
    id:                string
    name:              string
    registrationLinks: Array<{ categoryName: string; token: string }>
    manualCategories:  string[]
  } | null>(null)

  const [state, setState] = useState<WizardState>({
    tournamentName: '',
    type:           'super',
    categories:     [],
  })

  const steps   = computeSteps(state)
  const stepId  = steps[stepIdx]
  const isFirst = stepIdx === 0
  const isLast  = stepId === 'review'
  const canNext = canAdvance(stepId, state)

  function next() { if (canNext) setStepIdx(i => Math.min(i + 1, steps.length - 1)) }
  function back() { setStepIdx(i => Math.max(i - 1, 0)) }

  async function handleCreate() {
    setSubmitting(true)
    setError('')

    let res: Awaited<ReturnType<typeof createTournamentFromBuilder>>
    try {
      res = await createTournamentFromBuilder(
        state.tournamentName,
        state.type,
        state.categories,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const isNetwork = msg.includes('fetch failed') || msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')
      setError(isNetwork
        ? 'Sem conexão com o servidor. Verifique se o Supabase está ativo no dashboard (supabase.com).'
        : `Erro inesperado: ${msg}`,
      )
      setSubmitting(false)
      return
    }

    if ('error' in res) {
      setError(res.error)
      setSubmitting(false)
      return
    }

    setSuccess({
      id:                res.id,
      name:              state.tournamentName,
      registrationLinks: res.registrationLinks,
      manualCategories:  state.categories.filter(c => c.entryMode === 'manual').map(c => c.name),
    })
    setSubmitting(false)
  }

  if (success) {
    return (
      <AdminPageContainer className="animate-fade-in">
        <div className="max-w-2xl mx-auto">
          <SuccessView
            tournamentId={success.id}
            tournamentName={success.name}
            registrationLinks={success.registrationLinks}
            manualCategories={success.manualCategories}
          />
        </div>
      </AdminPageContainer>
    )
  }

  return (
    <AdminPageContainer>
      {/* Full page width now, matching every other admin screen — only the
          actual free-text inputs (see StepBasics, the custom-category
          field) get their own narrow cap, not the whole step column. */}
      <div className="space-y-6">

        <StepDots steps={steps} current={stepIdx} />

        <div className="min-h-[380px]">
          {stepId === 'basics'     && <StepBasics     state={state} setState={setState} />}
          {stepId === 'categories' && <StepCategories state={state} setState={setState} />}
          {stepId === 'entry'      && <StepEntry      state={state} setState={setState} />}
          {stepId === 'rules'      && <StepRules      state={state} setState={setState} />}
          {stepId === 'payment'    && <StepPayment    state={state} setState={setState} />}
          {stepId === 'review'     && (
            <StepReview state={state} submitting={submitting} error={error} />
          )}
        </div>

        <div className="flex gap-3 pt-2 max-w-md">
          {!isFirst && (
            <button
              type="button"
              onClick={back}
              disabled={submitting}
              className="px-6 py-3 border-2 border-[#242424] text-[#888888] font-bold rounded-xl hover:border-[#3a3a3a] transition-colors disabled:opacity-40"
            >
              ← Voltar
            </button>
          )}
          {isLast ? (
            <button
              type="button"
              onClick={handleCreate}
              disabled={submitting || state.categories.length === 0}
              className="flex-1 py-3.5 btn-primary flex-1 py-3.5 font-black disabled:opacity-40 active:scale-[0.97] transition-transform"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Criando...
                </span>
              ) : (
                '🎾 Criar torneio'
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={next}
              disabled={!canNext}
              className="flex-1 py-3 bg-[#C8F135] text-[#0A0A0A] font-black rounded-xl disabled:opacity-40 hover:bg-[#D4F54A] transition-colors"
            >
              Próximo →
            </button>
          )}
        </div>
      </div>
    </AdminPageContainer>
  )
}
