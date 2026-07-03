import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Tournament, Category, Court } from '@/types'
import SettingsPanel from './SettingsPanel'

export default async function TournamentSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: tournament }, { data: categories }, { data: courts }] = await Promise.all([
    supabase.from('tournaments').select('id, name').eq('id', id).single(),
    supabase.from('categories').select('*').eq('tournament_id', id).order('sort_order').order('created_at'),
    supabase.from('courts').select('*').eq('tournament_id', id).order('sort_order'),
  ])

  if (!tournament) notFound()

  return (
    <SettingsPanel
      tournament={tournament as Pick<Tournament, 'id' | 'name'>}
      categories={(categories ?? []) as Category[]}
      courts={(courts ?? []) as Court[]}
    />
  )
}
