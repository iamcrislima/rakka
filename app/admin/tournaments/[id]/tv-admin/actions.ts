'use server'

import { createClient } from '@/lib/supabase/server'
import { assignCourts, type AssignOptions } from '@/lib/court-assignment'
import type { Court, Match, Category } from '@/types'

export async function autoAssignCourts(
  tournamentId: string,
  options: AssignOptions & {
    /** When true, every NOT-YET-STARTED match is treated as unassigned
     *  before running assignCourts — even if it already had a court_id from
     *  an earlier distribution — so a newly added court actually gets a
     *  share of the backlog instead of assignCourts pinning everyone to
     *  their existing court and leaving the new one empty. Matches that are
     *  already started keep their court_id untouched either way (still
     *  pinned), so nothing live ever gets reshuffled. Left off (default) for
     *  the manual "Distribuir agora" button, which should only fill gaps,
     *  not undo an organizer's manual reassignment. */
    rebalanceQueued?: boolean
  },
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
  const allCats    = (cats    ?? []) as Pick<Category, 'id' | 'scheduled_at'>[]
  const allMatches = ((matches ?? []) as Match[]).map(m =>
    options.rebalanceQueued && !m.started_at ? { ...m, court_id: null, queue_position: null } : m
  )

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
