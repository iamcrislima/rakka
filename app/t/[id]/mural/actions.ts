'use server'

import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIp, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export type UploadMuralPhotoResult = { ok: true } | { ok: false; error: string }

/** Moved server-side (was a direct browser → Supabase call) specifically so
 *  we can rate-limit by IP — the browser client has no access to the
 *  request's IP at all. */
export async function uploadMuralPhoto(tournamentId: string, formData: FormData): Promise<UploadMuralPhotoResult> {
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Nenhuma imagem selecionada.' }
  if (!file.type.startsWith('image/')) return { ok: false, error: 'Envie apenas arquivos de imagem.' }
  if (file.size > MAX_SIZE) return { ok: false, error: 'A imagem deve ter no máximo 5MB.' }

  const ip = await getClientIp()
  const supabase = await createClient()

  const { allowed } = await checkRateLimit(supabase, 'mural_upload', ip, { max: 5, windowSeconds: 300 })
  if (!allowed) return { ok: false, error: RATE_LIMIT_MESSAGE }

  const ext  = file.name.split('.').pop() || 'jpg'
  const path = `${tournamentId}/${crypto.randomUUID()}.${ext}`

  const { error: upErr } = await supabase.storage.from('mural-photos').upload(path, file, { contentType: file.type })
  if (upErr) return { ok: false, error: 'Não foi possível enviar a foto. Tente novamente.' }

  const { error: dbErr } = await supabase
    .from('mural_photos')
    .insert({ tournament_id: tournamentId, storage_path: path, status: 'pending' })

  if (dbErr) return { ok: false, error: 'Não foi possível enviar a foto. Tente novamente.' }

  return { ok: true }
}
