'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export default function MuralUpload({ tournamentId, tournamentName }: { tournamentId: string; tournamentName: string }) {
  const [file, setFile]         = useState<File | null>(null)
  const [preview, setPreview]   = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [done, setDone]         = useState(false)
  const [error, setError]       = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    setError('')
    if (!f) return
    if (!f.type.startsWith('image/')) { setError('Envie apenas arquivos de imagem.'); return }
    if (f.size > MAX_SIZE) { setError('A imagem deve ter no máximo 5MB.'); return }
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError('')

    const supabase = createClient()
    const ext  = file.name.split('.').pop() || 'jpg'
    const path = `${tournamentId}/${crypto.randomUUID()}.${ext}`

    const { error: upErr } = await supabase.storage.from('mural-photos').upload(path, file, { contentType: file.type })
    if (upErr) {
      setError('Não foi possível enviar a foto. Tente novamente.')
      setUploading(false)
      return
    }

    const { error: dbErr } = await supabase
      .from('mural_photos')
      .insert({ tournament_id: tournamentId, storage_path: path, status: 'pending' })

    if (dbErr) {
      setError('Não foi possível enviar a foto. Tente novamente.')
      setUploading(false)
      return
    }

    setUploading(false)
    setDone(true)
  }

  if (done) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#0A0A0A] text-[#F0F0F0] px-8 text-center">
        <span className="text-6xl">✅</span>
        <p className="font-display text-2xl font-bold uppercase">Foto enviada!</p>
        <p className="text-sm text-[#888888] max-w-xs">
          Sua foto passa por aprovação antes de aparecer no telão.
        </p>
        <button
          onClick={() => { setDone(false); setFile(null); setPreview(null) }}
          className="mt-2 text-xs font-bold text-[#C8F135] underline underline-offset-2"
        >
          Enviar outra foto
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 bg-[#0A0A0A] text-[#F0F0F0] px-6 text-center overflow-y-auto py-10">

      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#888888]">{tournamentName}</p>
        <p className="font-display text-2xl font-bold uppercase text-[#C8F135] mt-1">Mural do Evento</p>
        <p className="text-sm text-[#888888] mt-2 max-w-xs mx-auto">Envie sua foto para o mural do evento</p>
      </div>

      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Prévia" className="max-w-full max-h-[40vh] rounded-2xl object-contain border border-[#242424]" />
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full max-w-sm py-16 rounded-2xl border-2 border-dashed border-[#242424] text-[#6B6B6B] font-bold flex flex-col items-center gap-2 hover:border-[#C8F135]/40 hover:text-[#C8F135] transition-colors"
        >
          <span className="text-4xl">📷</span>
          Toque para escolher uma foto
        </button>
      )}

      {preview && (
        <button
          onClick={() => inputRef.current?.click()}
          className="text-xs font-bold text-[#888888] underline underline-offset-2"
        >
          Escolher outra foto
        </button>
      )}

      {error && <p className="text-sm font-bold text-[#FF4444]">{error}</p>}

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="w-full max-w-sm py-4 rounded-2xl bg-[#C8F135] text-[#0A0A0A] font-black uppercase tracking-wide disabled:opacity-30 active:scale-[0.97] transition-all"
      >
        {uploading ? 'Enviando…' : 'Enviar foto'}
      </button>

      <p className="text-[11px] text-[#6B6B6B] max-w-xs">
        ⚠️ Sua foto passa por aprovação antes de aparecer no telão.
      </p>

    </div>
  )
}
