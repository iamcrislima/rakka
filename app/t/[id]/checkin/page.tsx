import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Category, Player } from '@/types'
import CheckInList, { type CheckInCategoryGroup } from './CheckInList'

export default async function CheckInPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: t }, { data: players }, { data: cats }] = await Promise.all([
    supabase.from('tournaments').select('id, name').eq('id', id).single(),
    supabase.from('players').select('id, name, category_id, checked_in').eq('tournament_id', id).order('position'),
    supabase.from('categories').select('*').eq('tournament_id', id).order('sort_order').order('created_at'),
  ])

  if (!t) notFound()

  const allPlayers    = (players ?? []) as Pick<Player, 'id' | 'name' | 'category_id' | 'checked_in'>[]
  const allCategories = (cats ?? []) as Category[]

  const groups: CheckInCategoryGroup[] = allCategories.length > 0
    ? allCategories.map(c => ({
        id:      c.id,
        name:    c.name,
        players: allPlayers.filter(p => p.category_id === c.id).map(p => ({ id: p.id, name: p.name, checked_in: p.checked_in })),
      })).filter(g => g.players.length > 0)
    : [{
        id:      'all',
        name:    'Jogadores',
        players: allPlayers.map(p => ({ id: p.id, name: p.name, checked_in: p.checked_in })),
      }]

  return <CheckInList tournamentName={t.name as string} groups={groups} />
}
