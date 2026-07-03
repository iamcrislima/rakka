'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Player } from '@/types'
import type { MatchSeed } from '@/lib/match-generator'

interface Props {
  tournamentId: string
  categoryId?:  string   // when set, targets the category instead of the tournament
  players:      Player[]
  matchSeeds:   MatchSeed[]
  label?:       string
}

export default function StartGroupStageButton({ tournamentId, categoryId, matchSeeds, label = '▶ Iniciar Fase de Grupos' }: Props) {
  const router    = useRouter()
  const [loading, setLoading] = useState(false)

  async function start() {
    setLoading(true)

    const rows = matchSeeds.map(s => ({
      ...s,
      tournament_id: tournamentId,
      ...(categoryId ? { category_id: categoryId } : {}),
      status: 'pending',
    }))

    const { error: mErr } = await supabase.from('matches').insert(rows)

    if (!mErr) {
      if (categoryId) {
        await supabase.from('categories').update({ status: 'group_stage' }).eq('id', categoryId)
        // Keep parent tournament status in sync (use the most advanced category status)
        await supabase.from('tournaments')
          .update({ status: 'group_stage' })
          .eq('id', tournamentId)
          .eq('status', 'draft')       // only advance, never regress
      } else {
        await supabase.from('tournaments').update({ status: 'group_stage' }).eq('id', tournamentId)
      }
    }

    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={start}
      disabled={loading}
      className="w-full bg-[#C8F135] hover:bg-[#D4F54A] text-[#0A0A0A] font-black text-base py-4 rounded-xl disabled:opacity-50 active:scale-[0.97] transition-all"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-[#0A0A0A]/30 border-t-[#0A0A0A] rounded-full animate-spin inline-block" />
          Gerando partidas...
        </span>
      ) : (
        label
      )}
    </button>
  )
}
