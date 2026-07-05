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

  // `select('*')` rather than an explicit column list: this page must
  // degrade to "not checked in yet" rather than fail outright if the
  // `checked_in` column isn't there yet on a database that hasn't run
  // migration 023_checkin.sql — an explicit `select('id, ..., checked_in')`
  // throws a hard Postgres error on a missing column and returns null data,
  // which previously wiped out the ENTIRE player list (every category
  // showed empty, indistinguishable from "no players match your search").
  const [{ data: t }, { data: players }, { data: cats }] = await Promise.all([
    supabase.from('tournaments').select('id, name').eq('id', id).single(),
    supabase.from('players').select('*').eq('tournament_id', id).order('position'),
    supabase.from('categories').select('*').eq('tournament_id', id).order('sort_order').order('created_at'),
  ])

  if (!t) notFound()

  const allPlayers    = (players ?? []) as Player[]
  const allCategories = (cats ?? []) as Category[]

  const groups: CheckInCategoryGroup[] = allCategories.length > 0
    ? allCategories.map(c => ({
        id:      c.id,
        name:    c.name,
        players: allPlayers.filter(p => p.category_id === c.id).map(p => ({ id: p.id, name: p.name, checked_in: p.checked_in ?? false })),
      })).filter(g => g.players.length > 0)
    : [{
        id:      'all',
        name:    'Jogadores',
        players: allPlayers.map(p => ({ id: p.id, name: p.name, checked_in: p.checked_in ?? false })),
      }]

  return <CheckInList tournamentId={id} tournamentName={t.name as string} groups={groups} />
}
