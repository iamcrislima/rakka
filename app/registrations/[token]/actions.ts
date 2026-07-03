'use server'

import { createClient } from '@/lib/supabase/server'
import type { Registrant } from '@/types'

type JoinResult =
  | { status: 'confirmed'; position: number }
  | { status: 'waiting';   position: number }
  | { error: string }

export async function joinRegistration(
  registrationId: string,
  name: string,
  partnerName?: string,
): Promise<JoinResult> {
  const supabase = await createClient()

  // Load the registration
  const { data: reg, error: regErr } = await supabase
    .from('registrations')
    .select('id, player_limit, is_open')
    .eq('id', registrationId)
    .single()

  if (regErr || !reg) return { error: 'Inscrição não encontrada.' }
  if (!reg.is_open)   return { error: 'As inscrições estão encerradas.' }

  // Check for duplicate name (case-insensitive via ilike)
  const { data: existing } = await supabase
    .from('registrants')
    .select('id')
    .eq('registration_id', registrationId)
    .ilike('name', name.trim())
    .limit(1)

  if (existing && existing.length > 0)
    return { error: 'Este nome já está inscrito neste torneio.' }

  // Count confirmed players
  const { count: confirmedCount } = await supabase
    .from('registrants')
    .select('id', { count: 'exact', head: true })
    .eq('registration_id', registrationId)
    .eq('status', 'confirmed')

  const status: 'confirmed' | 'waiting' =
    (confirmedCount ?? 0) < reg.player_limit ? 'confirmed' : 'waiting'

  // Insert registrant
  const { error: insertErr } = await supabase
    .from('registrants')
    .insert({
      registration_id: registrationId,
      name:            name.trim(),
      partner_name:    partnerName?.trim() ?? null,
      status,
    })

  if (insertErr) {
    if (insertErr.code === '23505') return { error: 'Este nome já está inscrito.' }
    return { error: 'Erro ao salvar inscrição. Tente novamente.' }
  }

  // Compute position within status group for feedback
  const { count: posCount } = await supabase
    .from('registrants')
    .select('id', { count: 'exact', head: true })
    .eq('registration_id', registrationId)
    .eq('status', status)

  return { status, position: posCount ?? 1 }
}

export async function removeRegistrant(registrantId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  // Fetch the registrant to know its registration + status
  const { data: registrant } = await supabase
    .from('registrants')
    .select('id, registration_id, status')
    .eq('id', registrantId)
    .single<Registrant>()

  if (!registrant) return { error: 'Inscrito não encontrado.' }

  const { error: delErr } = await supabase
    .from('registrants')
    .delete()
    .eq('id', registrantId)

  if (delErr) return { error: delErr.message }

  // If we removed a confirmed player, promote the first waiting person
  if (registrant.status === 'confirmed') {
    const { data: first } = await supabase
      .from('registrants')
      .select('id')
      .eq('registration_id', registrant.registration_id)
      .eq('status', 'waiting')
      .order('joined_at', { ascending: true })
      .limit(1)
      .single()

    if (first) {
      await supabase
        .from('registrants')
        .update({ status: 'confirmed' })
        .eq('id', first.id)
    }
  }

  return {}
}

export async function toggleRegistrationOpen(
  registrationId: string,
  isOpen: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('registrations')
    .update({ is_open: isOpen })
    .eq('id', registrationId)

  return error ? { error: error.message } : {}
}
