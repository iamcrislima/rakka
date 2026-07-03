import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MuralUpload from './MuralUpload'

export default async function MuralUploadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: t } = await supabase.from('tournaments').select('id, name').eq('id', id).single()
  if (!t) notFound()

  return <MuralUpload tournamentId={id} tournamentName={t.name as string} />
}
