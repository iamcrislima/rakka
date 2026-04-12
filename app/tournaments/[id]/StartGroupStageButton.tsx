'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Player } from '@/types'
import type { MatchSeed } from '@/lib/match-generator'

interface Props {
  tournamentId: string
  players: Player[]
  matchSeeds: MatchSeed[]
}

export default function StartGroupStageButton({ tournamentId, matchSeeds }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function start() {
    setLoading(true)

    // Insert all 6 group matches
    const { error: mErr } = await supabase
      .from('matches')
      .insert(matchSeeds.map(s => ({ ...s, tournament_id: tournamentId, status: 'pending' })))

    if (!mErr) {
      await supabase
        .from('tournaments')
        .update({ status: 'group_stage' })
        .eq('id', tournamentId)
    }

    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={start}
      disabled={loading}
      className="w-full bg-sky-600 text-white font-bold py-3 rounded-xl disabled:opacity-40 active:bg-sky-700"
    >
      {loading ? 'Gerando partidas...' : '▶ Iniciar Fase de Grupos'}
    </button>
  )
}
