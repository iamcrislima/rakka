'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Registration, Registrant } from '@/types'
import { removeRegistrant, toggleRegistrationOpen } from '@/app/registrations/[token]/actions'

interface Props {
  registration: Registration
  registrants:  Registrant[]
  token:        string
}

export default function ManageHub({ registration, registrants, token }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied]   = useState(false)
  const [toggling, setToggling] = useState(false)

  const confirmed = registrants.filter(r => r.status === 'confirmed')
  const waiting   = registrants.filter(r => r.status === 'waiting')
  const shareLink = typeof window !== 'undefined'
    ? `${window.location.origin}/registrations/${token}`
    : `/registrations/${token}`

  function copyLink() {
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  async function handleToggle() {
    setToggling(true)
    await toggleRegistrationOpen(registration.id, !registration.is_open)
    setToggling(false)
    startTransition(() => router.refresh())
  }

  async function handleRemove(id: string) {
    await removeRegistrant(id)
    startTransition(() => router.refresh())
  }

  // Progress
  const pct = Math.min((confirmed.length / registration.player_limit) * 100, 100)
  const isFull = confirmed.length >= registration.player_limit

  return (
    <div className="max-w-lg mx-auto space-y-5 animate-fade-in lg:py-4">

      {/* Header */}
      <div>
        <p className="text-[11px] font-black text-[#888888] uppercase tracking-widest mb-1">Gerenciar inscrição</p>
        <h1 className="font-display text-2xl font-bold uppercase text-[#F0F0F0] leading-tight">{registration.name}</h1>
      </div>

      {/* Status card */}
      <div className="bg-[#161616] rounded-2xl shadow-sm border border-[#242424] p-4 space-y-4">

        {/* Status row */}
        <div className="flex items-center gap-3">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
            registration.is_open ? 'bg-emerald-400 animate-pulse' : 'bg-[#444444]'
          }`} />
          <span className="font-bold text-sm text-[#F0F0F0] flex-1">
            {registration.is_open ? 'Inscrições abertas' : 'Inscrições encerradas'}
          </span>
          <button
            onClick={handleToggle}
            disabled={toggling || isPending}
            className={`text-xs font-black px-3.5 py-2 rounded-xl transition-all active:scale-[0.96] disabled:opacity-50 ${
              registration.is_open
                ? 'bg-[#FF4444]/10 text-[#FF4444] border border-[#FF4444]/30'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {toggling
              ? '...'
              : registration.is_open ? '🔒 Encerrar' : '🔓 Reabrir'}
          </button>
        </div>

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-[#888888]">Vagas preenchidas</span>
            <span className={isFull ? 'text-[#FF4444]' : 'text-[#C8F135]'}>
              {confirmed.length} / {registration.player_limit}
            </span>
          </div>
          <div className="h-2 bg-[#1C1C1C] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 progress-bar-fill ${
                isFull ? 'bg-[#FF4444]' : 'bg-[#C8F135]'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {isFull && (
            <p className="text-[11px] text-[#FF4444] font-semibold">
              Vagas esgotadas — novos jogadores vão para a fila de espera.
            </p>
          )}
        </div>

        {/* Share link */}
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-[#888888] uppercase tracking-wide">Link para jogadores</p>
          <div className="flex items-center gap-2 bg-[#111111] border border-[#242424] rounded-xl px-3 py-2.5">
            <span className="text-xs text-[#888888] font-mono flex-1 min-w-0 truncate">
              {shareLink}
            </span>
            <button
              onClick={copyLink}
              className={`text-xs font-black px-3 py-1.5 rounded-lg transition-all active:scale-[0.96] shrink-0 ${
                copied
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-[#1C1C1C] text-[#888888] hover:text-[#F0F0F0]'
              }`}
            >
              {copied ? '✓ Copiado' : '📋 Copiar'}
            </button>
          </div>
        </div>
      </div>

      {/* Confirmed list */}
      <div className="bg-[#161616] rounded-2xl shadow-sm border border-[#242424] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#242424] flex items-center justify-between">
          <p className="text-sm font-black text-[#F0F0F0] flex items-center gap-2">
            <span>✅</span> Confirmados
          </p>
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
            {confirmed.length}
          </span>
        </div>

        {confirmed.length === 0 ? (
          <p className="text-sm text-[#888888] text-center py-8">Nenhum inscrito ainda.</p>
        ) : (
          <ul className="divide-y divide-[#242424]">
            {confirmed.map((r, i) => (
              <RegistrantRow
                key={r.id}
                registrant={r}
                position={i + 1}
                onRemove={() => handleRemove(r.id)}
                isPending={isPending}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Waiting list */}
      {waiting.length > 0 && (
        <div className="bg-[#161616] rounded-2xl shadow-sm border border-amber-500/20 overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-500/20 flex items-center justify-between">
            <p className="text-sm font-black text-[#F0F0F0] flex items-center gap-2">
              <span>⏳</span> Fila de espera
            </p>
            <span className="text-xs font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full">
              {waiting.length}
            </span>
          </div>
          <ul className="divide-y divide-[#242424]">
            {waiting.map((r, i) => (
              <RegistrantRow
                key={r.id}
                registrant={r}
                position={i + 1}
                onRemove={() => handleRemove(r.id)}
                isPending={isPending}
                isWaiting
              />
            ))}
          </ul>
        </div>
      )}

      {/* Note about promotion */}
      {waiting.length > 0 && (
        <div className="flex items-start gap-2.5 bg-[#C8F135]/10 border border-[#C8F135]/20 rounded-xl px-4 py-3">
          <span className="text-sm shrink-0 mt-0.5">💡</span>
          <p className="text-xs text-[#C8F135] font-medium leading-snug">
            Ao remover um jogador confirmado, o primeiro da fila de espera é promovido automaticamente.
          </p>
        </div>
      )}

    </div>
  )
}

function RegistrantRow({
  registrant, position, onRemove, isPending, isWaiting = false,
}: {
  registrant: Registrant
  position:   number
  onRemove:   () => void
  isPending:  boolean
  isWaiting?: boolean
}) {
  const [confirming, setConfirming] = useState(false)

  const date = new Date(registrant.joined_at).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })

  return (
    <li className={`flex items-center gap-3 px-4 py-3 ${isWaiting ? 'opacity-75' : ''}`}>
      <span className="text-xs font-black text-[#6B6B6B] w-5 text-right shrink-0">
        {isWaiting ? `${position}º` : position}
      </span>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
        isWaiting ? 'bg-amber-500/15 text-amber-400' : 'bg-[#C8F135]/10 text-[#C8F135]'
      }`}>
        {registrant.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#F0F0F0] truncate">{registrant.name}</p>
        <p className="text-[11px] text-[#888888]">{date}</p>
      </div>

      {/* Remove button */}
      {confirming ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => { onRemove(); setConfirming(false) }}
            disabled={isPending}
            className="text-[11px] font-black text-[#FF4444] bg-[#FF4444]/10 border border-[#FF4444]/30 px-2.5 py-1.5 rounded-lg active:scale-[0.96] transition-all"
          >
            Remover
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-[11px] font-bold text-[#888888] px-2 py-1.5"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="text-[#6B6B6B] hover:text-[#FF4444] transition-colors text-lg leading-none shrink-0 px-1"
          aria-label={`Remover ${registrant.name}`}
        >
          ×
        </button>
      )}
    </li>
  )
}
