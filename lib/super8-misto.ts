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
 * Match-up within a round (4 matches from the 8 mixed couples) — FIXED BUG,
 * TWICE:
 *
 * 1st bug (original release): always paired couple i vs couple (i+4) mod 8,
 * for every single round, so man i faced the SAME opposing man (i+4) in all
 * 8 rounds regardless of partner rotation.
 *
 * 2nd bug (first attempted fix): `pickFairMatching` was changed to pick,
 * round by round, whichever pairing of MEN-indices had been faced the
 * fewest times so far — which does spread out the men's opponents, but
 * completely ignores the WOMEN's side. Since the woman paired with man i in
 * round r is (i+r) mod 8, two couples that face each other put two SPECIFIC
 * women against each other too — and optimizing only for men's variety left
 * plenty of real cases (confirmed against production data) where a woman
 * repeated an opponent the men's-only search had no way to see or avoid.
 *
 * Current fix: `pickFairMatching` now tracks BOTH a men-vs-men history AND
 * a women-vs-women history, and for each round picks — out of all 105
 * possible ways to split 8 men-indices into 4 pairs — whichever one
 * minimizes the COMBINED repeat count on both sides at once (the
 * women-pairing for a given men-pairing is fully determined once the
 * round's partner rotation is fixed, so this can be computed and scored
 * before choosing). Verified in lib/super8-misto.test.ts: for a fresh
 * category this gives every player — man or woman — exactly 7 distinct
 * opposite-gender opponents across the 8 rounds (6 distinct + 1 unavoidable
 * repeat, since there are only 7 possible opponents but 8 rounds).
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
 * All 105 ways to split {0..7} into 4 disjoint pairs — (8-1)!! = 105, cheap
 * enough to enumerate once and re-score every round.
 */
function allPerfectMatchings(elements: number[]): [number, number][][] {
  if (elements.length === 0) return [[]]
  const [first, ...rest] = elements
  const results: [number, number][][] = []
  for (let i = 0; i < rest.length; i++) {
    const partner = rest[i]
    const remaining = [...rest.slice(0, i), ...rest.slice(i + 1)]
    for (const sub of allPerfectMatchings(remaining)) {
      results.push([[first, partner], ...sub])
    }
  }
  return results
}

const ALL_MEN_MATCHINGS = allPerfectMatchings([0, 1, 2, 3, 4, 5, 6, 7])

/**
 * Builds ONE round's opponent pairing (which of the 8 men-indices face
 * which) by trying all 105 possible pairings and keeping whichever
 * minimizes the COMBINED repeat count on BOTH sides at once: for a
 * candidate men-pair (i, j), the round's fixed partner rotation means the
 * women paired with them are ((i+round)%8, (j+round)%8), so that women-pair
 * repeat count can be scored right alongside the men-pair's. Mutates
 * `menPlayedCount`/`womenPlayedCount` in place once the best matching for
 * the round is chosen, so a caller building several rounds in sequence
 * keeps steering both genders away from repeats across all of them. Ties
 * break on `ALL_MEN_MATCHINGS` order, which is what makes a fresh (all-zero)
 * history produce a deterministic, reproducible schedule.
 */
function pickFairMatching(
  round: number,
  menPlayedCount: number[][],
  womenPlayedCount: number[][],
): [number, number][] {
  let best = ALL_MEN_MATCHINGS[0]
  let bestScore = Infinity
  for (const matching of ALL_MEN_MATCHINGS) {
    let score = 0
    for (const [i, j] of matching) {
      score += menPlayedCount[i][j]
      const wi = (i + round) % SUPER8_MISTO_TEAM_SIZE
      const wj = (j + round) % SUPER8_MISTO_TEAM_SIZE
      score += womenPlayedCount[wi][wj]
    }
    if (score < bestScore) { bestScore = score; best = matching }
  }
  for (const [i, j] of best) {
    menPlayedCount[i][j]++
    menPlayedCount[j][i]++
    const wi = (i + round) % SUPER8_MISTO_TEAM_SIZE
    const wj = (j + round) % SUPER8_MISTO_TEAM_SIZE
    womenPlayedCount[wi][wj]++
    womenPlayedCount[wj][wi]++
  }
  return best
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
  const menPlayedCount   = Array.from({ length: SUPER8_MISTO_TEAM_SIZE }, () => Array(SUPER8_MISTO_TEAM_SIZE).fill(0))
  const womenPlayedCount = Array.from({ length: SUPER8_MISTO_TEAM_SIZE }, () => Array(SUPER8_MISTO_TEAM_SIZE).fill(0))

  for (let r = 0; r < SUPER8_MISTO_ROUNDS; r++) {
    // couples[i] = man i + woman (i + r) mod 8
    const couples = men.map((man, i) => ({
      man,
      woman: women[(i + r) % SUPER8_MISTO_TEAM_SIZE],
    }))

    for (const [i, j] of pickFairMatching(r, menPlayedCount, womenPlayedCount)) {
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
 * Critically, both `menPlayedCount` and `womenPlayedCount` are seeded from
 * the ALREADY-locked-in rounds first (done or in-progress matches) before
 * touching anything — so the pairs the old bug already forced to repeat are
 * correctly treated as "overplayed" on BOTH sides, and `pickFairMatching`
 * steers the remaining rounds away from repeating them again, instead of
 * just reproducing a different-but-still-blind formula.
 *
 * Returns the {matchId, team1_p1, team1_p2, team2_p1, team2_p2} updates to
 * write — callers apply them (this function only computes, never writes).
 */
export function repairSuper8MistoOpponents(players: Player[], matches: Match[]): Super8MistoRepairUpdate[] {
  const men   = players.filter(p => p.gender === 'M').sort((a, b) => a.position - b.position)
  const women = players.filter(p => p.gender === 'F').sort((a, b) => a.position - b.position)
  const manIndex   = new Map(men.map((m, i) => [m.id, i]))
  const womanIndex = new Map(women.map((w, i) => [w.id, i]))

  const rounds = Array.from({ length: SUPER8_MISTO_ROUNDS }, (_, i) => i + 1)
    .map(round => matches.filter(m => m.round === round && m.stage === SUPER8_MISTO_STAGE))
    .filter(ms => ms.length > 0)

  const menPlayedCount   = Array.from({ length: SUPER8_MISTO_TEAM_SIZE }, () => Array(SUPER8_MISTO_TEAM_SIZE).fill(0))
  const womenPlayedCount = Array.from({ length: SUPER8_MISTO_TEAM_SIZE }, () => Array(SUPER8_MISTO_TEAM_SIZE).fill(0))

  // Seed with every round that already has SOME committed result/activity —
  // these are never touched, but their opponent history still counts.
  for (const roundMatches of rounds) {
    if (!roundMatches.some(m => m.status === 'done' || m.started_at != null)) continue
    for (const m of roundMatches) {
      const i = manIndex.get(m.team1_p1)
      const j = manIndex.get(m.team2_p1)
      if (i != null && j != null) { menPlayedCount[i][j]++; menPlayedCount[j][i]++ }
      const wi = womanIndex.get(m.team1_p2)
      const wj = womanIndex.get(m.team2_p2)
      if (wi != null && wj != null) { womenPlayedCount[wi][wj]++; womenPlayedCount[wj][wi]++ }
    }
  }

  const updates: Super8MistoRepairUpdate[] = []

  for (let round = 1; round <= SUPER8_MISTO_ROUNDS; round++) {
    const roundMatches = rounds.find(ms => ms[0]?.round === round)
    if (!roundMatches) continue
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

    pickFairMatching(round - 1, menPlayedCount, womenPlayedCount).forEach(([i, j], k) => {
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
