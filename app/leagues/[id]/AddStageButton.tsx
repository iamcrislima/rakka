'use client'

import { useState, useTransition } from 'react'
import { addStageAction } from './actions'
import type { Tournament } from '@/types'

interface Props {
  leagueId:              string
  availableTournaments:  Tournament[]
}

const STATUS_LABEL: Record<string, string> = {
  draft:       'Rascunho',
  group_stage: 'Em andamento',
  finals:      'Finais',
  done:        'Encerrado',
}

const STATUS_COLOR: Record<string, string> = {
  draft:       'text-[#888888]',
  group_stage: 'text-[#C8F135]',
  finals:      'text-amber-500',
  done:        'text-emerald-400',
}

export default function AddStageButton({ leagueId, availableTournaments }: Props) {
  const [open, setOpen]           = useState(false)
  const [selected, setSelected]   = useState<string>('')
  const [error, setError]         = useState('')
  const [isPending, startTransition] = useTransition()

  function handleAdd() {
    if (!selected) return
    setError('')
    startTransition(async () => {
      const result = await addStageAction(leagueId, selected)
      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
        setSelected('')
      }
    })
  }

  if (availableTournaments.length === 0) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm font-bold text-[#C8F135] bg-[#1C1C1C] px-4 py-2.5 rounded-xl hover:bg-violet-100 transition-colors"
      >
        <span className="text-base leading-none">+</span>
        Adicionar etapa
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-[#161616] rounded-2xl shadow-2xl overflow-hidden animate-scale-in">

            <div className="px-5 py-4 border-b border-[#242424]">
              <p className="font-black text-[#F0F0F0]">Adicionar etapa</p>
              <p className="text-xs text-[#888888] mt-0.5">Selecione o torneio para incluir na liga</p>
            </div>

            <div className="px-4 py-3 space-y-1.5 max-h-60 overflow-y-auto">
              {availableTournaments.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelected(t.id)}
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-left transition-colors ${
                    selected === t.id
                      ? 'bg-[#1C1C1C] border-2 border-violet-300'
                      : 'bg-[#111111] border-2 border-transparent hover:border-[#242424]'
                  }`}
                >
                  <div>
                    <p className="text-sm font-bold text-[#F0F0F0]">{t.name}</p>
                    <p className="text-[11px] text-[#888888]">
                      {new Date(t.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span className={`text-xs font-bold ${STATUS_COLOR[t.status] ?? 'text-[#888888]'}`}>
                    {STATUS_LABEL[t.status] ?? t.status}
                  </span>
                </button>
              ))}
            </div>

            {error && <p className="text-xs text-[#FF4444] font-semibold px-5 pb-1">{error}</p>}

            <div className="flex gap-2 px-4 py-4 border-t border-[#242424]">
              <button
                onClick={() => { setOpen(false); setSelected(''); setError('') }}
                className="flex-1 py-2.5 rounded-xl border-2 border-[#242424] text-sm font-bold text-[#888888]"
              >
                Cancelar
              </button>
              <button
                onClick={handleAdd}
                disabled={!selected || isPending}
                className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-black disabled:opacity-40"
              >
                {isPending ? 'Adicionando...' : 'Adicionar'}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
