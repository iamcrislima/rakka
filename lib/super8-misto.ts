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
 * Match-up within a round (4 matches from the 8 mixed couples) — FIXED BUG:
 * this used to always pair couple i vs couple (i+4) mod 8, for every single
 * round, which meant man i faced the SAME opposing man (i+4) in all 8
 * rounds regardless of partner rotation. `pickFairMatching` now decides the
 * opponent pairing greedily round-by-round, always giving each man whichever
 * remaining opponent he's faced the FEWEST times so far (see below) — across
 * a fresh 8-round tournament that means 6 distinct opponents plus one
 * unavoidable repeat (8 rounds > 7 possible distinct opponents for 8 men).
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
 * Greedily builds ONE round's opponent pairing (a perfect matching of 8
 * men-indices into 4 disjoint pairs), always giving each still-unpaired man
 * whichever remaining candidate he's faced the fewest times so far —
 * mutating `playedCount` in place as pairs are chosen, so a caller building
 * several rounds in sequence naturally keeps spreading opponents fairly
 * across all of them (never just re-deriving the same round in isolation).
 * Ties break on lowest index, which is what makes a fresh (all-zero)
 * `playedCount` produce a deterministic, reproducible schedule.
 */
function pickFairMatching(playedCount: number[][]): [number, number][] {
  const remaining = [0, 1, 2, 3, 4, 5, 6, 7]
  const pairs: [number, number][] = []
  while (remaining.length > 0) {
    const i = remaining.shift()!
    let bestJ = -1
    let bestCount = Infinity
    for (const j of remaining) {
      if (playedCount[i][j] < bestCount) { bestCount = playedCount[i][j]; bestJ = j }
    }
    remaining.splice(remaining.indexOf(bestJ), 1)
    pairs.push([i, bestJ])
    playedCount[i][bestJ]++
    playedCount[bestJ][i]++
  }
  return pairs
}

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
  const playedCount = Array.from({ length: SUPER8_MISTO_TEAM_SIZE }, () => Array(SUPER8_MISTO_TEAM_SIZE).fill(0))

  for (let r = 0; r < SUPER8_MISTO_ROUNDS; r++) {
    // couples[i] = man i + woman (i + r) mod 8
    const couples = men.map((man, i) => ({
      man,
      woman: women[(i + r) % SUPER8_MISTO_TEAM_SIZE],
    }))

    for (const [i, j] of pickFairMatching(playedCount)) {
      const c1 = couples[i]
      const c2 = couples[j]
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

// ── Repair — fixes categories generated before the opponent-rotation bug ──

export interface Super8MistoRepairUpdate {
  matchId:  string
  team1_p1: string
  team1_p2: string
  team2_p1: string
  team2_p2: string
}

/**
 * Repairs the "same opponent every round" bug for a category whose matches
 * were already generated with the old, broken fixed i-vs-(i+4) formula.
 * Only rounds where NOTHING has happened yet are touched — a round is
 * skipped entirely (left byte-for-byte as-is) if ANY of its matches is
 * already done OR already started (in progress right now on a court), so
 * an active or completed match's participants can never change underneath
 * anyone. The couples themselves (who's partnered with whom) are never
 * altered either — only which two couples are matched against each other
 * within an untouched round.
 *
 * Critically, `playedCount` is seeded from the ALREADY-locked-in rounds
 * first (done or in-progress matches) before touching anything — so the 4
 * pairs the old bug already forced to play 3 times in a row are correctly
 * treated as "overplayed" and `pickFairMatching` steers the remaining
 * rounds away from repeating them again, instead of just reproducing a
 * different-but-still-blind fixed formula.
 *
 * Returns the {matchId, team1_p1, team1_p2, team2_p1, team2_p2} updates to
 * write — callers apply them (this function only computes, never writes).
 */
export function repairSuper8MistoOpponents(players: Player[], matches: Match[]): Super8MistoRepairUpdate[] {
  const men = players.filter(p => p.gender === 'M').sort((a, b) => a.position - b.position)
  const manIndex = new Map(men.map((m, i) => [m.id, i]))

  const rounds = Array.from({ length: SUPER8_MISTO_ROUNDS }, (_, i) => i + 1)
    .map(round => matches.filter(m => m.round === round && m.stage === SUPER8_MISTO_STAGE))
    .filter(ms => ms.length > 0)

  const playedCount = Array.from({ length: SUPER8_MISTO_TEAM_SIZE }, () => Array(SUPER8_MISTO_TEAM_SIZE).fill(0))

  // Seed with every round that already has SOME committed result/activity —
  // these are never touched, but their opponent history still counts.
  for (const roundMatches of rounds) {
    if (!roundMatches.some(m => m.status === 'done' || m.started_at != null)) continue
    for (const m of roundMatches) {
      const i = manIndex.get(m.team1_p1)
      const j = manIndex.get(m.team2_p1)
      if (i == null || j == null) continue
      playedCount[i][j]++
      playedCount[j][i]++
    }
  }

  const updates: Super8MistoRepairUpdate[] = []

  for (const roundMatches of rounds) {
    if (roundMatches.length !== 4) continue // incomplete/unexpected shape — skip defensively
    if (roundMatches.some(m => m.status === 'done' || m.started_at != null)) continue

    // Recover the 8 couples for this round straight from the existing rows
    // — each (man, woman) pairing is already correct, only the grouping
    // into "who plays whom" needs fixing.
    const couplesByManIndex = new Map<number, { manId: string; womanId: string }>()
    for (const m of roundMatches) {
      const idx1 = manIndex.get(m.team1_p1)
      const idx2 = manIndex.get(m.team2_p1)
      if (idx1 != null) couplesByManIndex.set(idx1, { manId: m.team1_p1, womanId: m.team1_p2 })
      if (idx2 != null) couplesByManIndex.set(idx2, { manId: m.team2_p1, womanId: m.team2_p2 })
    }
    if (couplesByManIndex.size !== 8) continue // couldn't map every man — skip, don't guess

    // Reuse the round's existing 4 rows in a stable order so this only
    // ever UPDATEs matches, never inserts/deletes/reorders them.
    const sortedMatchIds = [...roundMatches].sort((a, b) => a.id.localeCompare(b.id)).map(m => m.id)

    pickFairMatching(playedCount).forEach(([i, j], k) => {
      const c1 = couplesByManIndex.get(i)!
      const c2 = couplesByManIndex.get(j)!
      updates.push({
        matchId:  sortedMatchIds[k],
        team1_p1: c1.manId,
        team1_p2: c1.womanId,
        team2_p1: c2.manId,
        team2_p2: c2.womanId,
      })
    })
  }

  return updates
}
