import { describe, expect, it } from 'vitest'
import type { Match, Player } from '@/types'
import {
  SUPER8_MISTO_ROUNDS,
  SUPER8_MISTO_STAGE,
  SUPER8_MISTO_TEAM_SIZE,
  generateSuper8MistoMatches,
  repairSuper8MistoOpponents,
} from './super8-misto'

/**
 * Builds a valid 8-men/8-women roster. `positions` lets a test scramble the
 * position ordering (and use non-sequential values) without changing which
 * physical player ends up at logical index i — the generator only cares
 * about sort-by-position, never about ids matching any particular pattern.
 */
function makePlayers(menPositions = [0, 1, 2, 3, 4, 5, 6, 7], womenPositions = [0, 1, 2, 3, 4, 5, 6, 7]): Player[] {
  const base = (id: string, position: number, gender: 'M' | 'F'): Player => ({
    id,
    tournament_id: 't1',
    category_id:   'c1',
    name:          id,
    position,
    gender,
    checked_in:    false,
    checked_in_at: null,
  })
  const men   = menPositions.map((pos, i) => base(`m${i}`, pos, 'M'))
  const women = womenPositions.map((pos, i) => base(`w${i}`, pos, 'F'))
  return [...men, ...women]
}

/** man-index (0-7) sorted by position, matching the generator's own sort. */
function indexById(players: Player[], gender: 'M' | 'F'): Map<string, number> {
  const sorted = players.filter(p => p.gender === gender).sort((a, b) => a.position - b.position)
  return new Map(sorted.map((p, i) => [p.id, i]))
}

function bump(counts: number[][], a: number, b: number) {
  counts[a][b]++
  counts[b][a]++
}

/**
 * For every player, checks (a) they partnered every opposite-gender player
 * exactly once, and (b) they faced every opposite-gender opponent at least
 * once, with at most one repeat (unavoidable: 8 rounds, only 7 possible
 * distinct opponents) — the two guarantees the user asked to be verified
 * mathematically, not just eyeballed once.
 */
function checkFullVariety(players: Player[], seeds: { round: number; team1_p1: string; team1_p2: string; team2_p1: string; team2_p2: string }[]) {
  const manIdx   = indexById(players, 'M')
  const womanIdx = indexById(players, 'F')

  const partnerCount  = Array.from({ length: 8 }, () => Array(8).fill(0)) // men x women
  const menOpponent   = Array.from({ length: 8 }, () => Array(8).fill(0))
  const womenOpponent = Array.from({ length: 8 }, () => Array(8).fill(0))

  expect(seeds).toHaveLength(32)
  for (let r = 1; r <= SUPER8_MISTO_ROUNDS; r++) {
    expect(seeds.filter(s => s.round === r)).toHaveLength(4)
  }

  for (const s of seeds) {
    const m1 = manIdx.get(s.team1_p1)!, w1 = womanIdx.get(s.team1_p2)!
    const m2 = manIdx.get(s.team2_p1)!, w2 = womanIdx.get(s.team2_p2)!
    partnerCount[m1][w1]++
    partnerCount[m2][w2]++
    bump(menOpponent, m1, m2)
    bump(womenOpponent, w1, w2)
  }

  // (a) every man partners every woman exactly once, and vice versa.
  for (let m = 0; m < 8; m++) {
    for (let w = 0; w < 8; w++) {
      expect(partnerCount[m][w]).toBe(1)
    }
  }

  // (b) every player faces every opposite-gender opponent, 7 distinct
  // opponents total across 8 rounds (one necessarily repeats once).
  for (const opponent of [menOpponent, womenOpponent]) {
    for (let p = 0; p < 8; p++) {
      const row = opponent[p]
      const total = row.reduce((sum, c) => sum + c, 0)
      const distinct = row.filter(c => c > 0).length
      expect(total).toBe(SUPER8_MISTO_ROUNDS)
      expect(distinct).toBe(7)
      expect(Math.max(...row)).toBeLessThanOrEqual(2)
    }
  }
}

describe('generateSuper8MistoMatches', () => {
  it('gives every player full partner and opponent variety (default ordering)', () => {
    const players = makePlayers()
    checkFullVariety(players, generateSuper8MistoMatches(players))
  })

  it('gives every player full partner and opponent variety with scrambled, non-sequential positions', () => {
    const players = makePlayers([70, 10, 40, 20, 60, 0, 50, 30], [35, 5, 25, 55, 15, 45, 65, 75])
    checkFullVariety(players, generateSuper8MistoMatches(players))
  })

  it('throws when the roster is not exactly 8 men + 8 women', () => {
    const players = makePlayers().slice(1) // drop one man
    expect(() => generateSuper8MistoMatches(players)).toThrow()
  })
})

describe('repairSuper8MistoOpponents', () => {
  function makeMatch(overrides: Partial<Match> & Pick<Match, 'id' | 'round' | 'team1_p1' | 'team1_p2' | 'team2_p1' | 'team2_p2'>): Match {
    return {
      tournament_id:    't1',
      category_id:      'c1',
      court_id:         null,
      stage:            SUPER8_MISTO_STAGE,
      score1:           null,
      score2:           null,
      status:           'pending',
      override_active:  false,
      queue_position:   null,
      started_at:       null,
      duration_seconds: null,
      created_at:       new Date().toISOString(),
      ...overrides,
    }
  }

  /** Reproduces the ORIGINAL bug: couple i always plays couple (i+4)%8, every round. */
  function buggyMatches(players: Player[]): Match[] {
    const men   = players.filter(p => p.gender === 'M').sort((a, b) => a.position - b.position)
    const women = players.filter(p => p.gender === 'F').sort((a, b) => a.position - b.position)
    const matches: Match[] = []
    for (let r = 0; r < SUPER8_MISTO_ROUNDS; r++) {
      const couples = men.map((man, i) => ({ man, woman: women[(i + r) % SUPER8_MISTO_TEAM_SIZE] }))
      for (let i = 0; i < 4; i++) {
        const j = i + 4
        matches.push(makeMatch({
          id:       `r${r}-m${i}`,
          round:    r + 1,
          team1_p1: couples[i].man.id,
          team1_p2: couples[i].woman.id,
          team2_p1: couples[j].man.id,
          team2_p2: couples[j].woman.id,
        }))
      }
    }
    return matches
  }

  it('never touches rounds that already have a done or started match', () => {
    const players = makePlayers()
    const matches = buggyMatches(players)
    // Lock in rounds 1-4 (the reported real-world scenario: 4 rounds already played).
    const lockedIds = new Set(matches.filter(m => m.round <= 4).map(m => m.id))
    for (const m of matches) if (lockedIds.has(m.id)) m.status = 'done'

    const updates = repairSuper8MistoOpponents(players, matches)

    expect(updates.some(u => lockedIds.has(u.matchId))).toBe(false)
    // Every match in an untouched round (5-8) gets repaired since the old
    // bug's constant grouping is still in place for all of them.
    expect(updates).toHaveLength(16)
  })

  it('preserves every couple exactly as-is — only who-plays-whom changes', () => {
    const players = makePlayers()
    const matches = buggyMatches(players)
    for (const m of matches) if (m.round <= 4) m.status = 'done'

    const updates = repairSuper8MistoOpponents(players, matches)
    const byId = new Map(matches.map(m => [m.id, m]))

    for (let r = 5; r <= 8; r++) {
      const before = matches.filter(m => m.round === r)
      const beforeCouples = new Set(before.flatMap(m => [`${m.team1_p1}|${m.team1_p2}`, `${m.team2_p1}|${m.team2_p2}`]))

      const after = updates.filter(u => byId.get(u.matchId)!.round === r)
      const afterCouples = new Set(after.flatMap(u => [`${u.team1_p1}|${u.team1_p2}`, `${u.team2_p1}|${u.team2_p2}`]))

      expect(afterCouples).toEqual(beforeCouples)
    }
  })

  it('substantially improves opponent variety despite the 4-round handicap already baked in', () => {
    const players = makePlayers()
    const manIdx   = indexById(players, 'M')
    const womanIdx = indexById(players, 'F')
    const matches = buggyMatches(players)
    for (const m of matches) if (m.round <= 4) m.status = 'done'

    const updates = repairSuper8MistoOpponents(players, matches)
    const updateById = new Map(updates.map(u => [u.matchId, u]))
    const finalMatches = matches.map(m => updateById.get(m.id) ?? m)

    const menOpponent   = Array.from({ length: 8 }, () => Array(8).fill(0))
    const womenOpponent = Array.from({ length: 8 }, () => Array(8).fill(0))
    for (const m of finalMatches) {
      bump(menOpponent,   manIdx.get(m.team1_p1)!,   manIdx.get(m.team2_p1)!)
      bump(womenOpponent, womanIdx.get(m.team1_p2)!, womanIdx.get(m.team2_p2)!)
    }

    // Before repair every player had exactly 1 distinct opponent (the old
    // bug). With 4 of 8 rounds already locked to that single opponent, the
    // best any repair can do is introduce up to 4 more distinct ones — so
    // every player must end up with at least 4 distinct opponents (up from 1).
    for (const opponent of [menOpponent, womenOpponent]) {
      for (let p = 0; p < 8; p++) {
        const distinct = opponent[p].filter(c => c > 0).length
        expect(distinct).toBeGreaterThanOrEqual(4)
      }
    }
  })
})
