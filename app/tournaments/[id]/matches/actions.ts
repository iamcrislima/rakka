'use server'

/**
 * Server-side gate for confirming a match result. The various score-entry
 * UIs (MatchCard, ControlMatchRow, ScoreInput) already gate the "Confirmar"
 * button on isValidFinalScore client-side, but that's advisory only — this
 * action re-fetches the match's actual rules and re-validates before ever
 * writing to the database, so a stale client or a direct API call can't
 * persist an invalid score (e.g. 6x3 under the sum-to-7 preset).
 */

import { createClient } from '@/lib/supabase/server'
import { isValidFinalScore, rulesFromCategory, rulesFromTournament } from '@/lib/match-rules'
import type { MatchRules } from '@/types'

export interface SubmitMatchResultResult {
  ok:     boolean
  error?: string
}

interface MatchRow {
  id:            string
  tournament_id: string
  category_id:   string | null
  status:        string
  started_at:    string | null
}

async function getMatchAndRules(
  supabase: Awaited<ReturnType<typeof createClient>>,
  matchId:  string,
): Promise<{ match: MatchRow; rules: MatchRules } | { error: string }> {
  const { data: match, error: mErr } = await supabase
    .from('matches')
    .select('id, tournament_id, category_id, status, started_at')
    .eq('id', matchId)
    .single()

  if (mErr || !match) return { error: 'Partida não encontrada.' }

  let rules: MatchRules
  if (match.category_id) {
    const { data: cat, error: cErr } = await supabase
      .from('categories').select('max_games, deuce, tiebreak_to, rule_type, target_sum').eq('id', match.category_id).single()
    if (cErr || !cat) return { error: 'Categoria não encontrada.' }
    rules = rulesFromCategory(cat)
  } else {
    const { data: t, error: tErr } = await supabase
      .from('tournaments').select('max_games, deuce, tiebreak_to, rule_type, target_sum').eq('id', match.tournament_id).single()
    if (tErr || !t) return { error: 'Torneio não encontrado.' }
    rules = rulesFromTournament(t)
  }

  return { match, rules }
}

function validateScore(score1: number, score2: number, rules: MatchRules): string | null {
  if (!Number.isInteger(score1) || !Number.isInteger(score2) || score1 < 0 || score2 < 0) {
    return 'Placar inválido.'
  }
  if (!isValidFinalScore(score1, score2, rules)) {
    return rules.type === 'sum_of_games'
      ? `Placar inválido — a soma dos games deve ser ${rules.targetSum}.`
      : 'Placar inválido para as regras desta categoria.'
  }
  return null
}

/**
 * Marks a match as started so the "Iniciar partida" clock has an anchor —
 * called once, when the organizer taps the button on a not-yet-started
 * match card. A no-op if the match was already started or is done, so
 * repeated/late clicks can never overwrite an earlier start time.
 */
export async function startMatch(matchId: string): Promise<SubmitMatchResultResult> {
  const supabase = await createClient()

  const { data: match, error: mErr } = await supabase
    .from('matches')
    .select('id, status, started_at')
    .eq('id', matchId)
    .single()

  if (mErr || !match) return { ok: false, error: 'Partida não encontrada.' }
  if (match.status === 'done') return { ok: false, error: 'Esta partida já foi concluída.' }
  if (match.started_at) return { ok: true }

  const { error: uErr } = await supabase
    .from('matches')
    .update({ started_at: new Date().toISOString() })
    .eq('id', matchId)

  if (uErr) return { ok: false, error: uErr.message }

  return { ok: true }
}

export async function submitMatchResult(
  matchId: string,
  score1:  number,
  score2:  number,
): Promise<SubmitMatchResultResult> {
  const supabase = await createClient()

  const result = await getMatchAndRules(supabase, matchId)
  if ('error' in result) return { ok: false, error: result.error }
  const { match, rules } = result

  if (match.status === 'done') return { ok: false, error: 'Este resultado já foi confirmado.' }

  const scoreError = validateScore(score1, score2, rules)
  if (scoreError) return { ok: false, error: scoreError }

  // If the match was started, capture how long it actually took. If it was
  // never started (e.g. result entered after the fact), leave it null.
  const durationSeconds = match.started_at
    ? Math.max(0, Math.round((Date.now() - new Date(match.started_at).getTime()) / 1000))
    : null

  const { error: uErr } = await supabase
    .from('matches')
    .update({ score1, score2, status: 'done', duration_seconds: durationSeconds })
    .eq('id', matchId)

  if (uErr) return { ok: false, error: uErr.message }

  return { ok: true }
}

/**
 * Corrects an already-confirmed match result. Re-runs the same validation
 * as submitMatchResult, but requires the match to ALREADY be done (the
 * opposite guard) — this is a correction path, not the initial confirm.
 * Ranking pages recompute from matches on every render, so no separate
 * "recalculate" step is needed after the score update lands.
 */
export async function editMatchResult(
  matchId: string,
  score1:  number,
  score2:  number,
): Promise<SubmitMatchResultResult> {
  const supabase = await createClient()

  const result = await getMatchAndRules(supabase, matchId)
  if ('error' in result) return { ok: false, error: result.error }
  const { match, rules } = result

  if (match.status !== 'done') return { ok: false, error: 'Esta partida ainda não foi confirmada.' }

  const scoreError = validateScore(score1, score2, rules)
  if (scoreError) return { ok: false, error: scoreError }

  const { error: uErr } = await supabase
    .from('matches')
    .update({ score1, score2 })
    .eq('id', matchId)

  if (uErr) return { ok: false, error: uErr.message }

  return { ok: true }
}
