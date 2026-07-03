'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  SCORING_PRESETS, DEFAULT_SCORING,
  type ScoringPresetKey,
} from '@/lib/league-scoring'
import type { ScoringRules } from '@/types'

const POSITIONS = [
  { key: '1', label: '🥇 1º lugar' },
  { key: '2', label: '🥈 2º lugar' },
  { key: '3', label: '🥉 3º lugar' },
  { key: '4', label: '4º lugar' },
  { key: '5', label: '5º–6º lugar' },
  { key: '7', label: '7º–8º lugar' },
]

export default function NewLeaguePage() {
  const router  = useRouter()
  const supabase = createClient()

  const [name, setName]             = useState('')
  const [description, setDesc]      = useState('')
  const [rules, setRules]           = useState<ScoringRules>(DEFAULT_SCORING)
  const [preset, setPreset]         = useState<ScoringPresetKey | 'custom'>('padrao')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  function applyPreset(key: ScoringPresetKey) {
    setPreset(key)
    setRules({ ...SCORING_PRESETS[key].rules })
  }

  function updateRule(posKey: string, value: string) {
    setPreset('custom')
    const n = parseInt(value, 10)
    setRules(prev => ({ ...prev, [posKey]: isNaN(n) || n < 0 ? 0 : n }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: league, error: err } = await supabase
        .from('leagues')
        .insert({
          name:        name.trim(),
          description: description.trim() || null,
          scoring:     rules,
          user_id:     user?.id ?? null,
        })
        .select()
        .single()
      if (err) throw err
      router.push(`/admin/leagues/${league.id}`)
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Erro desconhecido'
      setError(msg)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7 animate-fade-in max-w-lg mx-auto lg:py-4">

      {/* Header */}
      <div className="space-y-1">
        <p className="text-[11px] font-black uppercase tracking-widest text-[#888888]">Nova liga</p>
        <h1 className="text-2xl font-black text-[#F0F0F0]">Configurar liga</h1>
      </div>

      {/* Basic info */}
      <Section label="Informações">
        <input
          type="text"
          required
          placeholder="Nome da liga"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full bg-[#111111] border-2 border-[#242424] focus:border-[#C8F135] rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none transition-colors"
        />
        <input
          type="text"
          placeholder="Descrição (opcional)"
          value={description}
          onChange={e => setDesc(e.target.value)}
          className="w-full bg-[#111111] border-2 border-[#242424] focus:border-[#C8F135] rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none transition-colors"
        />
      </Section>

      {/* Scoring rules */}
      <Section label="Pontuação">
        {/* Presets */}
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(SCORING_PRESETS) as [ScoringPresetKey, typeof SCORING_PRESETS[ScoringPresetKey]][]).map(([key, p]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className={`px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                preset === key
                  ? 'border-[#C8F135] bg-[#1C1C1C]'
                  : 'border-[#242424] bg-[#161616] hover:border-[#3a3a3a]'
              }`}
            >
              <p className={`text-xs font-black ${preset === key ? 'text-[#C8F135]' : 'text-[#F0F0F0]'}`}>
                {p.label}
              </p>
              <p className="text-[10px] text-[#888888] mt-0.5 leading-tight">{p.description}</p>
            </button>
          ))}
        </div>

        {/* Custom scoring grid */}
        <div className="bg-[#111111] rounded-xl p-4 space-y-2.5">
          <p className="text-[10px] font-black text-[#888888] uppercase tracking-widest">
            {preset === 'custom' ? 'Personalizado' : 'Pontos por posição'}
          </p>
          {POSITIONS.map(pos => (
            <div key={pos.key} className="flex items-center gap-3">
              <span className="text-sm font-semibold text-[#888888] flex-1">{pos.label}</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={rules[pos.key] ?? 0}
                  onChange={e => updateRule(pos.key, e.target.value)}
                  className="w-16 text-center bg-[#161616] border-2 border-[#242424] focus:border-[#C8F135] rounded-lg px-2 py-1.5 text-sm font-black focus:outline-none
                             [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-xs text-[#888888] font-semibold">pts</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {error && <p className="text-sm text-[#FF4444] font-semibold">{error}</p>}

      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white font-black py-3.5 rounded-xl text-sm disabled:opacity-50 active:scale-[0.97] transition-transform"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
            Criando...
          </span>
        ) : (
          'Criar liga'
        )}
      </button>

    </form>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-[#888888] uppercase tracking-wide">{label}</p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}
