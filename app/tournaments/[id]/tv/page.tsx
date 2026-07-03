import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { computeRanking } from '@/lib/ranking'
import { rulesFromTournament } from '@/lib/match-rules'
import { computeSuper8MistoResult, getCurrentSuper8MistoRound } from '@/lib/super8-misto'
import type { Tournament, Player, Match, TVContent, Court, Category } from '@/types'
import TVDisplay, { type CourtSchedule, type RankingPanelData } from './TVDisplay'

const STAGE_ORDER: Record<string, number> = {
  final: 0, consolation_final: 1, group_a: 2, group_b: 3,
}

function sortMatches(matches: Match[]) {
  return [...matches].sort((a, b) =>
    (STAGE_ORDER[a.stage] ?? 9) - (STAGE_ORDER[b.stage] ?? 9) || a.round - b.round
  )
}

export default async function TVPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: t }, { data: players }, { data: matches }, { data: content }, { data: courts }, { data: cats }] = await Promise.all([
    supabase.from('tournaments').select('*').eq('id', id).single(),
    supabase.from('players').select('*').eq('tournament_id', id).order('position'),
    supabase.from('matches').select('*').eq('tournament_id', id),
    supabase.from('tv_content').select('*').eq('tournament_id', id).order('sort_order'),
    supabase.from('courts').select('*').eq('tournament_id', id).order('sort_order'),
    supabase.from('categories').select('*').eq('tournament_id', id),
  ])

  if (!t) notFound()

  const tournament     = t as Tournament
  const allPlayers     = (players ?? []) as Player[]
  const allMatches     = (matches ?? []) as Match[]
  const allCourts      = (courts  ?? []) as Court[]
  const allCategories  = (cats    ?? []) as Category[]
  const hasCategories  = allCategories.length > 0

  // ── Which categories are on the broadcast right now ────────────
  // Prefer categories that are actually running (multiple can run at
  // once — that's the whole point). If none are currently running
  // (everything still draft, or everything already finished), fall
  // back to all categories so results/rankings still have something
  // to show instead of a blank screen.
  const runningCategories   = allCategories.filter(c => c.status === 'group_stage' || c.status === 'finals')
  const broadcastCategories = runningCategories.length > 0 ? runningCategories : allCategories
  const broadcastCategoryIds = new Set(broadcastCategories.map(c => c.id))

  const scopedMatches = hasCategories
    ? allMatches.filter(m => m.category_id && broadcastCategoryIds.has(m.category_id))
    : allMatches
  const scopedPlayers = hasCategories
    ? allPlayers.filter(p => p.category_id && broadcastCategoryIds.has(p.category_id))
    : allPlayers

  const defaultRules = rulesFromTournament(tournament)

  // ── One ranking panel per broadcast category ───────────────────
  const rankingPanels: RankingPanelData[] = broadcastCategories.map(cat => {
    const catMatches = allMatches.filter(m => m.category_id === cat.id)
    const catPlayers = allPlayers.filter(p => p.category_id === cat.id)
    if (cat.format === 'super8_misto') {
      const { kingRanking, queenRanking } = computeSuper8MistoResult(catPlayers, catMatches)
      return {
        categoryId: cat.id, categoryName: cat.name, kind: 'gender',
        kingRanking, queenRanking,
        showRanking: getCurrentSuper8MistoRound(catMatches) <= 4,
      }
    }
    const groupA = catPlayers.filter(p => p.position <= 4)
    const groupB = catPlayers.filter(p => p.position >= 5)
    return {
      categoryId: cat.id, categoryName: cat.name, kind: 'groups',
      rankingA: computeRanking(groupA, catMatches.filter(m => m.stage === 'group_a')),
      rankingB: computeRanking(groupB, catMatches.filter(m => m.stage === 'group_b')),
      showRanking: true,
    }
  })

  // Legacy tournaments with no categories at all — single implicit group panel
  if (!hasCategories) {
    const groupA = allPlayers.filter(p => p.position <= 4)
    const groupB = allPlayers.filter(p => p.position >= 5)
    rankingPanels.push({
      categoryId: '', categoryName: tournament.name, kind: 'groups',
      rankingA: computeRanking(groupA, allMatches.filter(m => m.stage === 'group_a')),
      rankingB: computeRanking(groupB, allMatches.filter(m => m.stage === 'group_b')),
      showRanking: true,
    })
  }

  // ── Active match check (respects category scheduling) ────────
  const now = new Date()
  const catScheduleMap = Object.fromEntries(
    allCategories.map(c => [c.id, c.scheduled_at ? new Date(c.scheduled_at) : null])
  )

  function isActive(m: Match): boolean {
    if (m.override_active) return true
    if (!m.category_id)    return true          // legacy tournament — always active
    const start = catScheduleMap[m.category_id]
    return !start || now >= start
  }

  const sorted  = sortMatches(scopedMatches)
  const pending = sorted.filter(m => m.status === 'pending')
  const done    = sorted.filter(m => m.status === 'done').reverse()

  // Only active matches fill the "current" / "next" hero slots
  const activePending = pending.filter(isActive)
  const currentMatch  = activePending[0] ?? null
  const nextMatches   = activePending.slice(1, 4)
  const recentResults = done.slice(0, 3)

  // ── Build per-court schedule — pooled across every broadcast category ──
  const courtSchedules: CourtSchedule[] = allCourts
    .map(court => {
      const cp = pending
        .filter(m => m.court_id === court.id)
        .sort((a, b) => {
          const pa = a.queue_position ?? Infinity
          const pb = b.queue_position ?? Infinity
          if (pa !== pb) return pa - pb
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        })
      return { court, current: cp[0] ?? null, next: cp[1] ?? null }
    })
    .filter(cs => cs.current !== null)

  return (
    <TVDisplay
      tournament={tournament}
      players={hasCategories ? scopedPlayers : allPlayers}
      currentMatch={currentMatch}
      nextMatches={nextMatches}
      recentResults={recentResults}
      rankingPanels={rankingPanels}
      defaultRules={defaultRules}
      contentItems={(content ?? []) as TVContent[]}
      courts={allCourts}
      courtSchedules={courtSchedules}
      categories={allCategories}
      hasSuper8MistoCategory={allCategories.some(c => c.format === 'super8_misto')}
    />
  )
}
