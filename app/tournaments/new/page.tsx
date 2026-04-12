'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const EMPTY = Array.from({ length: 8 }, () => '')

const GROUP_COLORS = [
  'border-sky-300 bg-sky-50',
  'border-sky-300 bg-sky-50',
  'border-sky-300 bg-sky-50',
  'border-sky-300 bg-sky-50',
  'border-violet-300 bg-violet-50',
  'border-violet-300 bg-violet-50',
  'border-violet-300 bg-violet-50',
  'border-violet-300 bg-violet-50',
]

const AVATAR_COLORS = [
  'bg-sky-500', 'bg-sky-500', 'bg-sky-500', 'bg-sky-500',
  'bg-violet-500', 'bg-violet-500', 'bg-violet-500', 'bg-violet-500',
]

export default function NewTournamentPage() {
  const router = useRouter()
  const [name, setName]       = useState('')
  const [players, setPlayers] = useState<string[]>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const setPlayer = (i: number, val: string) =>
    setPlayers(prev => prev.map((p, idx) => idx === i ? val : p))

  const filled  = players.filter(p => p.trim().length > 0).length
  const valid   = name.trim().length > 0 && filled === 8

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setLoading(true)
    setError('')
    try {
      const { data: t, error: tErr } = await supabase
        .from('tournaments')
        .insert({ name: name.trim(), status: 'draft' })
        .select()
        .single()
      if (tErr) throw tErr

      const { error: pErr } = await supabase
        .from('players')
        .insert(players.map((n, i) => ({ tournament_id: t.id, name: n.trim(), position: i + 1 })))
      if (pErr) throw pErr

      router.push(`/tournaments/${t.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar torneio.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Title */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Novo torneio</p>
        <h1 className="text-2xl font-black text-slate-800">Configurar torneio</h1>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-600">Nome do torneio</label>
        <input
          className="w-full bg-white border-2 border-slate-200 focus:border-sky-400 rounded-xl px-4 py-3.5 text-base font-semibold focus:outline-none transition-colors"
          placeholder="Ex: Copa de Verão 2026"
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />
      </div>

      {/* Players */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-slate-600">Jogadores</label>
          <span className="text-xs font-bold text-slate-400">{filled}/8 preenchidos</span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-sky-500 rounded-full transition-all duration-300"
            style={{ width: `${(filled / 8) * 100}%` }}
          />
        </div>

        {/* Group A */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-sky-500 text-white text-[10px] font-black flex items-center justify-center">A</span>
            <span className="text-xs font-bold text-sky-600">Grupo A</span>
          </div>
          {[0,1,2,3].map(i => (
            <div key={i} className={`flex items-center gap-3 border-2 rounded-xl px-3 py-2.5 ${GROUP_COLORS[i]}`}>
              <div className={`w-8 h-8 rounded-full ${AVATAR_COLORS[i]} text-white text-xs font-black flex items-center justify-center shrink-0`}>
                {players[i] ? players[i][0].toUpperCase() : i + 1}
              </div>
              <input
                className="flex-1 bg-transparent text-sm font-semibold text-slate-700 placeholder:text-slate-300 focus:outline-none"
                placeholder={`Jogador ${i + 1}`}
                value={players[i]}
                onChange={e => setPlayer(i, e.target.value)}
                required
              />
            </div>
          ))}
        </div>

        {/* Group B */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-violet-500 text-white text-[10px] font-black flex items-center justify-center">B</span>
            <span className="text-xs font-bold text-violet-600">Grupo B</span>
          </div>
          {[4,5,6,7].map(i => (
            <div key={i} className={`flex items-center gap-3 border-2 rounded-xl px-3 py-2.5 ${GROUP_COLORS[i]}`}>
              <div className={`w-8 h-8 rounded-full ${AVATAR_COLORS[i]} text-white text-xs font-black flex items-center justify-center shrink-0`}>
                {players[i] ? players[i][0].toUpperCase() : i + 1}
              </div>
              <input
                className="flex-1 bg-transparent text-sm font-semibold text-slate-700 placeholder:text-slate-300 focus:outline-none"
                placeholder={`Jogador ${i + 1}`}
                value={players[i]}
                onChange={e => setPlayer(i, e.target.value)}
                required
              />
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm font-medium px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!valid || loading}
        className="w-full bg-gradient-to-r from-[#0F2044] to-[#1D4ED8] text-white font-black text-base py-4 rounded-2xl disabled:opacity-40 active:scale-[0.98] transition-transform shadow-lg shadow-blue-200"
      >
        {loading ? 'Criando torneio...' : '🚀 Criar torneio'}
      </button>
    </form>
  )
}
