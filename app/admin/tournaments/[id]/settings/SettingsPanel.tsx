'use client'

/**
 * Tournament-wide settings — reachable at any time, regardless of category
 * status. Unlike the per-category "Horário de início" editor embedded in
 * CategoryHub/Super8MistoHub (which disappears once a category leaves
 * draft), this screen stays available after the tournament has started —
 * an organizer adjusting category B's start time while category A is
 * already mid-play needs this to keep working.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/client'
import type { Tournament, Category, Court } from '@/types'
import BackLink from '@/app/components/BackLink'

interface Props {
  tournament: Pick<Tournament, 'id' | 'name'>
  categories: Category[]
  courts:     Court[]
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho', group_stage: 'Em andamento', finals: 'Finais', done: 'Encerrado',
}

export default function SettingsPanel({ tournament, categories, courts }: Props) {
  return (
    <div className="max-w-[1400px] mx-auto space-y-6 animate-fade-in lg:py-4">

      {/* Header */}
      <div className="relative rounded-2xl p-5 overflow-hidden" style={{ background: 'linear-gradient(135deg, #161616 0%, #0A0A0A 100%)', border: '1px solid #242424' }}>
        <BackLink href={`/admin/tournaments/${tournament.id}`} label={tournament.name} className="text-[10px] font-black uppercase tracking-widest text-[#888888] hover:text-[#F0F0F0] mb-2" />
        <p className="font-display text-2xl font-bold uppercase leading-tight text-[#F0F0F0]">Configurações</p>
        <p className="text-xs text-[#888888] font-semibold mt-1">Horários e quadras — editáveis a qualquer momento, mesmo com o torneio em andamento</p>
      </div>

      {/* Courts */}
      <Link
        href={`/admin/tournaments/${tournament.id}/tv-admin`}
        className="flex items-center justify-between px-5 py-4 bg-[#161616] border border-[#242424] rounded-2xl hover:border-[#3a3a3a] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏟️</span>
          <div>
            <p className="text-sm font-bold text-[#F0F0F0]">
              {courts.length} quadra{courts.length !== 1 ? 's' : ''} cadastrada{courts.length !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-[#888888]">Adicionar, remover ou distribuir partidas entre quadras</p>
          </div>
        </div>
        <span className="text-[10px] font-black text-[#C8F135] uppercase tracking-wider shrink-0">Gerenciar →</span>
      </Link>

      {/* Self-service result entry — one QR for the whole tournament */}
      <QRLinkCard
        icon="📱"
        title="Autoatendimento de resultado"
        description="Um QR único para o torneio inteiro — deixe num tablet perto das quadras. Quem escaneia vê as partidas acontecendo agora e lança o resultado direto."
        path={`/t/${tournament.id}/lancar-resultado`}
      />

      {/* Event photo mural — QR for uploads + link to the moderation queue */}
      <QRLinkCard
        icon="📸"
        title="Mural do evento"
        description="QR para os participantes enviarem fotos. Toda foto passa por moderação antes de aparecer no Modo TV."
        path={`/t/${tournament.id}/mural`}
      >
        <Link
          href={`/admin/tournaments/${tournament.id}/mural/moderar`}
          className="inline-flex items-center gap-1.5 text-[10px] font-black text-[#C8F135] uppercase tracking-wider mt-2"
        >
          🖼️ Moderar fotos enviadas →
        </Link>
      </QRLinkCard>

      {/* Category schedules */}
      <section className="space-y-2.5">
        <p className="text-[11px] font-black uppercase tracking-widest text-[#888888] px-0.5">Horário das categorias</p>
        <div className="space-y-2.5">
          {categories.map(cat => <CategoryScheduleRow key={cat.id} category={cat} />)}
          {categories.length === 0 && (
            <p className="text-xs text-[#6B6B6B] px-1">Nenhuma categoria ainda.</p>
          )}
        </div>
      </section>

    </div>
  )
}

// ── Generic QR link card — one QR + copyable link for a given path ──

function QRLinkCard({ icon, title, description, path, children }: {
  icon: string; title: string; description: string; path: string; children?: React.ReactNode
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [copied, setCopied]   = useState(false)
  const [url, setUrl]         = useState('')

  useEffect(() => {
    const link = `${window.location.origin}${path}`
    setUrl(link)
    let cancelled = false
    QRCode.toDataURL(link, { width: 160, margin: 1, color: { dark: '#0A0A0A', light: '#FFFFFF' } })
      .then(d => { if (!cancelled) setDataUrl(d) })
      .catch(() => { if (!cancelled) setDataUrl(null) })
    return () => { cancelled = true }
  }, [path])

  function copyLink() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="bg-[#161616] border border-[#242424] rounded-2xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#242424] flex items-center gap-2">
        <span className="text-sm">{icon}</span>
        <p className="text-xs font-black text-[#888888] uppercase tracking-widest">{title}</p>
      </div>
      <div className="px-5 py-4 flex items-center gap-4">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="QR code" width={100} height={100} className="rounded-xl bg-white p-2 shrink-0" />
        ) : (
          <div className="w-[100px] h-[100px] rounded-xl bg-white/5 animate-pulse shrink-0" />
        )}
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-xs font-bold text-[#888888] leading-snug">{description}</p>
          {url && (
            <div className="flex items-center gap-2 bg-[#111111] border border-[#242424] rounded-lg px-2.5 py-1.5">
              <span className="text-[10px] text-[#6B6B6B] font-mono flex-1 min-w-0 truncate">{url}</span>
              <button
                onClick={copyLink}
                className={`text-[10px] font-black px-2 py-1 rounded shrink-0 transition-colors ${
                  copied ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[#1C1C1C] text-[#888888] hover:text-[#F0F0F0]'
                }`}
              >
                {copied ? '✓ Copiado' : '📋 Copiar'}
              </button>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}

function CategoryScheduleRow({ category }: { category: Category }) {
  const router   = useRouter()
  const supabase = createClient()

  function toLocalInput(iso: string | null): string {
    if (!iso) return ''
    const d = new Date(iso)
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }

  const [editing, setEditing] = useState(false)
  const [value,   setValue]   = useState(() => toLocalInput(category.scheduled_at))
  const [saving,  setSaving]  = useState(false)

  async function save() {
    setSaving(true)
    await supabase
      .from('categories')
      .update({ scheduled_at: value ? new Date(value).toISOString() : null })
      .eq('id', category.id)
    setSaving(false)
    setEditing(false)
    router.refresh()
  }

  return (
    <div className="bg-[#161616] border border-[#242424] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#F0F0F0] truncate">{category.name}</p>
          <p className="text-[11px] font-bold text-[#888888] mt-0.5">{STATUS_LABEL[category.status] ?? category.status}</p>
        </div>
        <button
          onClick={() => setEditing(e => !e)}
          className="text-[10px] font-black text-[#C8F135] uppercase tracking-wider transition-colors shrink-0"
        >
          {editing ? 'Cancelar' : 'Editar'}
        </button>
      </div>

      {!editing && (
        <p className="px-5 pb-3.5 text-sm font-bold text-[#F0F0F0]">
          {category.scheduled_at
            ? new Date(category.scheduled_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
            : <span className="text-[#6B6B6B] font-medium">Sem horário definido — inicia imediatamente</span>}
        </p>
      )}

      {editing && (
        <div className="px-5 pb-4 pt-1 space-y-2 animate-fade-in border-t border-[#242424]">
          <input
            type="datetime-local"
            value={value}
            onChange={e => setValue(e.target.value)}
            className="w-full mt-3 bg-[#111111] border-2 border-[#242424] focus:border-[#C8F135] rounded-lg px-3 py-2 text-sm font-semibold text-[#F0F0F0] focus:outline-none transition-colors"
          />
          <div className="flex gap-2">
            {value && (
              <button
                onClick={() => { setValue(''); save() }}
                className="flex-1 py-1.5 text-xs font-bold text-[#888888] border border-[#242424] rounded-lg hover:bg-[#111111] transition-colors"
              >
                Remover
              </button>
            )}
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 py-1.5 text-xs font-black text-[#0A0A0A] bg-[#C8F135] hover:bg-[#D4F54A] rounded-lg disabled:opacity-50 transition-colors"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
