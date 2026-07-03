import type { Player, Match, ScoringRules, TournamentFinish, LeaguePlayerStats } from '@/types'
import { computeRanking } from './ranking'

// ── Name normalization ────────────────────────────────────────

export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
}

// ── Scoring presets ───────────────────────────────────────────

export const SCORING_PRESETS = {
  padrao: {
    label:       'Padrão',
    description: '10 · 7 · 5 · 3 pts (top 4)',
    rules:       { '1': 10, '2': 7, '3': 5, '4': 3, '5': 2, '7': 1 } satisfies ScoringRules,
  },
  progressivo: {
    label:       'Progressivo',
    description: '15 · 10 · 6 · 3 pts (top 4)',
    rules:       { '1': 15, '2': 10, '3': 6, '4': 3, '5': 2, '7': 1 } satisfies ScoringRules,
  },
  vencedor: {
    label:       'Winner Takes All',
    description: 'Só o 1º lugar pontua',
    rules:       { '1': 10, '2': 0, '3': 0, '4': 0, '5': 0, '7': 0 } satisfies ScoringRules,
  },
} as const

export type ScoringPresetKey = keyof typeof SCORING_PRESETS

export const DEFAULT_SCORING = SCORING_PRESETS.padrao.rules

// ── Points lookup ─────────────────────────────────────────────

/** Points for a given finishing position under the given rules. */
export function pointsForPosition(position: number, rules: ScoringRules): number {
  // Positions 5+6 both use key "5"; positions 7+8 use key "7"
  const key = position >= 7 ? '7' : position >= 5 ? '5' : String(position)
  return rules[key] ?? 0
}

/** Display label for a position: 1º, 2º … */
export function positionLabel(position: number): string {
  return `${position}º`
}

// ── Tournament result computation ────────────────────────────

export interface StageData {
  tournamentId:   string
  tournamentName: string
  stageNumber:    number
  players:        Player[]
  matches:        Match[]
}

/**
 * Compute each player's finishing position and points for one tournament.
 * Returns empty array if the tournament is not yet complete (no finals played).
 */
export function resolveTournamentFinishes(
  data:    StageData,
  scoring: ScoringRules,
): TournamentFinish[] {
  const { tournamentId, tournamentName, stageNumber, players, matches } = data

  const finalMatch       = matches.find(m => m.stage === 'final'            && m.status === 'done')
  const consolationMatch = matches.find(m => m.stage === 'consolation_final' && m.status === 'done')

  // Need both finals to produce full results
  if (!finalMatch || !consolationMatch) return []

  const finishedIds = new Set<string>()
  const results: Omit<TournamentFinish, 'points'>[] = []

  function addPair(pids: [string, string], position: number) {
    pids.forEach(pid => {
      const p = players.find(pl => pl.id === pid)
      if (!p) return
      results.push({
        playerId: pid,
        playerName:     p.name,
        normalizedName: normalizeName(p.name),
        position,
        tournamentId,
        tournamentName,
        stageNumber,
      })
      finishedIds.add(pid)
    })
  }

  // 1st + 2nd from final
  const f1Won = (finalMatch.score1 ?? 0) > (finalMatch.score2 ?? 0)
  addPair(
    f1Won ? [finalMatch.team1_p1, finalMatch.team1_p2] : [finalMatch.team2_p1, finalMatch.team2_p2],
    1,
  )
  addPair(
    f1Won ? [finalMatch.team2_p1, finalMatch.team2_p2] : [finalMatch.team1_p1, finalMatch.team1_p2],
    2,
  )

  // 3rd + 4th from consolation
  const c1Won = (consolationMatch.score1 ?? 0) > (consolationMatch.score2 ?? 0)
  addPair(
    c1Won ? [consolationMatch.team1_p1, consolationMatch.team1_p2] : [consolationMatch.team2_p1, consolationMatch.team2_p2],
    3,
  )
  addPair(
    c1Won ? [consolationMatch.team2_p1, consolationMatch.team2_p2] : [consolationMatch.team1_p1, consolationMatch.team1_p2],
    4,
  )

  // 5th–8th: group-stage-only players (didn't reach finals), ranked by group standing
  const groupA   = players.filter(p => p.position <= 4 && !finishedIds.has(p.id))
  const groupB   = players.filter(p => p.position >= 5 && !finishedIds.has(p.id))
  const rankA    = computeRanking(groupA, matches.filter(m => m.stage === 'group_a'))
  const rankB    = computeRanking(groupB, matches.filter(m => m.stage === 'group_b'))

  // Interleave A/B: 5th(A3), 5th(B3), 7th(A4), 7th(B4)
  const non: { pid: string; name: string; groupRank: number }[] = []
  for (let i = 0; i < rankA.length; i++) {
    if (!finishedIds.has(rankA[i].player.id))
      non.push({ pid: rankA[i].player.id, name: rankA[i].player.name, groupRank: i })
  }
  for (let i = 0; i < rankB.length; i++) {
    if (!finishedIds.has(rankB[i].player.id))
      non.push({ pid: rankB[i].player.id, name: rankB[i].player.name, groupRank: i })
  }

  // Position 5 for groupRank 0 (3rd in group), position 7 for groupRank 1 (4th in group)
  non.forEach(({ pid, name, groupRank }) => {
    const position = groupRank === 0 ? 5 : 7
    const p = players.find(pl => pl.id === pid)
    if (!p) return
    results.push({
      playerId: pid,
      playerName:     name,
      normalizedName: normalizeName(name),
      position,
      tournamentId,
      tournamentName,
      stageNumber,
    })
  })

  return results.map(r => ({
    ...r,
    points: pointsForPosition(r.position, scoring),
  }))
}

// ── League-wide ranking ───────────────────────────────────────

export function computeLeagueRanking(
  stages:  StageData[],
  scoring: ScoringRules,
): LeaguePlayerStats[] {
  const map = new Map<string, {
    displayName: string
    totalPoints: number
    finishes:    TournamentFinish[]
  }>()

  for (const stage of stages) {
    const finishes = resolveTournamentFinishes(stage, scoring)
    for (const f of finishes) {
      const key = f.normalizedName
      const existing = map.get(key)
      if (existing) {
        existing.totalPoints += f.points
        existing.finishes.push(f)
        // Latest stage name wins for display
        existing.displayName = f.playerName
      } else {
        map.set(key, {
          displayName: f.playerName,
          totalPoints: f.points,
          finishes:    [f],
        })
      }
    }
  }

  const stats: LeaguePlayerStats[] = [...map.entries()].map(([normalizedName, v]) => ({
    normalizedName,
    displayName:  v.displayName,
    totalPoints:  v.totalPoints,
    finishes:     v.finishes.sort((a, b) => a.stageNumber - b.stageNumber),
    rank:         0,
  }))

  stats.sort((a, b) => b.totalPoints - a.totalPoints || a.displayName.localeCompare(b.displayName))

  // Dense rank
  let rank = 1
  stats.forEach((s, i) => {
    if (i > 0 && s.totalPoints < stats[i - 1].totalPoints) rank = i + 1
    s.rank = rank
  })

  return stats
}
