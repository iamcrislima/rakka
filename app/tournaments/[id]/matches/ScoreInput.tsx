'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Props {
  matchId:      string
  tournamentId: string
}

export default function ScoreInput({ matchId, tournamentId }: Props) {
  const router  = useRouter()
  const [s1, setS1] = useState('')
  const [s2, setS2] = useState('')
  const [saving, setSaving] = useState(false)

  const canSave = s1 !== '' && s2 !== '' && Number(s1) !== Number(s2)

  async function save() {
    if (!canSave) return
    setSaving(true)
    await supabase
      .from('matches')
      .update({ score1: Number(s1), score2: Number(s2), status: 'done' })
      .eq('id', matchId)
    router.refresh()
    setSaving(false)
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        className="w-14 border border-gray-200 rounded-lg text-center py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
        placeholder="0"
        value={s1}
        onChange={e => setS1(e.target.value)}
      />
      <span className="text-gray-300 font-bold">–</span>
      <input
        type="number"
        min={0}
        className="w-14 border border-gray-200 rounded-lg text-center py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
        placeholder="0"
        value={s2}
        onChange={e => setS2(e.target.value)}
      />
      <button
        onClick={save}
        disabled={!canSave || saving}
        className="ml-auto text-sm bg-sky-600 text-white font-semibold px-4 py-1.5 rounded-lg disabled:opacity-40 active:bg-sky-700"
      >
        {saving ? '...' : 'Salvar'}
      </button>
    </div>
  )
}
