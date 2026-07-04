import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { TVContent, Court } from '@/types'
import TVAdminPanel from './TVAdminPanel'

export default async function TVAdminPage({ params, searchParams }: {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ from?: string; label?: string }>
}) {
  const { id } = await params
  const { from, label } = await searchParams
  const supabase = await createClient()

  const [{ data: tournament }, { data: content }, { data: courts }] = await Promise.all([
    supabase.from('tournaments').select('id, name').eq('id', id).single(),
    supabase.from('tv_content').select('*').eq('tournament_id', id).order('sort_order'),
    supabase.from('courts').select('*').eq('tournament_id', id).order('sort_order'),
  ])

  if (!tournament) notFound()

  // Only trust `from` if it's a same-app relative path — never forward an
  // absolute/external URL or a "javascript:" scheme into a rendered <Link>.
  const safeFrom = from && from.startsWith(`/admin/tournaments/${id}/`) ? from : null

  return (
    <TVAdminPanel
      tournamentId={id}
      items={(content ?? []) as TVContent[]}
      courts={(courts ?? []) as Court[]}
      backTo={safeFrom ? { href: safeFrom, label: label ?? 'Voltar' } : null}
    />
  )
}
