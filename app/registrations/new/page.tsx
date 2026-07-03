'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export default function NewRegistrationPage() {
  const router  = useRouter()
  const [name,  setName]    = useState('')
  const [limit, setLimit]   = useState(8)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const valid = name.trim().length > 0 && limit >= 2

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { data, error: err } = await supabase
        .from('registrations')
        .insert({
          name:         name.trim(),
          player_limit: limit,
          is_open:      true,
          user_id:      user?.id ?? null,
        })
        .select('share_token')
        .single()

      if (err) throw err
      router.push(`/registrations/${data.share_token}/manage`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg || 'Erro ao criar inscrição.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7 animate-fade-in max-w-lg mx-auto lg:py-4">

      {/* Header */}
      <div>
        <p className="text-[11px] font-black text-[#888888] uppercase tracking-widest mb-1">Nova inscrição</p>
        <h1 className="font-display text-2xl font-bold uppercase text-[#F0F0F0]">Abrir inscrições</h1>
        <p className="text-sm text-[#888888] mt-1">
          Gere um link para jogadores se inscreverem. Você controla o limite e a lista.
        </p>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <label className="text-sm font-bold text-[#F0F0F0]">Nome do evento</label>
        <input
          className="w-full bg-[#111111] border-2 border-[#242424] focus:border-[#C8F135] rounded-xl px-4 py-3.5 text-base font-semibold text-[#F0F0F0] focus:outline-none transition-colors"
          placeholder="Ex: Copa de Verão 2026"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
          required
        />
      </div>

      {/* Limit */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-[#F0F0F0]">Limite de jogadores</label>
          <span className="text-xs font-bold text-[#C8F135] bg-[#C8F135]/10 px-2.5 py-1 rounded-full">
            {limit} vagas
          </span>
        </div>

        {/* Quick presets */}
        <div className="grid grid-cols-5 gap-2">
          {[4, 8, 16, 24, 32].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setLimit(n)}
              className={`py-2.5 rounded-xl border-2 text-sm font-black transition-all active:scale-[0.96] ${
                limit === n
                  ? 'border-[#C8F135] bg-[#1C1C1C] text-[#C8F135]'
                  : 'border-[#242424] bg-[#111111] text-[#888888]'
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Custom input */}
        <div className="flex items-center gap-3 bg-[#111111] border-2 border-[#242424] rounded-xl px-4 py-3">
          <span className="text-sm text-[#888888] font-semibold shrink-0">Ou personalize:</span>
          <input
            type="number"
            min={2}
            max={512}
            value={limit}
            onChange={e => setLimit(Math.max(2, Number(e.target.value)))}
            className="flex-1 text-sm font-bold text-[#F0F0F0] focus:outline-none bg-transparent rounded"
          />
          <span className="text-xs text-[#888888] shrink-0">jogadores</span>
        </div>

        {/* Waiting list note */}
        <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
          <span className="text-base shrink-0 mt-0.5">⏳</span>
          <p className="text-xs text-amber-400 font-medium leading-snug">
            Jogadores que ultrapassarem o limite entram automaticamente na lista de espera.
            Se alguém cancelar, o primeiro da fila é promovido.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-[#FF4444]/10 border border-[#FF4444]/30 text-[#FF4444] text-sm font-medium px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!valid || loading}
        className="w-full bg-[#C8F135] hover:bg-[#D4F54A] text-[#0A0A0A] font-black text-base py-4 rounded-2xl disabled:opacity-40 active:scale-[0.97] transition-all"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-[#0A0A0A]/30 border-t-[#0A0A0A] rounded-full animate-spin inline-block" />
            Criando...
          </span>
        ) : (
          '🔗 Criar e gerar link'
        )}
      </button>
    </form>
  )
}
