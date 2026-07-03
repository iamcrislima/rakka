/**
 * Super Oito Misto — mixed-doubles rotating-partner format.
 *
 * 8 men + 8 women, 16 players total. Partners are NOT fixed: every round
 * each man is paired with a different woman, so that by the end every man
 * has partnered every woman exactly once. There is no bracket and no
 * champion pair — players are ranked individually, and the top man / top
 * woman are crowned "Rei da Quadra" / "Rainha da Quadra".
 *
 * Round generation (rounds 0-7, men/women indexed 0-7 by position):
 *   Round r: man i partners woman (i + r) mod 8
 *   → each man covers all 8 women across the 8 rounds (1-factorization of K8,8).
 *
 * Match-up within a round (4 matches from the 8 mixed couples):
 *   couple i  vs  couple (i + 4) mod 8,  for i = 0,1,2,3
 *
 * Matches reuse the existing Match/MatchSeed shape unchanged — all 32
 * seeds use stage 'group_a' with round 1-8 (4 matches share each round).
 */

import type { Player, PlayerStats, Match } from '@/types'
import type { MatchSeed } from './match-generator'
import { computeRanking } from './ranking'

export const SUPER8_MISTO_STAGE   = 'group_a' as const
export const SUPER8_MISTO_ROUNDS  = 8
export const SUPER8_MISTO_MATCHES = 32
export const SUPER8_MISTO_TEAM_SIZE = 8   // men (or women) required

// ── Validation ───────────────────────────────────────────────────────────

export interface Super8MistoValidation {
  valid: boolean
  men:   number
  women: number
  error?: string
}

/**
 * Exactly 8 men + 8 women are required to run the rotation — anything
 * else breaks the "every man partners every woman once" guarantee.
 */
export function validateSuper8Misto(players: Player[]): Super8MistoValidation {
  const men   = players.filter(p => p.gender === 'M').length
  const women = players.filter(p => p.gender === 'F').length

  if (men === SUPER8_MISTO_TEAM_SIZE && women === SUPER8_MISTO_TEAM_SIZE) {
    return { valid: true, men, women }
  }

  return {
    valid: false,
    men,
    women,
    error: `Super Oito Misto exige exatamente 8 homens e 8 mulheres (hoje: ${men} ${men === 1 ? 'homem' : 'homens'}, ${women} ${women === 1 ? 'mulher' : 'mulheres'}).`,
  }
}

// ── Round generation ─────────────────────────────────────────────────────

/**
 * Generate all 32 match seeds (8 rounds × 4 matches) for a validated
 * 8-men/8-women category. Throws if the 8+8 requirement isn't met —
 * callers should check `validateSuper8Misto` first.
 */
export function generateSuper8MistoMatches(players: Player[]): MatchSeed[] {
  const validation = validateSuper8Misto(players)
  if (!validation.valid) throw new Error(validation.error)

  const men   = players.filter(p => p.gender === 'M').sort((a, b) => a.position - b.position)
  const women = players.filter(p => p.gender === 'F').sort((a, b) => a.position - b.position)

  const seeds: MatchSeed[] = []

  for (let r = 0; r < SUPER8_MISTO_ROUNDS; r++) {
    // couples[i] = man i + woman (i + r) mod 8
    const couples = men.map((man, i) => ({
      man,
      woman: women[(i + r) % SUPER8_MISTO_TEAM_SIZE],
    }))

    for (let i = 0; i < 4; i++) {
      const c1 = couples[i]
      const c2 = couples[i + 4]
      seeds.push({
        stage:    SUPER8_MISTO_STAGE,
        round:    r + 1,
        team1_p1: c1.man.id,
        team1_p2: c1.woman.id,
        team2_p1: c2.man.id,
        team2_p2: c2.woman.id,
      })
    }
  }

  return seeds
}

// ── Result — Rei / Rainha da Quadra ───────────────────────────────────────

export interface Super8MistoResult {
  kingRanking:  PlayerStats[]   // men,   sorted — [0] = Rei da Quadra
  queenRanking: PlayerStats[]   // women, sorted — [0] = Rainha da Quadra
}

/**
 * Individual ranking split by gender. Reuses computeRanking's per-player
 * stats engine (wins → game diff → games won) — there is no pair/bracket
 * result to resolve for this format.
 */
export function computeSuper8MistoResult(players: Player[], matches: Match[]): Super8MistoResult {
  const men   = players.filter(p => p.gender === 'M')
  const women = players.filter(p => p.gender === 'F')

  return {
    kingRanking:  computeRanking(men,   matches),
    queenRanking: computeRanking(women, matches),
  }
}

// ── Live-broadcast helpers ────────────────────────────────────────────────

/** True once all 32 matches have a result — gates the revelation ceremony. */
export function isSuper8MistoComplete(matches: Match[]): boolean {
  return matches.length === SUPER8_MISTO_MATCHES && matches.every(m => m.status === 'done')
}

/**
 * The round currently being played: the earliest round with a pending
 * match, or — once everything is done — the last round. Used by the TV
 * mode to know when to stop showing the partial ranking (round >= 5).
 */
export function getCurrentSuper8MistoRound(matches: Match[]): number {
  const pendingRounds = matches.filter(m => m.status === 'pending').map(m => m.round)
  if (pendingRounds.length > 0) return Math.min(...pendingRounds)
  return Math.max(1, ...matches.map(m => m.round))
}
