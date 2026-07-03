'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Player } from '@/types'

interface Props {
  tournamentId: string
  categoryId?:  string
  players:      Player[]
}

/** Fisher-Yates — O(n), each permutation equally likely */
function fisherYates<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export default function ShuffleGroupsButton({ tournamentId, categoryId, players }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [count, setCount]     = useState(0)

  async function handleShuffle() {
    if (loading) return
    setLoading(true)

    const shuffledIds = fisherYates(players.map(p => p.id))

    await Promise.all(
      shuffledIds.map((id, i) => {
        let query = supabase
          .from('players')
          .update({ position: i + 1 })
          .eq('id', id)
          .eq('tournament_id', tournamentId)
        if (categoryId) query = query.eq('category_id', categoryId)
        return query
      })
    )

    setCount(n => n + 1)
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={handleShuffle}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 border-2 border-[#C8F135] bg-transparent hover:bg-[#C8F135]/10 text-[#C8F135] font-bold text-sm py-3.5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-40"
    >
      <span className={loading ? 'animate-spin inline-block' : 'inline-block'}>🔀</span>
      {loading ? 'Sorteando...' : count > 0 ? 'Sortear novamente' : 'Sortear grupos'}
    </button>
  )
}
