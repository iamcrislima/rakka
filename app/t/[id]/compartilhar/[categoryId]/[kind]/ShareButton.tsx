'use client'

import { useEffect, useState } from 'react'

export default function ShareButton({ imageUrl, fileName, title, championName }: {
  imageUrl:     string
  fileName:     string
  title:        string
  championName: string
}) {
  const [canShareFiles, setCanShareFiles] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean }
      if (!nav.share || !nav.canShare) { setCanShareFiles(false); return }
      const probe = new File([new Uint8Array([1])], 'probe.png', { type: 'image/png' })
      setCanShareFiles(nav.canShare({ files: [probe] }))
    } catch {
      setCanShareFiles(false)
    }
  }, [])

  async function fetchImageFile(): Promise<File> {
    const res  = await fetch(imageUrl)
    const blob = await res.blob()
    return new File([blob], fileName, { type: 'image/png' })
  }

  async function handleShare() {
    setBusy(true)
    setError('')
    try {
      const file = await fetchImageFile()
      await navigator.share({
        files: [file],
        title: `${title} — ${championName}`,
        text:  `${championName} é ${title.toLowerCase()}! 🏆`,
      })
    } catch (e) {
      // AbortError just means the user closed the native share sheet — not an error.
      if (e instanceof Error && e.name !== 'AbortError') {
        setError('Não foi possível compartilhar. Tente baixar a imagem.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleDownload() {
    setBusy(true)
    setError('')
    try {
      const res  = await fetch(imageUrl)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError('Não foi possível baixar a imagem. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full max-w-xs flex flex-col items-center gap-2">
      <button
        onClick={canShareFiles ? handleShare : handleDownload}
        disabled={busy || canShareFiles === null}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-[#C8F135] text-[#0A0A0A] font-black uppercase tracking-wide disabled:opacity-40 active:scale-[0.97] transition-all"
      >
        {busy ? 'Aguarde…' : canShareFiles ? '📤 Compartilhar' : '⬇ Baixar imagem'}
      </button>

      {canShareFiles === false && (
        <p className="text-xs text-[#888888] text-center">Baixe e poste no seu Stories</p>
      )}

      {error && <p className="text-xs font-bold text-[#FF4444] text-center">{error}</p>}
    </div>
  )
}
