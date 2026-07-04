import type { Match } from '@/types'

export interface RoundPrediction {
  round:          number
  /** Estimated wall-clock start time for this round. */
  predictedStart: Date
  /** True once the round has actually started (so the time is no longer just a guess). */
  hasStarted:     boolean
  /** True once every match in the round is done. */
  isComplete:     boolean
  /** True when `now` is past predictedStart and the round hasn't started yet. */
  isDelayed:      boolean
}

/**
 * Predicts a wall-clock start time PER ROUND (not per match — matches in the
 * same round run in parallel across different courts, so they share one
 * estimate). Round 1 anchors on `scheduledAt`. Each later round's estimate is
 * pushed out by the running average duration of the rounds completed so far
 * (from real started_at/duration_seconds data), falling back to
 * `defaultIntervalMinutes` until at least one round has finished.
 *
 * Returns an empty map when there's no scheduled_at — there's nothing to
 * predict from.
 */
export function computeRoundSchedule(
  matches:              Match[],
  scheduledAt:          string | null,
  defaultIntervalMinutes: number,
  now:                  Date = new Date(),
): Map<number, RoundPrediction> {
  const result = new Map<number, RoundPrediction>()
  if (!scheduledAt) return result

  const rounds = Array.from(new Set(matches.map(m => m.round))).sort((a, b) => a - b)
  if (rounds.length === 0) return result

  let cursor = new Date(scheduledAt)
  const completedDurationsMin: number[] = []

  for (const round of rounds) {
    const roundMatches = matches.filter(m => m.round === round)
    const isComplete    = roundMatches.every(m => m.status === 'done')
    const hasStarted     = roundMatches.some(m => m.started_at != null)

    const predictedStart = new Date(cursor)
    const isDelayed = !hasStarted && now.getTime() > predictedStart.getTime()

    result.set(round, { round, predictedStart, hasStarted, isComplete, isDelayed })

    // Actual duration for this round (parallel courts → span from earliest
    // start to latest finish), used to refine the NEXT round's estimate.
    if (isComplete) {
      const starts = roundMatches
        .map(m => m.started_at ? new Date(m.started_at).getTime() : null)
        .filter((v): v is number => v != null)
      const ends = roundMatches
        .map(m => (m.started_at != null && m.duration_seconds != null)
          ? new Date(m.started_at).getTime() + m.duration_seconds * 1000
          : null)
        .filter((v): v is number => v != null)

      if (starts.length > 0 && ends.length > 0) {
        completedDurationsMin.push((Math.max(...ends) - Math.min(...starts)) / 60000)
      }
    }

    const nextIntervalMin = completedDurationsMin.length > 0
      ? completedDurationsMin.reduce((sum, d) => sum + d, 0) / completedDurationsMin.length
      : defaultIntervalMinutes

    cursor = new Date(cursor.getTime() + nextIntervalMin * 60000)
  }

  return result
}
