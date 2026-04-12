'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { assignGroups } from '@/lib/group-assignment'

const EMPTY = Array.from({ length: 8 }, () => '')

export default function NewTournamentPage() {
  const router = useRouter()
  const [name, setName]       = useState('')
  const [players, setPlayers] = useState<string[]>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const setPlayer = (i: number, val: string) =>
    setPlayers(prev => prev.map((p, idx) => idx === i ? val : p))

  const filled = players.filter(p => p.trim().length > 0).length
  const valid  = name.trim().length > 0 && filled === 8

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

      // Randomly assign groups
      const assignments = assignGroups(players)

      const { error: pErr } = await supabase
        .from('players')
        .insert(assignments.map(a => ({ tournament_id: t.id, name: a.name, position: a.position })))
      if (pErr) throw pErr

      router.push(`/tournaments/${t.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar torneio.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Novo torneio</p>
        <h1 className="text-2xl font-black text-slate-800">Adicionar jogadores</h1>
        <p className="text-sm text-slate-400 mt-1">Os grupos serão sorteados automaticamente.</p>
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
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full transition-colors ${filled === 8 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
            {filled}/8
          </span>
        </div>

        {/* Progress */}
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${filled === 8 ? 'bg-emerald-500' : 'bg-sky-500'}`}
            style={{ width: `${(filled / 8) * 100}%` }}
          />
        </div>

        {/* Flat list — no groups shown during creation */}
        <div className="space-y-2">
          {EMPTY.map((_, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 border-2 rounded-xl px-3 py-2.5 transition-colors ${
                players[i].trim() ? 'border-sky-200 bg-sky-50/50' : 'border-slate-100 bg-white'
              }`}
            >
              <div className={`w-8 h-8 rounded-full text-white text-xs font-black flex items-center justify-center shrink-0 transition-colors ${
                players[i].trim() ? 'bg-sky-500' : 'bg-slate-200'
              }`}>
                {players[i].trim() ? players[i][0].toUpperCase() : <span className="text-slate-400">{i + 1}</span>}
              </div>
              <input
                className="flex-1 bg-transparent text-sm font-semibold text-slate-700 placeholder:text-slate-300 focus:outline-none"
                placeholder={`Jogador ${i + 1}`}
                value={players[i]}
                onChange={e => setPlayer(i, e.target.value)}
                required
              />
              {players[i].trim() && (
                <button
                  type="button"
                  onClick={() => setPlayer(i, '')}
                  className="text-slate-300 text-lg leading-none active:text-slate-500"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Groups teaser */}
        {filled === 8 && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <span className="text-lg">🎲</span>
            <p className="text-sm font-semibold text-emerald-700">
              Grupos serão sorteados ao criar o torneio
            </p>
          </div>
        )}
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
        {loading ? 'Sorteando grupos...' : '🎲 Criar e sortear grupos'}
      </button>
    </form>
  )
}
