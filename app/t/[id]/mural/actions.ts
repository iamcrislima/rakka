'use server'

import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIp, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export type MuralPhotoActionResult =
  | { ok: true; path: string }
  | { ok: false; error: string }

/**
 * Authorizes an upload and reserves its path. The image intentionally does
 * not cross the Server Action/Vercel Function: Next limits Server Action
 * bodies to 1MB by default, before this function can even run.
 */
export async function prepareMuralPhotoUpload(
  tournamentId: string,
  file: { name: string; type: string; size: number },
): Promise<MuralPhotoActionResult> {
  if (!file.name || file.size === 0) return { ok: false, error: 'Nenhuma imagem selecionada.' }
  if (!file.type.startsWith('image/')) return { ok: false, error: 'Envie apenas arquivos de imagem.' }
  if (file.size > MAX_SIZE) return { ok: false, error: 'A imagem deve ter no máximo 5MB.' }

  const ip = await getClientIp()
  const supabase = await createClient()
  const { allowed } = await checkRateLimit(supabase, 'mural_upload', ip, { max: 5, windowSeconds: 300 })
  if (!allowed) return { ok: false, error: RATE_LIMIT_MESSAGE }

  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  return { ok: true, path: `${tournamentId}/${crypto.randomUUID()}.${ext}` }
}

/** Adds an uploaded object to the moderation queue. */
export async function registerMuralPhoto(
  tournamentId: string,
  path: string,
): Promise<MuralPhotoActionResult> {
  if (!path.startsWith(`${tournamentId}/`)) {
    return { ok: false, error: 'Não foi possível registrar a foto. Tente novamente.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('mural_photos')
    .insert({ tournament_id: tournamentId, storage_path: path, status: 'pending' })

  if (error) {
    return { ok: false, error: 'A foto foi enviada, mas não entrou na moderação. Tente novamente.' }
  }

  return { ok: true, path }
}
