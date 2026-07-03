'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { MuralPhoto } from '@/types'

interface PhotoWithUrl extends MuralPhoto { url: string }

export default function MuralModeration({ tournamentId, tournamentName, photos: initial }: {
  tournamentId:   string
  tournamentName: string
  photos:         PhotoWithUrl[]
}) {
  const router = useRouter()
  const [photos, setPhotos] = useState(initial)
  const [busyId, setBusyId] = useState<string | null>(null)

  const pending  = photos.filter(p => p.status === 'pending')
  const decided  = photos.filter(p => p.status !== 'pending')

  async function moderate(id: string, status: 'approved' | 'rejected') {
    setBusyId(id)
    const supabase = createClient()
    await supabase
      .from('mural_photos')
      .update({ status, moderated_at: new Date().toISOString() })
      .eq('id', id)
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, status } : p))
    setBusyId(null)
    router.refresh()
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in lg:py-4">

      <div>
        <Link href={`/admin/tournaments/${tournamentId}`} className="text-xs font-bold text-[#C8F135]">
          ← {tournamentName}
        </Link>
        <h1 className="font-display text-2xl font-bold uppercase text-[#F0F0F0] mt-1">Moderação do Mural</h1>
        <p className="text-sm text-[#888888] mt-1">Só fotos aprovadas aqui entram na rotação do Modo TV.</p>
      </div>

      <section className="space-y-3">
        <p className="text-xs font-black text-[#888888] uppercase tracking-widest">
          Pendentes ({pending.length})
        </p>
        {pending.length === 0 ? (
          <p className="text-sm text-[#6B6B6B] bg-[#161616] border border-[#242424] rounded-2xl px-5 py-8 text-center">
            Nenhuma foto pendente.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pending.map(p => (
              <div key={p.id} className="bg-[#161616] border border-[#242424] rounded-2xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="Foto enviada" className="w-full h-64 object-cover" />
                <div className="p-3 flex gap-2">
                  <button
                    onClick={() => moderate(p.id, 'approved')}
                    disabled={busyId === p.id}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-black disabled:opacity-50 active:scale-[0.97] transition-all"
                  >
                    ✓ Aprovar
                  </button>
                  <button
                    onClick={() => moderate(p.id, 'rejected')}
                    disabled={busyId === p.id}
                    className="flex-1 py-2.5 rounded-xl bg-[#FF4444]/10 text-[#FF4444] text-sm font-black disabled:opacity-50 active:scale-[0.97] transition-all"
                  >
                    ✕ Rejeitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {decided.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-black text-[#888888] uppercase tracking-widest">Já moderadas</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {decided.map(p => (
              <div key={p.id} className="relative rounded-xl overflow-hidden border border-[#242424]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt="Foto moderada"
                  className={`w-full h-24 object-cover ${p.status === 'rejected' ? 'opacity-30 grayscale' : ''}`}
                />
                <span className={`absolute top-1 right-1 text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                  p.status === 'approved' ? 'bg-emerald-500/80 text-[#0A0A0A]' : 'bg-[#FF4444]/80 text-white'
                }`}>
                  {p.status === 'approved' ? '✓' : '✕'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
