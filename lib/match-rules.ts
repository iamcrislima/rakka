import type { MatchRules, RuleType } from '@/types'

export type { MatchRules, RuleType }

// ── Presets ────────────────────────────────────────────────────
//
//  Clássico → até 6 · 5×5 vai até 7 · TB em 6×6 até 7
//  Rápido   → até 6 · 5×5 direto pro tie-break até 7

export const PRESETS = {
  beach: {
    label:       'Clássico',
    description: '5×5 vai até 7 · TB em 6×6 até 7',
    icon:        '🏆',
    rules: { type: 'standard', max_games: 6, deuce: 'super_tiebreak', tiebreak_to: 7, targetSum: null } satisfies MatchRules,
  },
  fast: {
    label:       'Rápido',
    description: '5×5 vai direto pro tie-break até 7',
    icon:        '⚡',
    rules: { type: 'standard', max_games: 6, deuce: 'tiebreak', tiebreak_to: 7, targetSum: null } satisfies MatchRules,
  },
} as const

export type PresetKey = keyof typeof PRESETS

export const DEFAULT_RULES: MatchRules = PRESETS.beach.rules

/** Suggested default when a category first switches to "Soma de Games". */
export const DEFAULT_TARGET_SUM = 6

/** Build a sum-of-games MatchRules for a given target. */
export function sumOfGamesRules(targetSum: number): MatchRules {
  return { type: 'sum_of_games', max_games: 6, deuce: 'super_tiebreak', tiebreak_to: 7, targetSum }
}

// ── Logic ──────────────────────────────────────────────────────

/**
 * Maximum score a team can reach under the given rules.
 *
 *  'sum_of_games':   the whole match sums to targetSum → caps at targetSum (e.g. 7-0)
 *  'tiebreak':       TB at (max-1)/(max-1) → winner caps at max_games     e.g. 6-5
 *  'super_tiebreak': play to max+1, then TB at max/max → caps at max_games+1  e.g. 7-6
 */
export function maxScore(rules: MatchRules): number {
  if (rules.type === 'sum_of_games') return rules.targetSum ?? 0
  return rules.deuce === 'tiebreak' ? rules.max_games : rules.max_games + 1
}

/** True when these rules are the "Soma de Games" format. */
export function isSumOfGames(rules: MatchRules): boolean {
  return rules.type === 'sum_of_games'
}

/**
 * True when s1/s2 represent a valid, complete match result.
 *
 *  'sum_of_games'   — no advantage, no tiebreak: valid only if s1 + s2 === targetSum
 *  'tiebreak'       — TB at (max-1)/(max-1):   valid: 6-x (x≤4), 6-5
 *  'super_tiebreak' — play to max+1 then TB:   valid: 6-x (x≤4), 7-5, 7-6
 *                     (same pattern for max=4: 4-x (x≤2), 5-3, 5-4)
 */
export function isValidFinalScore(s1: number, s2: number, rules: MatchRules): boolean {
  if (s1 === s2) return false
  if (s1 < 0 || s2 < 0) return false

  if (rules.type === 'sum_of_games') {
    return rules.targetSum != null && s1 + s2 === rules.targetSum
  }

  const winner = Math.max(s1, s2)
  const loser  = Math.min(s1, s2)
  const diff   = winner - loser

  if (winner < rules.max_games) return false

  if (rules.deuce === 'tiebreak') {
    return winner === rules.max_games && diff >= 1
  }

  // super_tiebreak: (max-1)/(max-1) → play to max+1; max/max → tiebreak → max+1/max
  if (winner === rules.max_games)     return diff >= 2  // e.g. 6-4 or 4-2
  if (winner === rules.max_games + 1) return diff >= 1  // e.g. 7-5, 7-6 or 5-3, 5-4
  return false
}

/** One-line rules description */
export function rulesHint(rules: MatchRules): string {
  if (rules.type === 'sum_of_games') {
    return `Soma de games até ${rules.targetSum ?? '?'} · sem vantagem, sem tie-break`
  }
  const tie = rules.max_games - 1
  const deuce = rules.deuce === 'tiebreak'
    ? `TB em ${tie}×${tie} até ${rules.tiebreak_to}`
    : `${tie}×${tie} vai até ${rules.max_games + 1} · TB em ${rules.max_games}×${rules.max_games} até ${rules.tiebreak_to}`
  return `Até ${rules.max_games} · ${deuce}`
}

/** Dynamic deuce option labels for a given max_games value */
export function deuceOptions(maxGames: number): { value: MatchRules['deuce']; label: string; sub: string }[] {
  const tie = maxGames - 1
  return [
    {
      value: 'super_tiebreak',
      label: `${tie}×${tie} vai até ${maxGames + 1}, TB em ${maxGames}×${maxGames}`,
      sub:   `Joga até ${maxGames + 1} · tie-break se empatar ${maxGames}×${maxGames}`,
    },
    {
      value: 'tiebreak',
      label: `${tie}×${tie} vai direto pro tie-break`,
      sub:   `Tie-break imediato se empatar ${tie}×${tie}`,
    },
  ]
}

/** Which preset key matches, or 'custom'. Only meaningful for 'standard' rules. */
export function detectPreset(rules: MatchRules): PresetKey | 'custom' {
  if (rules.type !== 'standard') return 'custom'
  for (const [key, p] of Object.entries(PRESETS) as [PresetKey, typeof PRESETS[PresetKey]][]) {
    const r = p.rules
    if (r.max_games === rules.max_games && r.deuce === rules.deuce && r.tiebreak_to === rules.tiebreak_to) {
      return key
    }
  }
  return 'custom'
}

/** Build a MatchRules from a camelCase editor draft (BuilderWizard / new-category form). */
export function toMatchRules(input: {
  maxGames:   MatchRules['max_games']
  deuce:      MatchRules['deuce']
  tiebreakTo: MatchRules['tiebreak_to']
  ruleType:   RuleType
  targetSum:  number | null
}): MatchRules {
  if (input.ruleType === 'sum_of_games') {
    return sumOfGamesRules(input.targetSum ?? DEFAULT_TARGET_SUM)
  }
  return { type: 'standard', max_games: input.maxGames, deuce: input.deuce, tiebreak_to: input.tiebreakTo, targetSum: null }
}

/** Cast a Category DB row to typed MatchRules */
export function rulesFromCategory(c: {
  max_games:   number
  deuce:       string
  tiebreak_to: number
  rule_type:   string
  target_sum:  number | null
}): MatchRules {
  return {
    type:        c.rule_type   as RuleType,
    max_games:   c.max_games   as MatchRules['max_games'],
    deuce:       c.deuce       as MatchRules['deuce'],
    tiebreak_to: c.tiebreak_to as MatchRules['tiebreak_to'],
    targetSum:   c.target_sum,
  }
}

/** Cast a Tournament DB row to typed MatchRules */
export function rulesFromTournament(t: {
  max_games:   number
  deuce:       string
  tiebreak_to: number
  rule_type:   string
  target_sum:  number | null
}): MatchRules {
  return {
    type:        t.rule_type   as RuleType,
    max_games:   t.max_games   as MatchRules['max_games'],
    deuce:       t.deuce       as MatchRules['deuce'],
    tiebreak_to: t.tiebreak_to as MatchRules['tiebreak_to'],
    targetSum:   t.target_sum,
  }
}
