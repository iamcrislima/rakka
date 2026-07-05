'use server'

import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIp, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'

export type CheckInResult = { ok: true } | { ok: false; error: string }

/** Idempotent — re-tapping an already-checked-in player just confirms
 *  success instead of erroring, since "1 check-in por jogador" is already
 *  guaranteed by simply not re-writing once true. */
export async function checkInPlayer(playerId: string): Promise<CheckInResult> {
  const ip = await getClientIp()
  const supabase = await createClient()

  const { allowed } = await checkRateLimit(supabase, 'checkin', ip, { max: 20, windowSeconds: 60 })
  if (!allowed) return { ok: false, error: RATE_LIMIT_MESSAGE }

  const { data: player, error: fetchErr } = await supabase
    .from('players')
    .select('checked_in')
    .eq('id', playerId)
    .single()

  if (fetchErr) return { ok: false, error: 'Check-in indisponível no momento. Avise o organizador.' }
  if (!player) return { ok: false, error: 'Jogador não encontrado.' }
  if (player.checked_in) return { ok: true }

  const { error } = await supabase
    .from('players')
    .update({ checked_in: true, checked_in_at: new Date().toISOString() })
    .eq('id', playerId)

  if (error) return { ok: false, error: 'Não foi possível confirmar o check-in. Tente novamente.' }
  return { ok: true }
}
