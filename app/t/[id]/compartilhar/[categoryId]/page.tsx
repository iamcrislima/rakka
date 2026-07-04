import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SUPER8_MISTO_MATCHES } from '@/lib/super8-misto'
import type { Category, Tournament } from '@/types'
import NotReadyScreen from '../NotReadyScreen'

export default async function CategoryShareGenderPage({
  params,
}: {
  params: Promise<{ id: string; categoryId: string }>
}) {
  const { id, categoryId } = await params
  const supabase = await createClient()

  const [{ data: t }, { data: cat }, { data: matches }] = await Promise.all([
    supabase.from('tournaments').select('id, name').eq('id', id).single(),
    supabase.from('categories').select('*').eq('id', categoryId).eq('tournament_id', id).single(),
    supabase.from('matches').select('status').eq('category_id', categoryId),
  ])

  if (!t || !cat) notFound()
  const tournament = t as Pick<Tournament, 'id' | 'name'>
  const category = cat as Category

  const allMatches = matches ?? []
  const complete = allMatches.length === SUPER8_MISTO_MATCHES && allMatches.every(m => m.status === 'done')
  if (!complete) {
    return <NotReadyScreen tournamentId={id} reason={`Aguardando o fim das 32 partidas de ${category.name}.`} />
  }

  return (
    <div className="min-h-dvh bg-[#0A0A0A] text-[#F0F0F0] px-6 py-10 flex flex-col items-center gap-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/rakka-logo-full.svg" alt="Rakka" className="h-8 w-auto" />
      <div className="text-center space-y-1.5">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#888888]">
          {tournament.name} · {category.name}
        </p>
        <p className="font-display text-2xl font-bold uppercase text-[#C8F135]">Quem você quer compartilhar?</p>
      </div>
      <div className="w-full max-w-sm space-y-3">
        <Link
          href={`/t/${id}/compartilhar/${categoryId}/rei`}
          className="flex items-center gap-3 px-5 py-5 rounded-2xl bg-[#161616] border border-[#242424] hover:border-[#C8F135]/40 transition-colors"
        >
          <span className="text-3xl leading-none">👑</span>
          <span className="font-black text-lg" style={{ color: '#C8F135' }}>Rei da Quadra</span>
        </Link>
        <Link
          href={`/t/${id}/compartilhar/${categoryId}/rainha`}
          className="flex items-center gap-3 px-5 py-5 rounded-2xl bg-[#161616] border border-[#242424] hover:border-pink-400/40 transition-colors"
        >
          <span className="text-3xl leading-none">👑</span>
          <span className="font-black text-lg text-pink-400">Rainha da Quadra</span>
        </Link>
      </div>
    </div>
  )
}
