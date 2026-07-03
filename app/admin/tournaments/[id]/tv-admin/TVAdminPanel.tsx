'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { autoAssignCourts, clearCourtAssignments } from './actions'
import type { TVContent, TVContentType, Court, Match } from '@/types'

interface Props {
  tournamentId: string
  items:        TVContent[]
  courts:       Court[]
}

const TYPES: { value: TVContentType; label: string; icon: string; desc: string }[] = [
  { value: 'image',        label: 'Patrocinador',  icon: '🖼️', desc: 'Logo ou banner de patrocinador' },
  { value: 'promotion',    label: 'Promoção',      icon: '🏷️', desc: 'Texto + imagem de oferta'       },
  { value: 'announcement', label: 'Aviso',         icon: '📣', desc: 'Comunicado ou informação'        },
]

const TYPE_COLOR: Record<TVContentType, string> = {
  image:        'bg-sky-500/15 text-sky-400 border-sky-500/30',
  promotion:    'bg-amber-500/15 text-amber-400 border-amber-500/30',
  announcement: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
}

// ── Courts section ────────────────────────────────────────────

function CourtsSection({ tournamentId, courts: initial }: { tournamentId: string; courts: Court[] }) {
  const supabase            = createClient()
  const [courts, setCourts]  = useState<Court[]>(initial)
  const [name, setName]     = useState('')
  const [adding, setAdding]  = useState(false)
  const [error, setError]   = useState('')

  // Auto-assign state
  const [autoOpen, setAutoOpen]         = useState(false)
  const [sameGroup, setSameGroup]       = useState(false)
  const [assigning, setAssigning]       = useState(false)
  const [assignResult, setAssignResult] = useState<{ assigned: number; skipped: number } | null>(null)
  const [assignError, setAssignError]   = useState('')
  const [clearing, setClearing]         = useState(false)

  async function addCourt() {
    const trimmed = name.trim()
    if (!trimmed) return
    setAdding(true)
    setError('')
    const nextOrder = courts.length > 0 ? Math.max(...courts.map(c => c.sort_order)) + 1 : 0
    const { data, error: err } = await supabase
      .from('courts')
      .insert({ tournament_id: tournamentId, name: trimmed, sort_order: nextOrder })
      .select()
      .single()
    if (err) { setError(err.message); setAdding(false); return }
    setCourts(prev => [...prev, data as Court])
    setName('')
    setAdding(false)
  }

  async function deleteCourt(id: string) {
    if (!confirm('Remover esta quadra? Partidas associadas perderão a atribuição.')) return
    await supabase.from('courts').delete().eq('id', id)
    setCourts(prev => prev.filter(c => c.id !== id))
  }

  async function handleAutoAssign() {
    setAssigning(true)
    setAssignResult(null)
    setAssignError('')
    const res = await autoAssignCourts(tournamentId, { sameGroupSameCourt: sameGroup })
    if (res.error) {
      setAssignError(res.error)
    } else {
      setAssignResult({ assigned: res.assigned, skipped: res.skipped })
    }
    setAssigning(false)
  }

  async function handleClear() {
    if (!confirm('Limpar todas as atribuições de quadra nas partidas pendentes?')) return
    setClearing(true)
    const res = await clearCourtAssignments(tournamentId)
    if (res.error) setAssignError(res.error)
    else { setAssignResult(null); setAssignError('') }
    setClearing(false)
  }

  return (
    <div className="bg-[#161616] rounded-2xl border border-[#242424] shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 bg-[#111111] border-b border-[#242424] flex items-center gap-2">
        <span className="text-sm">🏟️</span>
        <p className="text-xs font-black text-[#888888] uppercase tracking-widest">Quadras</p>
        <span className="ml-auto text-[10px] font-bold text-[#6B6B6B]">{courts.length} cadastrada{courts.length !== 1 ? 's' : ''}</span>
      </div>

      {/* List */}
      {courts.length > 0 && (
        <div className="divide-y divide-[#242424]">
          {[...courts].sort((a, b) => a.sort_order - b.sort_order).map(c => (
            <div key={c.id} className="flex items-center gap-3 px-5 py-3">
              <span className="text-base leading-none shrink-0">🏟️</span>
              <p className="flex-1 text-sm font-bold text-[#F0F0F0]">{c.name}</p>
              <button
                onClick={() => deleteCourt(c.id)}
                className="text-[#6B6B6B] hover:text-[#FF4444] transition-colors text-xs font-black px-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add row */}
      <div className="px-4 py-3 border-t border-[#242424] flex gap-2">
        <input
          type="text"
          placeholder="Nome da quadra (ex: Quadra Fiat)"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addCourt()}
          className="flex-1 bg-[#111111] border-2 border-[#242424] focus:border-[#C8F135] rounded-xl px-3 py-2 text-sm font-semibold text-[#F0F0F0] focus:outline-none transition-colors"
        />
        <button
          onClick={addCourt}
          disabled={adding || !name.trim()}
          className="px-4 py-2 bg-[#C8F135] text-[#0A0A0A] text-sm font-black rounded-xl disabled:opacity-40 hover:bg-[#D4F54A] transition-colors"
        >
          +
        </button>
      </div>
      {error && <p className="text-xs text-[#FF4444] font-semibold px-5 pb-3">{error}</p>}

      {/* Auto-assign panel */}
      {courts.length > 0 && (
        <div className="border-t border-[#242424]">
          <button
            onClick={() => { setAutoOpen(o => !o); setAssignResult(null); setAssignError('') }}
            className="w-full flex items-center gap-2 px-5 py-3 text-left hover:bg-[#1C1C1C] transition-colors"
          >
            <span className="text-sm">⚡</span>
            <p className="flex-1 text-xs font-black text-[#888888] uppercase tracking-widest">Auto-distribuir partidas</p>
            <span className="text-[#6B6B6B] text-xs">{autoOpen ? '▲' : '▼'}</span>
          </button>

          {autoOpen && (
            <div className="px-5 pb-4 space-y-3">
              <p className="text-[11px] text-[#888888] leading-snug">
                Distribui as partidas pendentes entre as quadras, evitando conflitos de jogadores no mesmo horário.
              </p>

              {/* Toggle: same group same court */}
              <button
                type="button"
                onClick={() => setSameGroup(v => !v)}
                className="flex items-center gap-3 w-full"
              >
                <div className={`w-9 h-5 rounded-full transition-colors shrink-0 ${sameGroup ? 'bg-[#C8F135]' : 'bg-[#242424]'}`}>
                  <div className={`w-4 h-4 bg-[#0A0A0A] rounded-full shadow transition-transform mt-0.5 mx-0.5 ${sameGroup ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <span className="text-xs font-semibold text-[#888888]">Manter grupo na mesma quadra</span>
              </button>

              {/* Result / error feedback */}
              {assignResult && (
                <div className="flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 rounded-xl px-3 py-2">
                  <span className="text-sm">✅</span>
                  <p className="text-xs font-bold text-emerald-400">
                    {assignResult.assigned} partida{assignResult.assigned !== 1 ? 's' : ''} distribuída{assignResult.assigned !== 1 ? 's' : ''}
                    {assignResult.skipped > 0 && ` · ${assignResult.skipped} pulada${assignResult.skipped !== 1 ? 's' : ''}`}
                  </p>
                </div>
              )}
              {assignError && (
                <p className="text-xs text-[#FF4444] font-semibold">{assignError}</p>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAutoAssign}
                  disabled={assigning || clearing}
                  className="flex-1 py-2.5 bg-[#C8F135] text-[#0A0A0A] text-xs font-black rounded-xl disabled:opacity-40 hover:bg-[#D4F54A] transition-colors"
                >
                  {assigning ? 'Distribuindo...' : 'Distribuir agora'}
                </button>
                <button
                  onClick={handleClear}
                  disabled={clearing || assigning}
                  className="px-3 py-2.5 text-xs font-bold text-[#888888] hover:text-[#FF4444] transition-colors disabled:opacity-40"
                >
                  {clearing ? '...' : 'Limpar'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Court Schedule panel ──────────────────────────────────────

const STAGE_SHORT: Record<string, string> = {
  group_a: 'GA', group_b: 'GB', final: 'Final', consolation_final: '3º',
}

function CourtSchedulePanel({ tournamentId, courts }: { tournamentId: string; courts: Court[] }) {
  const supabase = createClient()
  const [matches,   setMatches]  = useState<Match[]>([])
  const [players,   setPlayers]  = useState<Record<string, string>>({})  // id → firstName
  const [loading,   setLoading]  = useState(true)
  const [saving,    setSaving]   = useState<string | null>(null)

  async function load() {
    const [{ data: ms }, { data: ps }] = await Promise.all([
      supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('status', 'pending'),
      supabase
        .from('players')
        .select('id, name')
        .eq('tournament_id', tournamentId),
    ])
    setMatches((ms ?? []) as Match[])
    const nameMap: Record<string, string> = {}
    for (const p of (ps ?? [])) {
      nameMap[p.id] = (p.name as string).split(' ')[0] ?? p.name
    }
    setPlayers(nameMap)
    setLoading(false)
  }

  useEffect(() => { load() }, [tournamentId])

  function n(id: string) { return players[id] ?? '?' }

  // sort matches within each court by queue_position
  function courtQueue(courtId: string) {
    return matches
      .filter(m => m.court_id === courtId)
      .sort((a, b) => (a.queue_position ?? Infinity) - (b.queue_position ?? Infinity))
  }

  const unassigned = matches.filter(m => !m.court_id)

  async function assignToCourt(matchId: string, courtId: string | null) {
    setSaving(matchId)
    const existing = courtId ? courtQueue(courtId) : []
    const nextPos  = courtId
      ? (existing.length > 0 ? Math.max(...existing.map(m => m.queue_position ?? -1)) + 1 : 0)
      : null

    await supabase.from('matches').update({
      court_id:       courtId,
      queue_position: nextPos,
    }).eq('id', matchId)

    setMatches(prev => prev.map(m =>
      m.id === matchId ? { ...m, court_id: courtId, queue_position: nextPos } : m
    ))
    setSaving(null)
  }

  async function reorder(courtId: string, matchId: string, dir: 'up' | 'down') {
    const queue  = courtQueue(courtId)
    const idx    = queue.findIndex(m => m.id === matchId)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= queue.length) return

    const a = queue[idx]
    const b = queue[swapIdx]
    const posA = a.queue_position ?? idx
    const posB = b.queue_position ?? swapIdx

    setSaving(matchId)
    await Promise.all([
      supabase.from('matches').update({ queue_position: posB }).eq('id', a.id),
      supabase.from('matches').update({ queue_position: posA }).eq('id', b.id),
    ])
    setMatches(prev => prev.map(m => {
      if (m.id === a.id) return { ...m, queue_position: posB }
      if (m.id === b.id) return { ...m, queue_position: posA }
      return m
    }))
    setSaving(null)
  }

  if (loading) {
    return (
      <div className="bg-[#161616] rounded-2xl border border-[#242424] shadow-sm p-5">
        <p className="text-xs font-bold text-[#888888] text-center">Carregando partidas...</p>
      </div>
    )
  }

  if (matches.length === 0) return null

  const otherCourts = (courtId: string) => courts.filter(c => c.id !== courtId)

  return (
    <div className="bg-[#161616] rounded-2xl border border-[#242424] shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 bg-[#111111] border-b border-[#242424] flex items-center gap-2">
        <span className="text-sm">📋</span>
        <p className="text-xs font-black text-[#888888] uppercase tracking-widest">Programação das quadras</p>
        <span className="ml-auto text-[10px] font-bold text-[#6B6B6B]">{matches.length} partida{matches.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Per-court sections */}
      {courts.map(court => {
        const queue = courtQueue(court.id)
        if (queue.length === 0) return null
        return (
          <div key={court.id} className="border-b border-[#242424] last:border-0">
            <div className="px-5 py-2 bg-[#111111]/60 flex items-center gap-2">
              <span className="text-xs">🏟️</span>
              <p className="text-xs font-black text-[#F0F0F0]">{court.name}</p>
              <span className="text-[10px] text-[#6B6B6B] font-bold">{queue.length} na fila</span>
            </div>
            <div className="divide-y divide-[#1C1C1C]">
              {queue.map((m, i) => (
                <MatchQueueRow
                  key={m.id}
                  match={m}
                  position={i + 1}
                  isFirst={i === 0}
                  isLast={i === queue.length - 1}
                  isSaving={saving === m.id}
                  n={n}
                  courts={courts}
                  currentCourtId={court.id}
                  onReorder={(dir) => reorder(court.id, m.id, dir)}
                  onMove={(cid) => assignToCourt(m.id, cid)}
                />
              ))}
            </div>
          </div>
        )
      })}

      {/* Unassigned matches */}
      {unassigned.length > 0 && (
        <div className="border-t border-[#242424]">
          <div className="px-5 py-2 bg-amber-500/10 flex items-center gap-2">
            <span className="text-xs">📭</span>
            <p className="text-xs font-black text-amber-400">Sem quadra</p>
            <span className="text-[10px] text-amber-400/70 font-bold">{unassigned.length}</span>
          </div>
          <div className="divide-y divide-[#1C1C1C]">
            {unassigned.map((m, i) => (
              <MatchQueueRow
                key={m.id}
                match={m}
                position={null}
                isFirst={i === 0}
                isLast={i === unassigned.length - 1}
                isSaving={saving === m.id}
                n={n}
                courts={courts}
                currentCourtId={null}
                onReorder={() => {}}
                onMove={(cid) => assignToCourt(m.id, cid)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MatchQueueRow({ match: m, position, isFirst, isLast, isSaving, n, courts, currentCourtId, onReorder, onMove }: {
  match:          Match
  position:       number | null
  isFirst:        boolean
  isLast:         boolean
  isSaving:       boolean
  n:              (id: string) => string
  courts:         Court[]
  currentCourtId: string | null
  onReorder:      (dir: 'up' | 'down') => void
  onMove:         (courtId: string | null) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 transition-colors ${isSaving ? 'opacity-40' : 'hover:bg-[#1C1C1C]/60'}`}>

      {/* Position + reorder — only shown when in a court */}
      {currentCourtId !== null ? (
        <div className="flex items-center gap-1 shrink-0 w-14">
          <span className="text-[10px] font-black text-[#6B6B6B] tabular-nums w-4">{position}</span>
          <div className="flex flex-col">
            <button
              onClick={() => onReorder('up')}
              disabled={isFirst || isSaving}
              className="text-[#6B6B6B] hover:text-[#F0F0F0] disabled:opacity-20 transition-colors leading-none text-[10px]"
            >
              ▲
            </button>
            <button
              onClick={() => onReorder('down')}
              disabled={isLast || isSaving}
              className="text-[#6B6B6B] hover:text-[#F0F0F0] disabled:opacity-20 transition-colors leading-none text-[10px]"
            >
              ▼
            </button>
          </div>
        </div>
      ) : (
        <div className="w-14 shrink-0" />
      )}

      {/* Match info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-black text-[#888888] uppercase tracking-wide">
            {STAGE_SHORT[m.stage] ?? m.stage}
          </span>
          {!m.stage.includes('final') && (
            <span className="text-[10px] text-[#6B6B6B] font-bold">R{m.round}</span>
          )}
        </div>
        <p className="text-xs font-bold text-[#F0F0F0] truncate leading-tight">
          {n(m.team1_p1)}/{n(m.team1_p2)}
          <span className="text-[#6B6B6B] mx-1 font-normal">vs</span>
          {n(m.team2_p1)}/{n(m.team2_p2)}
        </p>
      </div>

      {/* Court selector */}
      <div className="relative shrink-0">
        <button
          onClick={() => setOpen(o => !o)}
          disabled={isSaving}
          className="flex items-center gap-1 text-[10px] font-bold text-[#888888] bg-[#1C1C1C] hover:bg-[#242424] px-2 py-1.5 rounded-lg transition-colors disabled:opacity-40"
        >
          {currentCourtId ? courts.find(c => c.id === currentCourtId)?.name ?? '?' : 'Atribuir'}
          <span className="text-[#6B6B6B]">▾</span>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 z-20 bg-[#161616] rounded-xl border border-[#242424] shadow-lg py-1 min-w-[140px]">
            {courts.filter(c => c.id !== currentCourtId).map(c => (
              <button
                key={c.id}
                onClick={() => { setOpen(false); onMove(c.id) }}
                className="w-full text-left px-3 py-2 text-xs font-bold text-[#F0F0F0] hover:bg-[#C8F135]/10 hover:text-[#C8F135] transition-colors"
              >
                🏟️ {c.name}
              </button>
            ))}
            {currentCourtId !== null && (
              <button
                onClick={() => { setOpen(false); onMove(null) }}
                className="w-full text-left px-3 py-2 text-xs font-bold text-amber-400 hover:bg-amber-500/10 transition-colors border-t border-[#242424] mt-1 pt-2"
              >
                📭 Remover quadra
              </button>
            )}
          </div>
        )}
      </div>

    </div>
  )
}

// ── Add/Edit Form ─────────────────────────────────────────────

interface FormState {
  type:      TVContentType
  title:     string
  body:      string
  image_url: string
  duration:  number
  frequency: number  // minutes (image type only)
  enabled:   boolean
}

const BLANK: FormState = {
  type: 'announcement', title: '', body: '', image_url: '', duration: 8, frequency: 5, enabled: true,
}

function ContentForm({ tournamentId, onSave, onCancel, initial }: {
  tournamentId: string
  onSave:    () => void
  onCancel:  () => void
  initial?:  TVContent
}) {
  const supabase = createClient()
  const [form, setForm]         = useState<FormState>(initial
    ? { type: initial.type, title: initial.title ?? '', body: initial.body ?? '', image_url: initial.image_url ?? '', duration: initial.duration, frequency: initial.frequency ?? 5, enabled: initial.enabled }
    : BLANK
  )
  const [uploading, setUploading] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function uploadImage(file: File) {
    setUploading(true)
    const ext  = file.name.split('.').pop()
    const path = `${tournamentId}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('tv-content').upload(path, file)
    if (upErr) { setError(upErr.message); setUploading(false); return }
    const { data } = supabase.storage.from('tv-content').getPublicUrl(path)
    setForm(f => ({ ...f, image_url: data.publicUrl }))
    setUploading(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    const payload = {
      tournament_id: tournamentId,
      type:      form.type,
      title:     form.title.trim() || null,
      body:      form.body.trim()  || null,
      image_url: form.image_url    || null,
      duration:  form.duration,
      frequency: form.type === 'image' ? form.frequency : null,
      enabled:   form.enabled,
    }

    const { error: err } = initial
      ? await supabase.from('tv_content').update(payload).eq('id', initial.id)
      : await supabase.from('tv_content').insert({ ...payload, sort_order: 999 })

    if (err) { setError(err.message); setSaving(false); return }
    onSave()
  }

  return (
    <div className="bg-[#161616] rounded-2xl border border-[#242424] shadow-sm p-5 space-y-5 animate-fade-in">
      <p className="font-black text-[#F0F0F0]">{initial ? 'Editar item' : 'Novo item'}</p>

      {/* Type */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-[#888888] uppercase tracking-wide">Tipo</label>
        <div className="grid grid-cols-3 gap-2">
          {TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setForm(f => ({ ...f, type: t.value }))}
              className={`px-3 py-3 rounded-xl border-2 text-left transition-all ${
                form.type === t.value
                  ? 'border-[#C8F135] bg-[#1C1C1C]'
                  : 'border-[#242424] hover:border-[#3a3a3a]'
              }`}
            >
              <p className="text-lg leading-none mb-1">{t.icon}</p>
              <p className={`text-xs font-black ${form.type === t.value ? 'text-[#C8F135]' : 'text-[#F0F0F0]'}`}>{t.label}</p>
              <p className="text-[10px] text-[#888888] mt-0.5 leading-tight">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-[#888888] uppercase tracking-wide">Título</label>
        <input
          type="text"
          placeholder="Ex: Patrocinador Oficial"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          className="w-full bg-[#111111] border-2 border-[#242424] focus:border-[#C8F135] rounded-xl px-4 py-2.5 text-sm font-semibold text-[#F0F0F0] focus:outline-none transition-colors"
        />
      </div>

      {/* Body */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-[#888888] uppercase tracking-wide">Texto</label>
        <textarea
          rows={2}
          placeholder="Texto adicional (opcional)"
          value={form.body}
          onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
          className="w-full bg-[#111111] border-2 border-[#242424] focus:border-[#C8F135] rounded-xl px-4 py-2.5 text-sm font-semibold text-[#F0F0F0] focus:outline-none transition-colors resize-none"
        />
      </div>

      {/* Image upload */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-[#888888] uppercase tracking-wide">Imagem</label>
        <div className="flex items-center gap-3">
          {form.image_url && (
            <img src={form.image_url} alt="Preview" className="h-12 w-auto max-w-[120px] object-contain rounded-lg border border-[#242424]" />
          )}
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="text-xs font-bold text-[#C8F135] bg-[#C8F135]/10 px-3 py-2 rounded-lg hover:bg-[#C8F135]/15 transition-colors disabled:opacity-50"
            >
              {uploading ? 'Enviando...' : form.image_url ? 'Trocar imagem' : 'Enviar imagem'}
            </button>
            {form.image_url && (
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, image_url: '' }))}
                className="text-[10px] font-bold text-[#FF4444]/70 hover:text-[#FF4444] transition-colors"
              >
                Remover
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f) }}
          />
        </div>
      </div>

      {/* Duration */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-[#888888] uppercase tracking-wide">
          Duração — <span className="text-[#F0F0F0]">{form.duration}s</span>
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={3}
            max={30}
            step={1}
            value={form.duration}
            onChange={e => setForm(f => ({ ...f, duration: Number(e.target.value) }))}
            className="flex-1 accent-[#C8F135]"
          />
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={3}
              max={30}
              value={form.duration}
              onChange={e => setForm(f => ({ ...f, duration: Math.max(3, Math.min(30, Number(e.target.value))) }))}
              className="w-14 text-center bg-[#111111] border-2 border-[#242424] focus:border-[#C8F135] rounded-lg py-1.5 text-sm font-black text-[#F0F0F0] focus:outline-none
                         [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-xs text-[#888888] font-semibold">s</span>
          </div>
        </div>
      </div>

      {/* Frequency (image only) */}
      {form.type === 'image' && (
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#888888] uppercase tracking-wide">
            Frequência — <span className="text-[#F0F0F0]">a cada {form.frequency} min</span>
          </label>
          <p className="text-[11px] text-[#888888]">Intervalo entre cada exibição em tela cheia</p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={60}
              step={1}
              value={form.frequency}
              onChange={e => setForm(f => ({ ...f, frequency: Number(e.target.value) }))}
              className="flex-1 accent-[#C8F135]"
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={60}
                value={form.frequency}
                onChange={e => setForm(f => ({ ...f, frequency: Math.max(1, Math.min(60, Number(e.target.value))) }))}
                className="w-14 text-center bg-[#111111] border-2 border-[#242424] focus:border-[#C8F135] rounded-lg py-1.5 text-sm font-black text-[#F0F0F0] focus:outline-none
                           [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-xs text-[#888888] font-semibold">min</span>
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-[#FF4444] font-semibold">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border-2 border-[#242424] text-sm font-bold text-[#888888] hover:border-[#3a3a3a] transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving || uploading}
          className="flex-1 py-2.5 rounded-xl bg-[#C8F135] hover:bg-[#D4F54A] text-[#0A0A0A] text-sm font-black disabled:opacity-50 transition-colors"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}

// ── Item card ─────────────────────────────────────────────────

function ContentItemCard({ item, onEdit, onToggle, onDelete, onMove, isFirst, isLast }: {
  item:     TVContent
  onEdit:   () => void
  onToggle: () => void
  onDelete: () => void
  onMove:   (dir: 'up' | 'down') => void
  isFirst:  boolean
  isLast:   boolean
}) {
  const typeInfo = TYPES.find(t => t.value === item.type)!

  return (
    <div className={`bg-[#161616] rounded-2xl border border-[#242424] shadow-sm overflow-hidden transition-opacity ${item.enabled ? '' : 'opacity-50'}`}>
      <div className="flex items-center gap-3 px-4 py-3.5">

        {/* Order controls */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            onClick={() => onMove('up')}
            disabled={isFirst}
            className="text-[#6B6B6B] hover:text-[#F0F0F0] disabled:opacity-20 transition-colors leading-none text-sm"
          >
            ▲
          </button>
          <button
            onClick={() => onMove('down')}
            disabled={isLast}
            className="text-[#6B6B6B] hover:text-[#F0F0F0] disabled:opacity-20 transition-colors leading-none text-sm"
          >
            ▼
          </button>
        </div>

        {/* Type icon */}
        <span className="text-2xl shrink-0">{typeInfo.icon}</span>

        {/* Content info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full border ${TYPE_COLOR[item.type]}`}>
              {typeInfo.label}
            </span>
            <span className="text-[10px] font-bold text-[#6B6B6B]">{item.duration}s</span>
            {item.type === 'image' && item.frequency != null && (
              <span className="text-[10px] font-bold text-[#6B6B6B]">· a cada {item.frequency}min</span>
            )}
          </div>
          <p className="text-sm font-bold text-[#F0F0F0] mt-0.5 truncate">{item.title || item.body || '(sem título)'}</p>
          {item.image_url && (
            <p className="text-[10px] text-[#888888]">📎 Imagem anexada</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Toggle */}
          <button
            onClick={onToggle}
            className={`w-10 h-6 rounded-full transition-colors shrink-0 ${item.enabled ? 'bg-emerald-500' : 'bg-[#242424]'}`}
            title={item.enabled ? 'Desativar' : 'Ativar'}
          >
            <div className={`w-5 h-5 bg-[#0A0A0A] rounded-full shadow transition-transform mx-0.5 ${item.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
          <button onClick={onEdit}   className="p-1.5 text-[#888888] hover:text-[#F0F0F0] transition-colors text-xs font-bold">✏️</button>
          <button onClick={onDelete} className="p-1.5 text-[#6B6B6B] hover:text-[#FF4444] transition-colors text-xs font-bold">✕</button>
        </div>

      </div>

      {/* Image preview strip */}
      {item.image_url && item.enabled && (
        <div className="px-4 pb-3">
          <img src={item.image_url} alt="" className="h-10 w-auto max-w-[180px] object-contain rounded border border-[#242424]" />
        </div>
      )}
    </div>
  )
}

// ── Root panel ────────────────────────────────────────────────

export default function TVAdminPanel({ tournamentId, items: initialItems, courts }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [items, setItems]     = useState<TVContent[]>(initialItems)
  const [adding,  setAdding]  = useState(false)
  const [editing, setEditing] = useState<TVContent | null>(null)
  const [, startTransition]   = useTransition()

  function refresh() {
    startTransition(() => { router.refresh() })
  }

  async function handleToggle(item: TVContent) {
    await supabase.from('tv_content').update({ enabled: !item.enabled }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, enabled: !i.enabled } : i))
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este item?')) return
    await supabase.from('tv_content').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function handleMove(item: TVContent, dir: 'up' | 'down') {
    const sorted  = [...items].sort((a, b) => a.sort_order - b.sort_order)
    const idx     = sorted.findIndex(i => i.id === item.id)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return

    const a = sorted[idx]
    const b = sorted[swapIdx]
    const newA = a.sort_order
    const newB = b.sort_order

    // Swap sort_orders
    await Promise.all([
      supabase.from('tv_content').update({ sort_order: newB }).eq('id', a.id),
      supabase.from('tv_content').update({ sort_order: newA }).eq('id', b.id),
    ])
    setItems(prev => prev.map(i => {
      if (i.id === a.id) return { ...i, sort_order: newB }
      if (i.id === b.id) return { ...i, sort_order: newA }
      return i
    }))
  }

  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="space-y-5 animate-fade-in max-w-lg mx-auto lg:py-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-[#888888]">Modo TV</p>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-[#F0F0F0]">Conteúdo rotativo</h1>
        </div>
        <a
          href={`/t/${tournamentId}/tv`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm font-bold text-[#C8F135] bg-[#C8F135]/10 px-4 py-2.5 rounded-xl hover:bg-[#C8F135]/15 transition-colors"
        >
          📺 Ver TV
        </a>
      </div>

      {/* Courts */}
      <CourtsSection tournamentId={tournamentId} courts={courts} />

      {/* Court schedule (manual reassignment + reorder) */}
      {courts.length > 0 && (
        <CourtSchedulePanel tournamentId={tournamentId} courts={courts} />
      )}

      {/* Preview legend */}
      <div className="bg-[#111111] border border-[#242424] rounded-2xl px-4 py-3 flex items-center gap-3">
        <div className="w-2 h-2 bg-[#C8F135] rounded-full animate-pulse shrink-0" />
        <p className="text-xs text-[#888888] font-medium">
          <strong className="text-[#F0F0F0]">Patrocinadores</strong> ocupam a tela inteira na frequência definida.{' '}
          <strong className="text-[#F0F0F0]">Promoções e avisos</strong> aparecem na barra inferior em rotação contínua.
          Itens desativados são pulados.
        </p>
      </div>

      {/* Add button */}
      {!adding && !editing && (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-[#C8F135]/30 text-sm font-bold text-[#C8F135] hover:border-[#C8F135] hover:bg-[#C8F135]/5 transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          Adicionar conteúdo
        </button>
      )}

      {/* Add form */}
      {adding && (
        <ContentForm
          tournamentId={tournamentId}
          onSave={() => { setAdding(false); refresh() }}
          onCancel={() => setAdding(false)}
        />
      )}

      {/* Edit form */}
      {editing && (
        <ContentForm
          tournamentId={tournamentId}
          initial={editing}
          onSave={() => { setEditing(null); refresh() }}
          onCancel={() => setEditing(null)}
        />
      )}

      {/* Items list */}
      {sorted.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-4xl">📺</p>
          <p className="font-bold text-[#888888]">Nenhum conteúdo ainda</p>
          <p className="text-sm text-[#6B6B6B]">Adicione patrocinadores, promoções ou avisos</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <p className="text-[10px] font-black text-[#888888] uppercase tracking-widest">
            {sorted.filter(i => i.enabled).length} ativo{sorted.filter(i => i.enabled).length !== 1 ? 's' : ''} · {sorted.length} total
          </p>
          {sorted.map((item, i) => (
            <ContentItemCard
              key={item.id}
              item={item}
              isFirst={i === 0}
              isLast={i === sorted.length - 1}
              onEdit={()   => { setEditing(item); setAdding(false) }}
              onToggle={()  => handleToggle(item)}
              onDelete={()  => handleDelete(item.id)}
              onMove={(dir) => handleMove(item, dir)}
            />
          ))}
        </div>
      )}

    </div>
  )
}
