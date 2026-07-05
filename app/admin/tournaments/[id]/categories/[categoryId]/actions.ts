'use server'

import { createClient } from '@/lib/supabase/server'
import { repairSuper8MistoOpponents } from '@/lib/super8-misto'
import type { Player, Match } from '@/types'

export interface RepairResult {
  ok:      boolean
  error?:  string
  updated?: number
}

/**
 * One-time fix for categories generated before the Super Oito Misto
 * opponent-rotation bug (every man always faced the same opposing man,
 * round after round — only partners rotated). Safe to click more than
 * once: rounds that are already done or in progress are always skipped,
 * so re-running it after some rounds have finished only ever touches
 * whatever rounds are still fully untouched.
 */
export async function repairSuper8MistoCategory(categoryId: string): Promise<RepairResult> {
  const supabase = await createClient()

  const [{ data: players, error: pErr }, { data: matches, error: mErr }] = await Promise.all([
    supabase.from('players').select('*').eq('category_id', categoryId),
    supabase.from('matches').select('*').eq('category_id', categoryId),
  ])

  if (pErr) return { ok: false, error: pErr.message }
  if (mErr) return { ok: false, error: mErr.message }

  const updates = repairSuper8MistoOpponents((players ?? []) as Player[], (matches ?? []) as Match[])

  if (updates.length === 0) return { ok: true, updated: 0 }

  const results = await Promise.all(
    updates.map(u =>
      supabase
        .from('matches')
        .update({ team1_p1: u.team1_p1, team1_p2: u.team1_p2, team2_p1: u.team2_p1, team2_p2: u.team2_p2 })
        .eq('id', u.matchId)
    )
  )

  const dbError = results.find(r => r.error)?.error
  if (dbError) return { ok: false, error: dbError.message }

  return { ok: true, updated: updates.length }
}
