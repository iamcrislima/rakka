'use server'

import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIp, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'
import { submitMatchResult, type SubmitMatchResultResult } from '@/app/admin/tournaments/[id]/matches/actions'

/**
 * Rate-limited wrapper around the shared `submitMatchResult` action, used
 * ONLY by the public, unauthenticated /t/[id]/lancar-resultado screen.
 * Deliberately NOT applied inside `submitMatchResult` itself — that action
 * is also called from the authenticated admin match UI, which shouldn't be
 * throttled by a limit meant for public abuse prevention.
 */
export async function submitPublicMatchResult(
  matchId: string,
  score1:  number,
  score2:  number,
): Promise<SubmitMatchResultResult> {
  const ip = await getClientIp()
  const supabase = await createClient()

  const { allowed } = await checkRateLimit(supabase, 'lancar_resultado', ip, { max: 10, windowSeconds: 60 })
  if (!allowed) return { ok: false, error: RATE_LIMIT_MESSAGE }

  return submitMatchResult(matchId, score1, score2)
}
