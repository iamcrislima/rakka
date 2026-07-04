import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { buildOpenGraph, buildTwitter } from '@/lib/seo'
import type { Registration, Registrant } from '@/types'
import JoinForm from './JoinForm'

// ── Metadata ────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const supabase = await createClient()

  const { data: reg } = await supabase
    .from('registrations')
    .select('id, name')
    .eq('share_token', token)
    .single()

  if (!reg) return {}

  const { data: catRow } = await supabase
    .from('categories')
    .select('tournaments(name)')
    .eq('registration_id', reg.id)
    .single()

  const tRaw  = catRow?.tournaments
  const tName = (Array.isArray(tRaw) ? tRaw[0] : tRaw)?.name as string | undefined

  const title       = tName ?? reg.name
  const description = `Inscreva-se no ${title}`

  return {
    title,
    description,
    openGraph: buildOpenGraph({ title, description }),
    twitter:   buildTwitter({ title, description }),
  }
}

interface CategoryContext {
  categoryName:    string
  tournamentName:  string
  tournamentType:  'super' | 'doubles'
  price:           number | null
  paymentMode:     'individual' | 'pair' | null
}

async function getData(token: string) {
  const supabase = await createClient()

  const { data: reg } = await supabase
    .from('registrations')
    .select('*')
    .eq('share_token', token)
    .single()

  if (!reg) return null

  const [{ data: registrants }, { data: catRow }] = await Promise.all([
    supabase
      .from('registrants')
      .select('*')
      .eq('registration_id', reg.id)
      .order('joined_at', { ascending: true }),
    // Attempt to find a category linked to this registration
    supabase
      .from('categories')
      .select('name, price, payment_mode, tournaments(name, type)')
      .eq('registration_id', reg.id)
      .single(),
  ])

  let context: CategoryContext | null = null
  if (catRow) {
    const tRaw = catRow.tournaments
    const t = (Array.isArray(tRaw) ? tRaw[0] : tRaw) as { name: string; type: string } | null
    context = {
      categoryName:   catRow.name,
      tournamentName: t?.name ?? '',
      tournamentType: (t?.type ?? 'super') as 'super' | 'doubles',
      price:          catRow.price as number | null,
      paymentMode:    catRow.payment_mode as 'individual' | 'pair' | null,
    }
  }

  return {
    registration: reg as Registration,
    registrants:  (registrants ?? []) as Registrant[],
    context,
  }
}

export default async function PublicRegistrationPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const data = await getData(token)
  if (!data) notFound()

  const { registration, registrants, context } = data
  const confirmed = registrants.filter(r => r.status === 'confirmed')
  const waiting   = registrants.filter(r => r.status === 'waiting')

  return (
    <div className="max-w-md mx-auto space-y-5 animate-fade-in lg:py-4">

      {/* Header card */}
      <div className="relative rounded-2xl p-5 overflow-hidden" style={{ background: 'linear-gradient(135deg, #161616 0%, #0A0A0A 100%)', border: '1px solid #242424' }}>
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full" style={{ background: 'var(--bt-neon-dim)' }} />
        <div className="absolute -right-2 top-8 w-16 h-16 rounded-full" style={{ background: 'var(--bt-neon-dim)' }} />
        <div className="relative space-y-1.5">
          {context ? (
            <>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#888888]">
                {context.tournamentName}
              </p>
              <p className="font-display text-xl font-bold uppercase text-[#F0F0F0] leading-tight">{context.categoryName}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                  registration.is_open
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-[#FF4444]/15 text-[#FF4444]'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    registration.is_open ? 'bg-emerald-400 animate-pulse' : 'bg-[#FF4444]'
                  }`} />
                  {registration.is_open ? 'Inscrições abertas' : 'Inscrições encerradas'}
                </div>
                {context.price && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 text-xs font-bold">
                    💳 R$ {context.price.toFixed(2)}{context.paymentMode === 'pair' ? '/dupla' : '/jogador'}
                  </span>
                )}
                {context.tournamentType === 'doubles' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#C8F135]/10 text-[#C8F135] text-xs font-bold">
                    👥 Duplas
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#888888]">Inscrição</p>
              <p className="font-display text-xl font-bold uppercase text-[#F0F0F0] leading-tight">{registration.name}</p>
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                registration.is_open
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-[#FF4444]/15 text-[#FF4444]'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  registration.is_open ? 'bg-emerald-400 animate-pulse' : 'bg-[#FF4444]'
                }`} />
                {registration.is_open ? 'Inscrições abertas' : 'Inscrições encerradas'}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Spots summary */}
      <div className="bg-[#161616] rounded-2xl shadow-sm border border-[#242424] p-4 space-y-2.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold text-[#888888]">Vagas</span>
          <span className={`font-black text-base ${
            confirmed.length >= registration.player_limit ? 'text-[#FF4444]' : 'text-[#C8F135]'
          }`}>
            {confirmed.length} / {registration.player_limit}
          </span>
        </div>
        <div className="h-2 bg-[#1C1C1C] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              confirmed.length >= registration.player_limit ? 'bg-[#FF4444]' : 'bg-[#C8F135]'
            }`}
            style={{ width: `${Math.min((confirmed.length / registration.player_limit) * 100, 100)}%` }}
          />
        </div>
        {waiting.length > 0 && (
          <p className="text-xs text-amber-400 font-semibold flex items-center gap-1.5">
            <span>⏳</span>
            {waiting.length} na fila de espera
          </p>
        )}
        {confirmed.length < registration.player_limit && registration.is_open && (
          <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
            <span>✅</span>
            {registration.player_limit - confirmed.length} vaga{registration.player_limit - confirmed.length !== 1 ? 's' : ''} disponível{registration.player_limit - confirmed.length !== 1 ? 'is' : ''}
          </p>
        )}
      </div>

      {/* Payment info */}
      {context?.price && registration.is_open && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-1">
          <p className="text-sm font-black text-amber-400 flex items-center gap-2">
            <span>💳</span> Pagamento
          </p>
          <p className="text-xs text-amber-400/90 leading-snug">
            O valor de <strong>R$ {context.price.toFixed(2)}</strong>{' '}
            {context.paymentMode === 'pair' ? 'por dupla' : 'por jogador'} deve ser combinado com o organizador.
            A inscrição é registrada aqui, e o pagamento é confirmado separadamente.
          </p>
        </div>
      )}

      {/* Join form */}
      <JoinForm
        registrationId={registration.id}
        token={token}
        isOpen={registration.is_open}
        isFull={confirmed.length >= registration.player_limit}
        isDoubles={context?.tournamentType === 'doubles'}
      />

      {/* Confirmed list */}
      {confirmed.length > 0 && (
        <div className="bg-[#161616] rounded-2xl shadow-sm border border-[#242424] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#242424] flex items-center justify-between">
            <p className="text-sm font-black text-[#F0F0F0] flex items-center gap-2">
              <span className="text-base">✅</span> Confirmados
            </p>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
              {confirmed.length}
            </span>
          </div>
          <ul className="divide-y divide-[#242424]">
            {confirmed.map((r, i) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-xs font-black text-[#6B6B6B] w-5 text-right shrink-0">{i + 1}</span>
                <div className="w-8 h-8 rounded-full bg-[#C8F135]/10 text-[#C8F135] flex items-center justify-center text-sm font-black shrink-0">
                  {r.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#F0F0F0] truncate">{r.name}</p>
                  {r.partner_name && (
                    <p className="text-xs text-[#888888] truncate">👥 {r.partner_name}</p>
                  )}
                </div>
                {r.payment_status === 'paid' && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full shrink-0">
                    Pago
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Waiting list */}
      {waiting.length > 0 && (
        <div className="bg-[#161616] rounded-2xl shadow-sm border border-amber-500/20 overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-500/20 flex items-center justify-between">
            <p className="text-sm font-black text-[#F0F0F0] flex items-center gap-2">
              <span className="text-base">⏳</span> Fila de espera
            </p>
            <span className="text-xs font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full">
              {waiting.length}
            </span>
          </div>
          <ul className="divide-y divide-[#242424]">
            {waiting.map((r, i) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3 opacity-70">
                <span className="text-xs font-black text-[#6B6B6B] w-5 text-right shrink-0">{i + 1}º</span>
                <div className="w-8 h-8 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center text-sm font-black shrink-0">
                  {r.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#888888] truncate">{r.name}</p>
                  {r.partner_name && (
                    <p className="text-xs text-[#888888] truncate">👥 {r.partner_name}</p>
                  )}
                </div>
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full shrink-0">
                  Espera
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  )
}
