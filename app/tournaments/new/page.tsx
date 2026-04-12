'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const EMPTY_PLAYERS = Array.from({ length: 8 }, () => '')

export default function NewTournamentPage() {
  const router = useRouter()
  const [name, setName]       = useState('')
  const [players, setPlayers] = useState<string[]>(EMPTY_PLAYERS)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const setPlayer = (i: number, val: string) =>
    setPlayers(prev => prev.map((p, idx) => idx === i ? val : p))

  const valid = name.trim() && players.every(p => p.trim().length > 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setLoading(true)
    setError('')

    try {
      // 1. Create tournament
      const { data: t, error: tErr } = await supabase
        .from('tournaments')
        .insert({ name: name.trim(), status: 'draft' })
        .select()
        .single()
      if (tErr) throw tErr

      // 2. Insert players (position 1-8)
      const { error: pErr } = await supabase
        .from('players')
        .insert(
          players.map((n, i) => ({
            tournament_id: t.id,
            name: n.trim(),
            position: i + 1,
          }))
        )
      if (pErr) throw pErr

      router.push(`/tournaments/${t.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar torneio.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h1 className="text-xl font-bold text-gray-800">Novo Torneio</h1>

      {/* Tournament name */}
      <div className="space-y-1">
        <label className="text-sm font-semibold text-gray-600">Nome do torneio</label>
        <input
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
          placeholder="Ex: Copa de Verão 2026"
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />
      </div>

      {/* Players */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-600">Jogadores (8)</p>
        <div className="grid grid-cols-2 gap-2">
          {players.map((p, i) => (
            <div key={i} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
              <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
              <input
                className="flex-1 text-sm focus:outline-none"
                placeholder={`Jogador ${i + 1}`}
                value={p}
                onChange={e => setPlayer(i, e.target.value)}
                required
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400">
          Grupo A: jogadores 1–4 &nbsp;|&nbsp; Grupo B: jogadores 5–8
        </p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={!valid || loading}
        className="w-full bg-sky-600 text-white font-bold py-3 rounded-xl disabled:opacity-40 active:bg-sky-700"
      >
        {loading ? 'Criando...' : 'Criar torneio'}
      </button>
    </form>
  )
}
