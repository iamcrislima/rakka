import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SUPER8_MISTO_MATCHES } from '@/lib/super8-misto'
import type { Category } from '@/types'
import NotReadyScreen from './NotReadyScreen'

/** Categories eligible for sharing: Super Oito Misto (the only format with a
 *  King/Queen result) whose 32 matches are all done — same gate the
 *  Cerimônia de Revelação itself uses. */
async function getEligibleCategories(tournamentId: string) {
  const supabase = await createClient()
  const { data: cats } = await supabase
    .from('categories')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('format', 'super8_misto')

  const categories = (cats ?? []) as Category[]
  if (categories.length === 0) return []

  const { data: matches } = await supabase
    .from('matches')
    .select('category_id, status')
    .in('category_id', categories.map(c => c.id))

  return categories.filter(cat => {
    const catMatches = (matches ?? []).filter(m => m.category_id === cat.id)
    return catMatches.length === SUPER8_MISTO_MATCHES && catMatches.every(m => m.status === 'done')
  })
}

export default async function CompartilharPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: tournament } = await supabase.from('tournaments').select('id, name').eq('id', id).single()
  if (!tournament) notFound()

  const eligible = await getEligibleCategories(id)

  if (eligible.length === 0) {
    return <NotReadyScreen tournamentId={id} reason="Nenhuma categoria com resultado concluído ainda." />
  }

  // Only one option — skip straight to the King/Queen picker.
  if (eligible.length === 1) {
    redirect(`/t/${id}/compartilhar/${eligible[0].id}`)
  }

  return (
    <div className="min-h-dvh bg-[#0A0A0A] text-[#F0F0F0] px-6 py-10 flex flex-col items-center gap-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/rakka-logo-full.svg" alt="Rakka" className="h-8 w-auto" />
      <div className="text-center space-y-1.5">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#888888]">{tournament.name as string}</p>
        <p className="font-display text-2xl font-bold uppercase text-[#C8F135]">Qual categoria?</p>
      </div>
      <div className="w-full max-w-sm space-y-3">
        {eligible.map(cat => (
          <Link
            key={cat.id}
            href={`/t/${id}/compartilhar/${cat.id}`}
            className="flex items-center justify-between px-5 py-4 rounded-2xl bg-[#161616] border border-[#242424] hover:border-[#C8F135]/40 transition-colors"
          >
            <span className="font-bold text-[#F0F0F0]">{cat.name}</span>
            <span className="text-[#6B6B6B]">→</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
