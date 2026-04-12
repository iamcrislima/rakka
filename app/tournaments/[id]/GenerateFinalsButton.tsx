'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { KnockoutSeed } from '@/lib/match-generator'

interface Props {
  tournamentId: string
  seeds: KnockoutSeed[]
}

export default function GenerateFinalsButton({ tournamentId, seeds }: Props) {
  const router  = useRouter()
  const [loading, setLoading] = useState(false)

  async function generate() {
    setLoading(true)
    const { error } = await supabase
      .from('matches')
      .insert(seeds.map(s => ({ ...s, tournament_id: tournamentId, status: 'pending' })))

    if (!error) {
      await supabase.from('tournaments').update({ status: 'finals' }).eq('id', tournamentId)
    }
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={generate}
      disabled={loading}
      className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-base py-4 rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-transform shadow-lg shadow-amber-100"
    >
      {loading ? '⏳ Gerando finais...' : '⚡ Gerar Finais'}
    </button>
  )
}
