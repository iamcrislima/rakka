'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Player } from '@/types'
import type { MatchSeed } from '@/lib/match-generator'

interface Props {
  tournamentId: string
  players:      Player[]
  matchSeeds:   MatchSeed[]
}

export default function StartGroupStageButton({ tournamentId, matchSeeds }: Props) {
  const router  = useRouter()
  const [loading, setLoading] = useState(false)

  async function start() {
    setLoading(true)
    const { error: mErr } = await supabase
      .from('matches')
      .insert(matchSeeds.map(s => ({ ...s, tournament_id: tournamentId, status: 'pending' })))

    if (!mErr) {
      await supabase.from('tournaments').update({ status: 'group_stage' }).eq('id', tournamentId)
    }
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={start}
      disabled={loading}
      className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-base py-4 rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-transform shadow-lg shadow-emerald-100"
    >
      {loading ? '⏳ Gerando partidas...' : '▶ Iniciar Fase de Grupos'}
    </button>
  )
}
