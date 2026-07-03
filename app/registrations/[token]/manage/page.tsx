import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Registration, Registrant } from '@/types'
import ManageHub from './ManageHub'

async function getData(token: string) {
  const supabase = await createClient()

  const { data: reg } = await supabase
    .from('registrations')
    .select('*')
    .eq('share_token', token)
    .single()

  if (!reg) return null

  const { data: registrants } = await supabase
    .from('registrants')
    .select('*')
    .eq('registration_id', reg.id)
    .order('joined_at', { ascending: true })

  return {
    registration: reg as Registration,
    registrants:  (registrants ?? []) as Registrant[],
  }
}

export default async function ManagePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const data = await getData(token)
  if (!data) notFound()

  return (
    <ManageHub
      registration={data.registration}
      registrants={data.registrants}
      token={token}
    />
  )
}
