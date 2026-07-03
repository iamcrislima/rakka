'use server'

import { createClient } from '@/lib/supabase/server'
import { assignCourts, type AssignOptions } from '@/lib/court-assignment'
import type { Court, Match, Category } from '@/types'

export async function autoAssignCourts(
  tournamentId: string,
  options: AssignOptions,
): Promise<{ assigned: number; skipped: number; error?: string }> {
  const supabase = await createClient()

  const [{ data: courts, error: ce }, { data: matches, error: me }, { data: cats, error: cae }] =
    await Promise.all([
      supabase.from('courts').select('*').eq('tournament_id', tournamentId).order('sort_order'),
      supabase.from('matches').select('*').eq('tournament_id', tournamentId).eq('status', 'pending'),
      supabase.from('categories').select('id, name, scheduled_at').eq('tournament_id', tournamentId),
    ])

  if (ce) return { assigned: 0, skipped: 0, error: ce.message }
  if (me) return { assigned: 0, skipped: 0, error: me.message }
  if (cae) return { assigned: 0, skipped: 0, error: cae.message }

  const allCourts  = (courts  ?? []) as Court[]
  const allMatches = (matches ?? []) as Match[]
  const allCats    = (cats    ?? []) as Pick<Category, 'id' | 'scheduled_at'>[]

  const categorySchedule: Record<string, string | null> = Object.fromEntries(
    allCats.map(c => [c.id, c.scheduled_at ?? null])
  )

  const { assignment, positions, skipped } = assignCourts(allCourts, allMatches, categorySchedule, options)

  // Per-match update includes both court_id and queue_position
  const updates = await Promise.all(
    Object.entries(assignment).map(([matchId, courtId]) =>
      supabase
        .from('matches')
        .update({ court_id: courtId, queue_position: positions[matchId] ?? 0 })
        .eq('id', matchId)
    )
  )

  const dbError = updates.find(r => r.error)?.error
  if (dbError) return { assigned: 0, skipped: 0, error: dbError.message }

  return {
    assigned: Object.keys(assignment).length,
    skipped:  Object.keys(skipped).length,
  }
}

export async function clearCourtAssignments(
  tournamentId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('matches')
    .update({ court_id: null })
    .eq('tournament_id', tournamentId)
    .eq('status', 'pending')
  return error ? { error: error.message } : {}
}
