import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { computeSuper8MistoResult, SUPER8_MISTO_MATCHES } from '@/lib/super8-misto'
import type { Match, Player } from '@/types'
import NotReadyScreen from '../../NotReadyScreen'
import ShareButton from './ShareButton'

export default async function ShareScreenPage({
  params,
}: {
  params: Promise<{ id: string; categoryId: string; kind: string }>
}) {
  const { id, categoryId, kind } = await params
  if (kind !== 'rei' && kind !== 'rainha') notFound()

  const supabase = await createClient()
  const [{ data: cat }, { data: players }, { data: matches }] = await Promise.all([
    supabase.from('categories').select('name').eq('id', categoryId).eq('tournament_id', id).single(),
    supabase.from('players').select('*').eq('category_id', categoryId),
    supabase.from('matches').select('*').eq('category_id', categoryId),
  ])

  if (!cat) notFound()

  const allMatches = (matches ?? []) as Match[]
  const complete = allMatches.length === SUPER8_MISTO_MATCHES && allMatches.every(m => m.status === 'done')
  if (!complete) {
    return <NotReadyScreen tournamentId={id} reason={`Aguardando o fim das 32 partidas de ${cat.name as string}.`} />
  }

  const { kingRanking, queenRanking } = computeSuper8MistoResult((players ?? []) as Player[], allMatches)
  const champion = (kind === 'rei' ? kingRanking : queenRanking)[0]
  if (!champion) {
    return <NotReadyScreen tournamentId={id} reason="Sem resultado suficiente para gerar a imagem." />
  }

  const imageUrl  = `/t/${id}/compartilhar/${categoryId}/${kind}/image`
  const title     = kind === 'rei' ? 'Rei da Quadra' : 'Rainha da Quadra'
  const fileName  = `rakka-${kind}-da-quadra-${champion.player.name.split(' ')[0].toLowerCase()}.png`

  return (
    <div className="min-h-dvh bg-[#0A0A0A] text-[#F0F0F0] px-6 py-8 flex flex-col items-center gap-6">
      <div className="text-center space-y-1">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#888888]">{title}</p>
        <p className="font-display text-xl font-bold uppercase text-[#C8F135]">{champion.player.name}</p>
      </div>

      <div className="w-full max-w-xs rounded-3xl overflow-hidden shadow-2xl border border-[#242424]" style={{ aspectRatio: '9 / 16' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={`${title} — ${champion.player.name}`} className="w-full h-full object-cover" />
      </div>

      <ShareButton imageUrl={imageUrl} fileName={fileName} title={title} championName={champion.player.name} />
    </div>
  )
}
