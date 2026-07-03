import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { computeRanking } from '@/lib/ranking'
import { rulesFromTournament } from '@/lib/match-rules'
import {
  computeSuper8MistoResult, getCurrentSuper8MistoRound, isSuper8MistoComplete, SUPER8_MISTO_ROUNDS,
} from '@/lib/super8-misto'
import type { Tournament, Player, Match, TVContent, Court, Category } from '@/types'
import TVDisplay, {
  type CourtSchedule, type RankingPanelData, type CategoryProgress,
  type HighlightData, type CollectiveStats, type AgendaCategory, type MuralPhoto,
  type DashboardStats, type CategoryJogosBlock,
} from './TVDisplay'

const STAGE_ORDER: Record<string, number> = {
  final: 0, consolation_final: 1, group_a: 2, group_b: 3,
}

function sortMatches(matches: Match[]) {
  return [...matches].sort((a, b) =>
    (STAGE_ORDER[a.stage] ?? 9) - (STAGE_ORDER[b.stage] ?? 9) || a.round - b.round
  )
}

/** Are these two specific players on opposing teams in this match? */
function onOpposingTeams(m: Match, a: string, b: string): boolean {
  const team1 = [m.team1_p1, m.team1_p2]
  const team2 = [m.team2_p1, m.team2_p2]
  return (team1.includes(a) && team2.includes(b)) || (team1.includes(b) && team2.includes(a))
}

/** "RODADA X CONCLUÍDA! BORA PRA MAIS UMA" — only fires right after a round
 *  fully wraps up and there's a next round waiting (never on the very last
 *  round, since there's nothing left to "bora pra mais uma" into). */
function computeRoundTransitionMessage(catMatches: Match[]): string | null {
  const rounds = [...new Set(catMatches.map(m => m.round))].sort((a, b) => a - b)
  let lastCompleted: number | null = null
  for (const r of rounds) {
    const roundMatches = catMatches.filter(m => m.round === r)
    if (roundMatches.length > 0 && roundMatches.every(m => m.status === 'done')) lastCompleted = r
    else break
  }
  if (lastCompleted == null) return null
  if (!rounds.some(r => r > lastCompleted!)) return null
  return `RODADA ${lastCompleted} CONCLUÍDA! BORA PRA MAIS UMA`
}

/** Celebrates players on a live win streak (3+) — never mentions who's
 *  struggling, only positive callouts. Individual, so it holds up even
 *  when partners rotate every round (Super Oito Misto). */
function computeWinStreakMessages(players: Player[], matches: Match[]): string[] {
  const doneSorted = matches
    .filter(m => m.status === 'done' && m.score1 != null && m.score2 != null)
    .sort((a, b) => a.round - b.round || new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const streaks: { name: string; streak: number }[] = []
  for (const p of players) {
    const playerMatches = doneSorted.filter(m =>
      m.team1_p1 === p.id || m.team1_p2 === p.id || m.team2_p1 === p.id || m.team2_p2 === p.id
    )
    let streak = 0
    for (let i = playerMatches.length - 1; i >= 0; i--) {
      const m = playerMatches[i]
      const onTeam1 = m.team1_p1 === p.id || m.team1_p2 === p.id
      const won = onTeam1 ? (m.score1 ?? 0) > (m.score2 ?? 0) : (m.score2 ?? 0) > (m.score1 ?? 0)
      if (won) streak++
      else break
    }
    if (streak >= 3) streaks.push({ name: p.name, streak })
  }
  streaks.sort((a, b) => b.streak - a.streak)
  return streaks.slice(0, 2).map(s => `${s.name.toUpperCase()} EMPLACOU ${s.streak} VITÓRIAS SEGUIDAS!`)
}

/** Same underlying streak computation as the hype messages, but returns
 *  bare numbers (never a name) for the Painel Geral stat cards — the
 *  "maior sequência" and "mais games sem perder" cards must not leak who's
 *  in the lead. `maxGamesInStreak` sums the games won during whichever
 *  player's unbeaten run racked up the most (not necessarily the same
 *  player as `maxStreak`). */
function computeStreakStats(players: Player[], matches: Match[]): { maxStreak: number; maxGamesInStreak: number } {
  const doneSorted = matches
    .filter(m => m.status === 'done' && m.score1 != null && m.score2 != null)
    .sort((a, b) => a.round - b.round || new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  let maxStreak = 0
  let maxGamesInStreak = 0

  for (const p of players) {
    const playerMatches = doneSorted.filter(m =>
      m.team1_p1 === p.id || m.team1_p2 === p.id || m.team2_p1 === p.id || m.team2_p2 === p.id
    )
    let streak = 0
    let gamesInStreak = 0
    for (let i = playerMatches.length - 1; i >= 0; i--) {
      const m = playerMatches[i]
      const onTeam1 = m.team1_p1 === p.id || m.team1_p2 === p.id
      const won = onTeam1 ? (m.score1 ?? 0) > (m.score2 ?? 0) : (m.score2 ?? 0) > (m.score1 ?? 0)
      if (!won) break
      streak++
      gamesInStreak += onTeam1 ? (m.score1 ?? 0) : (m.score2 ?? 0)
    }
    maxStreak        = Math.max(maxStreak, streak)
    maxGamesInStreak = Math.max(maxGamesInStreak, gamesInStreak)
  }

  return { maxStreak, maxGamesInStreak }
}

/** "Duplas formadas até agora" — Super Oito Misto only (every other format
 *  has fixed partners for the whole tournament, so the count is trivial
 *  and not interesting). Counts unique pairs among matches already played. */
function computePairsFormed(catMatches: Match[]): number {
  const pairKey = (a: string, b: string) => [a, b].sort().join('-')
  const pairs = new Set<string>()
  for (const m of catMatches) {
    if (m.status !== 'done') continue
    pairs.add(pairKey(m.team1_p1, m.team1_p2))
    pairs.add(pairKey(m.team2_p1, m.team2_p2))
  }
  return pairs.size
}

export default async function TVPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: t }, { data: players }, { data: matches }, { data: content }, { data: courts }, { data: cats }, { data: mural }] = await Promise.all([
    supabase.from('tournaments').select('*').eq('id', id).single(),
    supabase.from('players').select('*').eq('tournament_id', id).order('position'),
    supabase.from('matches').select('*').eq('tournament_id', id),
    supabase.from('tv_content').select('*').eq('tournament_id', id).order('sort_order'),
    supabase.from('courts').select('*').eq('tournament_id', id).order('sort_order'),
    supabase.from('categories').select('*').eq('tournament_id', id),
    supabase.from('mural_photos').select('id, storage_path').eq('tournament_id', id).eq('status', 'approved').order('created_at', { ascending: true }).limit(60),
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
  // `queue` is depth 2-4 for that specific court — court-assignment.ts pins
  // every pending match to a court up front, so this is real backlog for
  // THAT court, not a generic category-wide list (which hid the fact that
  // one court can carry a much longer backlog than another).
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
      return { court, current: cp[0] ?? null, next: cp[1] ?? null, queue: cp.slice(2, 4) }
    })
    .filter(cs => cs.current !== null)

  // ── Progresso screen — per broadcast category ──────────────────
  const progressData: CategoryProgress[] = broadcastCategories.map(cat => {
    const catMatches = allMatches.filter(m => m.category_id === cat.id)
    return {
      categoryId:   cat.id,
      categoryName: cat.name,
      totalMatches: catMatches.length,
      doneMatches:  catMatches.filter(m => m.status === 'done').length,
    }
  })

  // ── Destaques screen — collective counter (never per-person) ───
  const broadcastMatches = allMatches.filter(m => m.category_id ? broadcastCategoryIds.has(m.category_id) : true)
  const doneBroadcastMatches = broadcastMatches.filter(m => m.status === 'done')
  const totalGames = doneBroadcastMatches.reduce((sum, m) => sum + (m.score1 ?? 0) + (m.score2 ?? 0), 0)
  const durations = doneBroadcastMatches.map(m => m.duration_seconds).filter((d): d is number => d != null)
  const collectiveStats: CollectiveStats = {
    totalGames,
    totalDurationSeconds: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) : null,
  }

  // ── Destaques screen — "confronto imperdível" (never reveals rank) ──
  let highlight: HighlightData | null = null
  for (const panel of rankingPanels) {
    if (!panel.showRanking) continue // keep Super8Misto suspense intact past round 4
    const topA = panel.kind === 'gender' ? panel.kingRanking?.[0]?.player.id  : panel.rankingA?.[0]?.player.id
    const topB = panel.kind === 'gender' ? panel.queenRanking?.[0]?.player.id : panel.rankingB?.[0]?.player.id
    if (!topA || !topB) continue
    const catMatches    = allMatches.filter(m => m.category_id === panel.categoryId)
    const pendingActive = catMatches.filter(m => m.status === 'pending' && isActive(m))
    const clash = pendingActive.find(m => onOpposingTeams(m, topA, topB))
    if (clash) {
      highlight = {
        kind:         'topClash',
        categoryName: panel.categoryName,
        courtName:    clash.court_id ? (allCourts.find(c => c.id === clash.court_id)?.name ?? null) : null,
      }
      break
    }
  }
  if (!highlight && currentMatch) {
    const playerMap = Object.fromEntries(allPlayers.map(p => [p.id, p.name]))
    const catName = currentMatch.category_id
      ? (allCategories.find(c => c.id === currentMatch.category_id)?.name ?? '')
      : tournament.name
    highlight = {
      kind:         'nextMatch',
      categoryName: catName,
      courtName:    currentMatch.court_id ? (allCourts.find(c => c.id === currentMatch.court_id)?.name ?? null) : null,
      team1:        `${playerMap[currentMatch.team1_p1] ?? '?'} + ${playerMap[currentMatch.team1_p2] ?? '?'}`,
      team2:        `${playerMap[currentMatch.team2_p1] ?? '?'} + ${playerMap[currentMatch.team2_p2] ?? '?'}`,
    }
  }

  // ── Hype — a pool of celebratory phrases, rotated inside the Painel
  // Geral ticker (never a standalone full screen anymore) ─────────
  function buildHypeMessages(): string[] {
    const messages: string[] = []
    const s8 = broadcastCategories.find(c => c.format === 'super8_misto')

    if (s8) {
      const catMatches = allMatches.filter(m => m.category_id === s8.id)
      if (isSuper8MistoComplete(catMatches)) {
        messages.push(`PARABÉNS A TODOS! ${s8.name.toUpperCase()} CHEGOU AO FIM 🏆`)
      } else {
        const round = getCurrentSuper8MistoRound(catMatches)
        if (round <= 2) messages.push(`COMEÇOU! RODADA ${round} DE ${SUPER8_MISTO_ROUNDS}`)
        else if (round <= 4) messages.push(`RODADA ${round} DE ${SUPER8_MISTO_ROUNDS} · METADE DO CAMINHO!`)
        else if (round < SUPER8_MISTO_ROUNDS) {
          messages.push(`FALTAM ${SUPER8_MISTO_ROUNDS - round + 1} JOGOS PRA CONHECERMOS O REI E A RAINHA DA QUADRA!`)
        } else {
          messages.push('ÚLTIMA RODADA! O REI E A RAINHA DA QUADRA ESTÃO PRA SER REVELADOS!')
        }
        const transition = computeRoundTransitionMessage(catMatches)
        if (transition) messages.push(transition)
      }
      const catPlayers = allPlayers.filter(p => p.category_id === s8.id)
      messages.push(...computeWinStreakMessages(catPlayers, catMatches))
    } else {
      const totalAll = progressData.reduce((s, p) => s + p.totalMatches, 0)
      const doneAll  = progressData.reduce((s, p) => s + p.doneMatches, 0)
      if (totalAll === 0) {
        messages.push('BEM-VINDOS AO TORNEIO!')
      } else {
        const pct = Math.round((doneAll / totalAll) * 100)
        messages.push(pct >= 100
          ? 'TORNEIO CONCLUÍDO! PARABÉNS A TODOS OS ATLETAS 🏆'
          : `${pct}% DO TORNEIO JÁ FOI DISPUTADO!`)
      }
      for (const cat of broadcastCategories) {
        const catMatches = allMatches.filter(m => m.category_id === cat.id)
        const transition = computeRoundTransitionMessage(catMatches)
        if (transition) messages.push(transition)
        const catPlayers = allPlayers.filter(p => p.category_id === cat.id)
        messages.push(...computeWinStreakMessages(catPlayers, catMatches))
      }
    }

    return messages.length > 0 ? messages : ['BEM-VINDOS AO TORNEIO!']
  }

  // ── Agenda screen — every category, only shown when there's >1 ─
  const agendaCategories: AgendaCategory[] = allCategories.map(c => ({
    id:          c.id,
    name:        c.name,
    status:      c.status,
    scheduledAt: c.scheduled_at,
  }))

  // ── Mural screen — approved photos only ─────────────────────────
  const muralPhotos: MuralPhoto[] = (mural ?? []).map(row => ({
    id:  row.id as string,
    url: supabase.storage.from('mural-photos').getPublicUrl(row.storage_path as string).data.publicUrl,
  }))

  // ── Painel Geral — bottom stat cards (collective / anonymous only) ──
  const s8Broadcast = broadcastCategories.find(c => c.format === 'super8_misto')
  let maxWinStreak = 0
  let maxGamesUnbeaten = 0
  for (const cat of broadcastCategories) {
    const catMatches = allMatches.filter(m => m.category_id === cat.id)
    const catPlayers = allPlayers.filter(p => p.category_id === cat.id)
    const s = computeStreakStats(catPlayers, catMatches)
    maxWinStreak     = Math.max(maxWinStreak, s.maxStreak)
    maxGamesUnbeaten = Math.max(maxGamesUnbeaten, s.maxGamesInStreak)
  }
  const dashboardStats: DashboardStats = {
    totalGames:       totalGames,
    pairsFormed:      s8Broadcast ? computePairsFormed(allMatches.filter(m => m.category_id === s8Broadcast.id)) : null,
    maxWinStreak,
    maxGamesUnbeaten,
  }

  // ── Jogos — one block per broadcast category: just its own live courts.
  // Each court's own backlog (depth 2-4) rides along inside its CourtSchedule
  // ("queue" above) and renders directly under that court's card — a
  // category-wide list hid the fact that one court can carry a much longer
  // backlog than another (confirmed: 26 of 28 pending C/D matches were
  // pinned to a single court). ──
  const jogosBlocks: CategoryJogosBlock[] = broadcastCategories.map(cat => ({
    categoryId:   cat.id,
    categoryName: cat.name,
    liveCourts:   courtSchedules.filter(s => s.current?.category_id === cat.id),
  }))

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
      progressData={progressData}
      collectiveStats={collectiveStats}
      highlight={highlight}
      hypeMessages={buildHypeMessages()}
      agendaCategories={agendaCategories}
      muralPhotos={muralPhotos}
      dashboardStats={dashboardStats}
      jogosBlocks={jogosBlocks}
    />
  )
}
