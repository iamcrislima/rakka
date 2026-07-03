/**
 * Match generation for doubles/team tournaments.
 *
 * Group stage — 4 players [A,B,C,D] per group:
 *   Round 1: AB vs CD
 *   Round 2: AC vs BD
 *   Round 3: AD vs BC
 *   → every player plays 3 matches, every pair plays together once.
 *
 * Supports 8, 12, 16, 24, 32 players → 2, 3, 4, 6, 8 groups of 4.
 *
 * Knockout (2 groups only):
 *   Final:             (1A + 1B) vs (2A + 2B)
 *   Consolation final: (3A + 3B) vs (4A + 4B)
 */

import type { Player, Stage } from '@/types'

const GROUP_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const

export interface MatchSeed {
  stage:    Stage
  round:    number
  team1_p1: string
  team1_p2: string
  team2_p1: string
  team2_p2: string
}

export interface KnockoutSeed {
  stage:    'final' | 'consolation_final'
  round:    1
  team1_p1: string
  team1_p2: string
  team2_p1: string
  team2_p2: string
}

// ── Group stage ──────────────────────────────────────────────────────────────

/**
 * Generate round-robin group matches for all groups.
 * Players are sorted by position; every 4 consecutive players form one group.
 * Supports any multiple of 4 players (8, 12, 16, 24, 32).
 */
export function generateGroupMatches(players: Player[]): MatchSeed[] {
  const sorted    = [...players].sort((a, b) => a.position - b.position)
  const numGroups = Math.floor(sorted.length / 4)
  const seeds: MatchSeed[] = []

  for (let g = 0; g < numGroups; g++) {
    const group = sorted.slice(g * 4, (g + 1) * 4)
    const stage = `group_${GROUP_LETTERS[g]}` as Stage
    seeds.push(...groupRounds(group, stage))
  }

  return seeds
}

function groupRounds(p: Player[], stage: Stage): MatchSeed[] {
  const [A, B, C, D] = p
  return [
    { stage, round: 1, team1_p1: A.id, team1_p2: B.id, team2_p1: C.id, team2_p2: D.id },
    { stage, round: 2, team1_p1: A.id, team1_p2: C.id, team2_p1: B.id, team2_p2: D.id },
    { stage, round: 3, team1_p1: A.id, team1_p2: D.id, team2_p1: B.id, team2_p2: C.id },
  ]
}

// ── Finals (2-group tournaments) ─────────────────────────────────────────────

/**
 * Generate 2 knockout matches from 2-group rankings.
 *
 * @param rankA  [1st, 2nd, 3rd, 4th] from Group A
 * @param rankB  [1st, 2nd, 3rd, 4th] from Group B
 */
export function generateKnockoutSeeds(rankA: Player[], rankB: Player[]): KnockoutSeed[] {
  return [
    {
      // Final: (1A + 1B) vs (2A + 2B)
      stage:    'final',
      round:    1,
      team1_p1: rankA[0].id,
      team1_p2: rankB[0].id,
      team2_p1: rankA[1].id,
      team2_p2: rankB[1].id,
    },
    {
      // Consolation: (3A + 3B) vs (4A + 4B)
      stage:    'consolation_final',
      round:    1,
      team1_p1: rankA[2].id,
      team1_p2: rankB[2].id,
      team2_p1: rankA[3].id,
      team2_p2: rankB[3].id,
    },
  ]
}
