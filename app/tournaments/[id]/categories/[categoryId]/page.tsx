import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { generateGroupMatches, generateKnockoutSeeds } from '@/lib/match-generator'
import { computeRanking } from '@/lib/ranking'
import { rulesFromCategory } from '@/lib/match-rules'
import { validateSuper8Misto, generateSuper8MistoMatches } from '@/lib/super8-misto'
import type { Tournament, Category, Player, Match, Court } from '@/types'
import CategoryHub from './CategoryHub'
import Super8MistoHub from './Super8MistoHub'

async function getData(tournamentId: string, categoryId: string) {
  const supabase = await createClient()
  const [{ data: t }, { data: cat }, { data: players }, { data: matches }, { data: courts }] = await Promise.all([
    supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
    supabase.from('categories').select('*').eq('id', categoryId).single(),
    supabase.from('players').select('*').eq('category_id', categoryId).order('position'),
    supabase.from('matches').select('*').eq('category_id', categoryId),
    supabase.from('courts').select('*').eq('tournament_id', tournamentId).order('sort_order'),
  ])
  return {
    tournament: t  as Tournament | null,
    category:   cat as Category  | null,
    players:   (players  ?? []) as Player[],
    matches:   (matches  ?? []) as Match[],
    courts:    (courts   ?? []) as Court[],
  }
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ id: string; categoryId: string }>
}) {
  const { id, categoryId } = await params
  const { tournament, category, players, matches, courts } = await getData(id, categoryId)
  if (!tournament || !category) notFound()

  const rules = rulesFromCategory(category)

  if (category.format === 'super8_misto') {
    const validation = validateSuper8Misto(players)
    const matchSeeds  = validation.valid && matches.length === 0
      ? generateSuper8MistoMatches(players)
      : []

    return (
      <Super8MistoHub
        tournament={tournament}
        category={category}
        players={players}
        matches={matches}
        rules={rules}
        validation={validation}
        matchSeeds={matchSeeds}
        courts={courts}
      />
    )
  }
  const groupA         = players.filter(p => p.position <= 4)
  const groupB         = players.filter(p => p.position >= 5)
  const groupMatches   = matches.filter(m => m.stage === 'group_a' || m.stage === 'group_b')
  const allGroupDone   = groupMatches.length === 6 && groupMatches.every(m => m.status === 'done')
  const hasFinalsMatches = matches.some(m => m.stage === 'final' || m.stage === 'consolation_final')

  const finalsSeeds = (() => {
    if (!allGroupDone || hasFinalsMatches) return null
    const rankA = computeRanking(groupA, matches.filter(m => m.stage === 'group_a'))
    const rankB = computeRanking(groupB, matches.filter(m => m.stage === 'group_b'))
    if (rankA.length < 4 || rankB.length < 4) return null
    return generateKnockoutSeeds(rankA.map(s => s.player), rankB.map(s => s.player))
  })()

  const matchSeeds = players.length === 8 ? generateGroupMatches(players) : []

  return (
    <CategoryHub
      tournament={tournament}
      category={category}
      players={players}
      matches={matches}
      rules={rules}
      finalsSeeds={finalsSeeds}
      matchSeeds={matchSeeds}
      courts={courts}
    />
  )
}
