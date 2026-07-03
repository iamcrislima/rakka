import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { computeLeagueRanking, type StageData } from '@/lib/league-scoring'
import type { League, LeagueStage, Tournament, Player, Match } from '@/types'
import LeagueHub from './LeagueHub'

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // 1. Fetch league + stages (with tournament metadata inline)
  const [{ data: leagueRow }, { data: stagesRow }] = await Promise.all([
    supabase.from('leagues').select('*').eq('id', id).single(),
    supabase
      .from('league_stages')
      .select('*, tournaments(*)')
      .eq('league_id', id)
      .order('stage_number'),
  ])

  if (!leagueRow) notFound()

  const league = leagueRow as League
  const rawStages = (stagesRow ?? []) as (LeagueStage & { tournaments: Tournament })[]

  // 2. Fan-out: fetch players + matches for every stage tournament
  const stageDetails = await Promise.all(
    rawStages.map(async s => {
      const [{ data: players }, { data: matches }] = await Promise.all([
        supabase.from('players').select('*').eq('tournament_id', s.tournament_id).order('position'),
        supabase.from('matches').select('*').eq('tournament_id', s.tournament_id),
      ])
      return {
        stage:      s,
        tournament: s.tournaments,
        players:    (players ?? []) as Player[],
        matches:    (matches ?? []) as Match[],
      }
    })
  )

  // 3. Build StageData[] for scoring lib
  const stageDataList: StageData[] = stageDetails.map(d => ({
    tournamentId:   d.tournament.id,
    tournamentName: d.tournament.name,
    stageNumber:    d.stage.stage_number,
    players:        d.players,
    matches:        d.matches,
  }))

  // 4. Compute league ranking server-side
  const leagueRanking = computeLeagueRanking(stageDataList, league.scoring)

  // 5. Available tournaments (not yet in this league)
  const assignedIds = new Set(rawStages.map(s => s.tournament_id))
  const { data: allTournaments } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false })
  const availableTournaments = ((allTournaments ?? []) as Tournament[]).filter(
    t => !assignedIds.has(t.id)
  )

  return (
    <LeagueHub
      league={league}
      stages={stageDetails}
      leagueRanking={leagueRanking}
      availableTournaments={availableTournaments}
    />
  )
}
