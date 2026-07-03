import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { TVContent, Court } from '@/types'
import TVAdminPanel from './TVAdminPanel'

export default async function TVAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: tournament }, { data: content }, { data: courts }] = await Promise.all([
    supabase.from('tournaments').select('id, name').eq('id', id).single(),
    supabase.from('tv_content').select('*').eq('tournament_id', id).order('sort_order'),
    supabase.from('courts').select('*').eq('tournament_id', id).order('sort_order'),
  ])

  if (!tournament) notFound()

  return (
    <TVAdminPanel
      tournamentId={id}
      items={(content ?? []) as TVContent[]}
      courts={(courts ?? []) as Court[]}
    />
  )
}
