import { headers } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Friendly message shown for every rate-limited action — never a raw error. */
export const RATE_LIMIT_MESSAGE = 'Muitas tentativas, aguarde um instante e tente novamente.'

/** Best-effort client IP from the standard proxy headers Vercel/most hosts set. */
export async function getClientIp(): Promise<string> {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return h.get('x-real-ip') ?? 'unknown'
}

/**
 * Minimal IP+action rate limiter backed by the `rate_limit_hits` table.
 * Not sophisticated by design — just enough to blunt accidental request
 * spam on public, unauthenticated surfaces during a live event. Each call
 * both checks AND records one hit, and opportunistically prunes its own
 * expired rows so the table never needs a separate cleanup job.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  action:   string,
  ip:       string,
  { max, windowSeconds }: { max: number; windowSeconds: number },
): Promise<{ allowed: boolean }> {
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString()

  await supabase
    .from('rate_limit_hits')
    .delete()
    .eq('action', action)
    .eq('ip_key', ip)
    .lt('created_at', windowStart)

  const { count } = await supabase
    .from('rate_limit_hits')
    .select('id', { count: 'exact', head: true })
    .eq('action', action)
    .eq('ip_key', ip)
    .gte('created_at', windowStart)

  if ((count ?? 0) >= max) return { allowed: false }

  await supabase.from('rate_limit_hits').insert({ action, ip_key: ip })
  return { allowed: true }
}
