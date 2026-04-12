'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { shuffle } from '@/lib/group-assignment'
import type { Player } from '@/types'

interface Props {
  tournamentId: string
  players: Player[]
}

export default function ShuffleGroupsButton({ tournamentId, players }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [spun, setSpun]       = useState(false)

  async function handleShuffle() {
    setLoading(true)
    setSpun(false)

    // New random positions for the same 8 players
    const shuffledIds = shuffle(players.map(p => p.id))

    // Update each player's position
    await Promise.all(
      shuffledIds.map((id, i) =>
        supabase.from('players').update({ position: i + 1 }).eq('id', id).eq('tournament_id', tournamentId)
      )
    )

    setSpun(true)
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={handleShuffle}
      disabled={loading}
      className={`w-full flex items-center justify-center gap-2 border-2 font-bold text-sm py-3.5 rounded-2xl transition-all active:scale-[0.98] disabled:opacity-40 ${
        spun
          ? 'border-emerald-300 text-emerald-600 bg-emerald-50'
          : 'border-slate-200 text-slate-600 bg-white'
      }`}
    >
      <span className={loading ? 'animate-spin' : ''}>🔀</span>
      {loading ? 'Sorteando...' : spun ? 'Sortear novamente' : 'Sortear grupos'}
    </button>
  )
}
