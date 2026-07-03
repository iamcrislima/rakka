import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { rulesFromCategory, rulesFromTournament } from '@/lib/match-rules'
import type { Tournament, Match, Court, Category } from '@/types'
import ResultadoPicker, { type MatchCardInfo } from './ResultadoPicker'

/**
 * Public, unauthenticated "lançar resultado" screen — one QR code for the
 * whole tournament (shown in Configurações), sitting on a single shared
 * tablet near the courts. Shows one card per court for whatever match is
 * currently up next there, the organizer taps the one that just finished
 * and enters the score. No per-court token needed — this isn't tied to a
 * specific court, it's tied to the tournament.
 */
export default async function LancarResultadoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: t }, { data: matches }, { data: courts }, { data: categories }, { data: players }] = await Promise.all([
    supabase.from('tournaments').select('*').eq('id', id).single(),
    supabase.from('matches').select('*').eq('tournament_id', id).eq('status', 'pending'),
    supabase.from('courts').select('*').eq('tournament_id', id).order('sort_order'),
    supabase.from('categories').select('*').eq('tournament_id', id),
    supabase.from('players').select('id, name').eq('tournament_id', id),
  ])

  if (!t) notFound()
  const tournament    = t as Tournament
  const allMatches    = (matches ?? []) as Match[]
  const allCourts     = (courts ?? []) as Court[]
  const allCategories = (categories ?? []) as Category[]
  const nameMap        = Object.fromEntries((players ?? []).map(p => [p.id as string, p.name as string]))
  const categoryMap    = Object.fromEntries(allCategories.map(c => [c.id, c]))

  // Same "is this match actually live yet" gate as the TV screen — respects
  // per-category scheduling and manual overrides.
  const now = new Date()
  function isActive(m: Match): boolean {
    if (m.override_active) return true
    if (!m.category_id)    return true
    const start = categoryMap[m.category_id]?.scheduled_at
    return !start || now >= new Date(start)
  }

  const activeMatches = allMatches.filter(isActive)

  // One card per court — whichever match is at the front of that court's
  // queue. Plus any active match that isn't assigned to a court at all.
  const byCourt = new Map<string, Match[]>()
  const unassigned: Match[] = []
  for (const m of activeMatches) {
    if (m.court_id) {
      const list = byCourt.get(m.court_id) ?? []
      list.push(m)
      byCourt.set(m.court_id, list)
    } else {
      unassigned.push(m)
    }
  }
  for (const list of byCourt.values()) {
    list.sort((a, b) => {
      const pa = a.queue_position ?? Infinity
      const pb = b.queue_position ?? Infinity
      if (pa !== pb) return pa - pb
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
  }

  const courtNameMap = Object.fromEntries(allCourts.map(c => [c.id, c.name]))

  const cards: MatchCardInfo[] = [
    ...allCourts
      .map(c => byCourt.get(c.id)?.[0])
      .filter((m): m is Match => m !== undefined)
      .map(m => ({ match: m, courtName: courtNameMap[m.court_id!] ?? null, categoryName: m.category_id ? (categoryMap[m.category_id]?.name ?? null) : null })),
    ...unassigned.map(m => ({ match: m, courtName: null, categoryName: m.category_id ? (categoryMap[m.category_id]?.name ?? null) : null })),
  ]

  // Rules per category (needed once a card is tapped) — default tournament
  // rules cover legacy matches with no category.
  const defaultRules = rulesFromTournament(tournament)
  const rulesByCategory = Object.fromEntries(
    allCategories.map(c => [c.id, rulesFromCategory(c)])
  )

  return (
    <ResultadoPicker
      tournamentName={tournament.name}
      cards={cards}
      nameMap={nameMap}
      defaultRules={defaultRules}
      rulesByCategory={rulesByCategory}
    />
  )
}
