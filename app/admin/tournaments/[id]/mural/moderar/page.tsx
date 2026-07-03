import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { MuralPhoto } from '@/types'
import MuralModeration from './MuralModeration'

export default async function MuralModeratePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: t }, { data: photos }] = await Promise.all([
    supabase.from('tournaments').select('id, name').eq('id', id).single(),
    supabase.from('mural_photos').select('*').eq('tournament_id', id).order('created_at', { ascending: false }),
  ])

  if (!t) notFound()

  const rows = (photos ?? []) as MuralPhoto[]
  const withUrls = rows.map(p => ({
    ...p,
    url: supabase.storage.from('mural-photos').getPublicUrl(p.storage_path).data.publicUrl,
  }))

  return (
    <MuralModeration
      tournamentId={id}
      tournamentName={t.name as string}
      photos={withUrls}
    />
  )
}
