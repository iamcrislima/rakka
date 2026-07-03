'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { KnockoutSeed } from '@/lib/match-generator'

interface Props {
  tournamentId: string
  categoryId?:  string
  seeds:        KnockoutSeed[]
}

export default function GenerateFinalsButton({ tournamentId, categoryId, seeds }: Props) {
  const router    = useRouter()
  const [loading, setLoading] = useState(false)

  async function generate() {
    setLoading(true)

    const rows = seeds.map(s => ({
      ...s,
      tournament_id: tournamentId,
      ...(categoryId ? { category_id: categoryId } : {}),
      status: 'pending',
    }))

    const { error } = await supabase.from('matches').insert(rows)

    if (!error) {
      if (categoryId) {
        await supabase.from('categories').update({ status: 'finals' }).eq('id', categoryId)
        await supabase.from('tournaments')
          .update({ status: 'finals' })
          .eq('id', tournamentId)
          .in('status', ['draft', 'group_stage'])
      } else {
        await supabase.from('tournaments').update({ status: 'finals' }).eq('id', tournamentId)
      }
    }

    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={generate}
      disabled={loading}
      className="ring-pulse w-full bg-gradient-to-r from-amber-400 to-orange-400 text-white font-black text-base py-4 rounded-xl disabled:opacity-50 active:scale-[0.97] active:from-amber-500 active:to-orange-500 transition-transform"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
          Gerando finais...
        </span>
      ) : (
        '⚡ Gerar Finais'
      )}
    </button>
  )
}
