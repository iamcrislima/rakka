'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addStageAction(leagueId: string, tournamentId: string) {
  const supabase = await createClient()

  // Determine next stage number
  const { data: existing } = await supabase
    .from('league_stages')
    .select('stage_number')
    .eq('league_id', leagueId)
    .order('stage_number', { ascending: false })
    .limit(1)

  const nextStage = (existing?.[0]?.stage_number ?? 0) + 1

  const { error } = await supabase
    .from('league_stages')
    .insert({ league_id: leagueId, tournament_id: tournamentId, stage_number: nextStage })

  if (error) return { error: error.message }

  revalidatePath(`/admin/leagues/${leagueId}`)
  return {}
}

export async function removeStageAction(leagueId: string, tournamentId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('league_stages')
    .delete()
    .eq('league_id', leagueId)
    .eq('tournament_id', tournamentId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/leagues/${leagueId}`)
  return {}
}
