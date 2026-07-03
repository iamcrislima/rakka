'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { joinRegistration } from './actions'

interface Props {
  registrationId: string
  token:          string
  isOpen:         boolean
  isFull:         boolean
  isDoubles?:     boolean
}

type Result =
  | { status: 'confirmed'; position: number }
  | { status: 'waiting';   position: number }

export default function JoinForm({ registrationId, token, isOpen, isFull, isDoubles }: Props) {
  const router  = useRouter()
  const [name,        setName]        = useState('')
  const [partnerName, setPartnerName] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [result,      setResult]      = useState<Result | null>(null)

  if (!isOpen) {
    return (
      <div className="bg-[#161616] border border-[#242424] rounded-2xl px-5 py-6 text-center space-y-2">
        <p className="text-2xl">🔒</p>
        <p className="font-bold text-[#F0F0F0]">Inscrições encerradas</p>
        <p className="text-sm text-[#888888]">O organizador fechou as inscrições para este evento.</p>
      </div>
    )
  }

  if (result) {
    const isConfirmed = result.status === 'confirmed'
    return (
      <div className={`rounded-2xl border p-5 space-y-3 animate-scale-in text-center ${
        isConfirmed
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : 'bg-amber-500/10 border-amber-500/30'
      }`}>
        <p className="text-3xl">{isConfirmed ? '🎉' : '⏳'}</p>
        <div>
          <p className={`text-base font-black ${isConfirmed ? 'text-emerald-400' : 'text-amber-400'}`}>
            {isConfirmed ? 'Inscrição confirmada!' : 'Você está na fila!'}
          </p>
          <p className={`text-sm mt-1 ${isConfirmed ? 'text-emerald-400/90' : 'text-amber-400/90'}`}>
            {isDoubles
              ? isConfirmed
                ? `${name} + ${partnerName || '?'} — dupla #${result.position} confirmada.`
                : `${name} + ${partnerName || '?'} — ${result.position}º na lista de espera.`
              : isConfirmed
                ? `${name} — vaga #${result.position} confirmada.`
                : `${name} — ${result.position}º na lista de espera.`
            }
          </p>
          {!isConfirmed && (
            <p className="text-xs text-amber-400/80 mt-1.5">
              Você será promovido automaticamente se uma vaga abrir.
            </p>
          )}
        </div>
        <button
          onClick={() => { setResult(null); setName(''); setPartnerName(''); router.refresh() }}
          className="text-xs font-bold text-[#888888] underline underline-offset-2"
        >
          Inscrever {isDoubles ? 'outra dupla' : 'outro jogador'}
        </button>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return
    if (isDoubles && !partnerName.trim()) return

    setLoading(true)
    setError('')

    const res = await joinRegistration(
      registrationId,
      trimmedName,
      isDoubles ? partnerName.trim() : undefined,
    )

    if ('error' in res) {
      setError(res.error)
      setLoading(false)
      return
    }

    setResult(res)
    setLoading(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#161616] rounded-2xl shadow-sm border border-[#242424] p-5 space-y-4">
      <div>
        <p className="text-sm font-black text-[#F0F0F0]">
          {isFull ? '⏳ Entrar na fila de espera' : isDoubles ? '✍️ Inscrever dupla' : '✍️ Confirmar inscrição'}
        </p>
        {isFull && (
          <p className="text-xs text-amber-400 mt-1">
            As vagas estão esgotadas. Você entrará na lista de espera.
          </p>
        )}
      </div>

      {/* Player name */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-[#888888] uppercase tracking-wide">
          {isDoubles ? 'Seu nome' : 'Seu nome completo'}
        </label>
        <input
          className={`w-full border-2 rounded-xl px-4 py-3 text-sm font-semibold text-[#F0F0F0] focus:outline-none transition-colors ${
            error
              ? 'border-[#FF4444]/50 bg-[#FF4444]/5 focus:border-[#FF4444]'
              : 'border-[#242424] bg-[#111111] focus:border-[#C8F135]'
          }`}
          placeholder={isDoubles ? 'Seu nome' : 'Digite seu nome'}
          value={name}
          onChange={e => { setName(e.target.value); setError('') }}
          autoComplete="name"
          required
        />
      </div>

      {/* Partner name (doubles only) */}
      {isDoubles && (
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#888888] uppercase tracking-wide">
            Nome do parceiro/a
          </label>
          <input
            className="w-full border-2 border-[#242424] bg-[#111111] focus:border-[#C8F135] rounded-xl px-4 py-3 text-sm font-semibold text-[#F0F0F0] focus:outline-none transition-colors"
            placeholder="Nome do parceiro/a"
            value={partnerName}
            onChange={e => setPartnerName(e.target.value)}
            required
          />
        </div>
      )}

      {error && <p className="text-xs text-[#FF4444] font-semibold">{error}</p>}

      <button
        type="submit"
        disabled={loading || !name.trim() || (isDoubles ? !partnerName.trim() : false)}
        className={`w-full font-black text-sm py-3.5 rounded-xl transition-all active:scale-[0.97] disabled:opacity-40 ${
          isFull
            ? 'bg-amber-500 text-[#0A0A0A]'
            : 'bg-[#C8F135] hover:bg-[#D4F54A] text-[#0A0A0A]'
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-[#0A0A0A]/30 border-t-[#0A0A0A] rounded-full animate-spin inline-block" />
            Inscrevendo...
          </span>
        ) : isFull ? (
          'Entrar na fila de espera'
        ) : isDoubles ? (
          'Inscrever dupla'
        ) : (
          'Confirmar inscrição'
        )}
      </button>
    </form>
  )
}
