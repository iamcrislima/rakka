'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Props {
  matchId: string
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="stepper-btn w-12 h-12 rounded-full bg-slate-100 text-slate-600 text-xl font-black flex items-center justify-center active:bg-slate-200"
      >
        −
      </button>
      <span className="w-10 text-center text-4xl font-black text-slate-800 tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="stepper-btn w-12 h-12 rounded-full bg-sky-100 text-sky-700 text-xl font-black flex items-center justify-center active:bg-sky-200"
      >
        +
      </button>
    </div>
  )
}

export default function ScoreInput({ matchId }: Props) {
  const router   = useRouter()
  const [s1, setS1]     = useState(0)
  const [s2, setS2]     = useState(0)
  const [saving, setSaving] = useState(false)
  const [done, setDone]   = useState(false)

  const canSave = s1 !== s2

  async function save() {
    if (!canSave || saving) return
    setSaving(true)
    await supabase
      .from('matches')
      .update({ score1: s1, score2: s2, status: 'done' })
      .eq('id', matchId)
    setDone(true)
    router.refresh()
  }

  if (done) {
    return (
      <div className="flex items-center justify-center gap-2 py-2 text-emerald-600 font-bold text-sm">
        <span>✓</span> Resultado salvo
      </div>
    )
  }

  return (
    <div className="space-y-4 pt-1">
      <div className="flex items-center justify-around">
        <Stepper value={s1} onChange={setS1} />
        <span className="text-2xl font-black text-slate-200">×</span>
        <Stepper value={s2} onChange={setS2} />
      </div>
      {s1 === s2 && s1 > 0 && (
        <p className="text-center text-xs text-amber-500 font-semibold">
          Empate não é permitido — ajuste o placar
        </p>
      )}
      <button
        onClick={save}
        disabled={!canSave || saving}
        className="w-full bg-emerald-500 text-white font-black py-3.5 rounded-xl disabled:opacity-30 active:bg-emerald-600 active:scale-[0.98] transition-all text-base shadow-md shadow-emerald-100"
      >
        {saving ? 'Salvando...' : '✓ Confirmar resultado'}
      </button>
    </div>
  )
}
