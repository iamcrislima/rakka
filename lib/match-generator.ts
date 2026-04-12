/**
 * Match generation for beach tennis group stage.
 *
 * Given 4 players [A, B, C, D] in a group, the only possible
 * doubles pairings with no repeated pairs are:
 *
 *   Round 1: AB vs CD
 *   Round 2: AC vs BD
 *   Round 3: AD vs BC
 *
 * This gives every player exactly 3 matches and every pair plays
 * together exactly once.
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

/**
 * Generate all 6 group-stage match seeds for 8 players.
 * Players 1-4 → Group A, Players 5-8 → Group B.
 */
export function generateGroupMatches(players: Player[]): MatchSeed[] {
  const sorted = [...players].sort((a, b) => a.position - b.position)

  const groupA = sorted.slice(0, 4)  // positions 1-4
  const groupB = sorted.slice(4, 8)  // positions 5-8

  return [
    ...groupRounds(groupA, 'group_a'),
    ...groupRounds(groupB, 'group_b'),
  ]
}

/**
 * Produce the 3 round-robin matches for a group of 4.
 * Rotation: [AB vs CD, AC vs BD, AD vs BC]
 */
function groupRounds(
  p: Player[],
  stage: 'group_a' | 'group_b',
): MatchSeed[] {
  const [A, B, C, D] = p
  return [
    { stage, round: 1, team1_p1: A.id, team1_p2: B.id, team2_p1: C.id, team2_p2: D.id },
    { stage, round: 2, team1_p1: A.id, team1_p2: C.id, team2_p1: B.id, team2_p2: D.id },
    { stage, round: 3, team1_p1: A.id, team1_p2: D.id, team2_p1: B.id, team2_p2: C.id },
  ]
}

/**
 * Generate semifinal seeds from group rankings.
 * SF:  1A vs 2B  |  1B vs 2A
 * CSF: 3A vs 4B  |  3B vs 4A
 *
 * Player IDs from rankings must be ordered [1st, 2nd, 3rd, 4th].
 */
export interface KnockoutSeed {
  stage:    'sf' | 'csf'
  round:    1
  team1_p1: string
  team1_p2: string   // null placeholder — singles match becomes 1v1 dupla
  team2_p1: string
  team2_p2: string
}

export function generateKnockoutSeeds(
  rankA: Player[],  // [1st, 2nd, 3rd, 4th] from group A
  rankB: Player[],  // [1st, 2nd, 3rd, 4th] from group B
): KnockoutSeed[] {
  // Finals use placeholder partner (same player repeated) because
  // knockout format is 1v1 pairs picked during the match setup.
  // Swap partners are resolved by the tournament director.
  // Here we seed the opposing-group players as opponents.
  const ph = (p: Player) => p.id  // helper for readability

  return [
    // SF: 1A vs 2B — each "team" is the player seeded with a TBD partner
    {
      stage: 'sf', round: 1,
      team1_p1: ph(rankA[0]), team1_p2: ph(rankA[0]),
      team2_p1: ph(rankB[1]), team2_p2: ph(rankB[1]),
    },
    // SF: 1B vs 2A
    {
      stage: 'sf', round: 1,
      team1_p1: ph(rankB[0]), team1_p2: ph(rankB[0]),
      team2_p1: ph(rankA[1]), team2_p2: ph(rankA[1]),
    },
    // CSF: 3A vs 4B
    {
      stage: 'csf', round: 1,
      team1_p1: ph(rankA[2]), team1_p2: ph(rankA[2]),
      team2_p1: ph(rankB[3]), team2_p2: ph(rankB[3]),
    },
    // CSF: 3B vs 4A
    {
      stage: 'csf', round: 1,
      team1_p1: ph(rankB[2]), team1_p2: ph(rankB[2]),
      team2_p1: ph(rankA[3]), team2_p2: ph(rankA[3]),
    },
  ]
}
