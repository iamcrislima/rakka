/**
 * Match generation for beach tennis.
 *
 * Group stage — 4 players [A,B,C,D]:
 *   Round 1: AB vs CD
 *   Round 2: AC vs BD
 *   Round 3: AD vs BC
 *   → every player plays 3 matches, every pair plays together once.
 *
 * Finals — cross-group doubles:
 *   Final:             (1A + 1B)  vs  (2A + 2B)
 *   Consolation final: (3A + 3B)  vs  (4A + 4B)
 */

import type { Player } from '@/types'

export interface MatchSeed {
  stage:    'group_a' | 'group_b'
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

export function generateGroupMatches(players: Player[]): MatchSeed[] {
  const sorted = [...players].sort((a, b) => a.position - b.position)
  return [
    ...groupRounds(sorted.slice(0, 4), 'group_a'),
    ...groupRounds(sorted.slice(4, 8), 'group_b'),
  ]
}

function groupRounds(p: Player[], stage: 'group_a' | 'group_b'): MatchSeed[] {
  const [A, B, C, D] = p
  return [
    { stage, round: 1, team1_p1: A.id, team1_p2: B.id, team2_p1: C.id, team2_p2: D.id },
    { stage, round: 2, team1_p1: A.id, team1_p2: C.id, team2_p1: B.id, team2_p2: D.id },
    { stage, round: 3, team1_p1: A.id, team1_p2: D.id, team2_p1: B.id, team2_p2: C.id },
  ]
}

// ── Finals ───────────────────────────────────────────────────────────────────

/**
 * Generate 2 knockout matches from group rankings.
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
