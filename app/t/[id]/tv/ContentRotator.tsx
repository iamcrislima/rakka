'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import type { TVContent, TVContentType } from '@/types'

interface Props {
  items: TVContent[]
}

const TYPE_LABEL: Record<TVContentType, string> = {
  image:        'Patrocinador',
  promotion:    'Promoção',
  announcement: 'Aviso',
}

const TYPE_ACCENT: Record<TVContentType, { bar: string; badge: string }> = {
  image:        { bar: 'from-sky-500/20 to-sky-500/5',      badge: 'bg-sky-500/20 text-sky-300'      },
  promotion:    { bar: 'from-amber-500/20 to-amber-500/5',  badge: 'bg-amber-500/20 text-amber-300'  },
  announcement: { bar: 'from-violet-500/20 to-violet-500/5',badge: 'bg-violet-500/20 text-violet-300'},
}

// ── FULLSCREEN image overlay ──────────────────────────────────

function FullscreenImageOverlay({ item, visible }: { item: TVContent; visible: boolean }) {
  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black"
      style={{
        opacity:    visible ? 1 : 0,
        transition: 'opacity 0.7s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {item.image_url ? (
        <img
          src={item.image_url}
          alt={item.title ?? 'Patrocinador'}
          className="w-full h-full object-contain"
        />
      ) : (
        // Fallback: text-only fullscreen card
        <div className="flex flex-col items-center justify-center gap-6 px-16 text-center">
          <span className={`text-sm font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full ${TYPE_ACCENT[item.type].badge}`}>
            {TYPE_LABEL[item.type]}
          </span>
          {item.title && (
            <p className="text-5xl font-black text-white leading-tight">{item.title}</p>
          )}
          {item.body && (
            <p className="text-2xl font-semibold text-white/60">{item.body}</p>
          )}
        </div>
      )}

      {/* Bottom label strip (when there's an image + title) */}
      {item.image_url && item.title && (
        <div className="absolute bottom-0 left-0 right-0 px-10 py-6 bg-gradient-to-t from-black/80 to-transparent flex items-end gap-4">
          <span className={`text-xs font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full shrink-0 ${TYPE_ACCENT[item.type].badge}`}>
            {TYPE_LABEL[item.type]}
          </span>
          <p className="text-xl font-black text-white truncate">{item.title}</p>
          {item.body && (
            <p className="text-base text-white/60 font-semibold truncate">{item.body}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── LOWER-THIRD overlay (promotion + announcement) ─────────────

function OverlayCard({ item }: { item: TVContent }) {
  const accent = TYPE_ACCENT[item.type]
  return (
    <div className={`flex items-center gap-6 px-8 py-4 bg-gradient-to-r ${accent.bar} backdrop-blur-md`}>
      <div className="flex items-center gap-5 flex-1 min-w-0">
        <div className="shrink-0">
          <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full ${accent.badge}`}>
            {TYPE_LABEL[item.type]}
          </span>
        </div>
        <div className="min-w-0">
          {item.title && (
            <p className="text-base font-black text-white leading-tight truncate">{item.title}</p>
          )}
          {item.body && (
            <p className={`text-sm font-semibold leading-tight mt-0.5 truncate ${item.title ? 'text-white/60' : 'text-white'}`}>
              {item.body}
            </p>
          )}
        </div>
      </div>
      {item.image_url && (
        <div className="shrink-0 h-14 w-auto flex items-center">
          <img
            src={item.image_url}
            alt={item.title ?? ''}
            className="h-12 w-auto max-w-[160px] object-contain rounded"
          />
        </div>
      )}
    </div>
  )
}

// ── Root rotator ──────────────────────────────────────────────

export default function ContentRotator({ items }: Props) {
  const activeItems = items.filter(i => i.enabled)

  // Split by behaviour
  const imageItems   = activeItems.filter(i => i.type === 'image')
  const overlayItems = activeItems.filter(i => i.type !== 'image')

  // ── Fullscreen state ──────────────────────────────────────────
  const [fsItem,    setFsItem]    = useState<TVContent | null>(null)
  const [fsVisible, setFsVisible] = useState(false)

  // nextShowAt[id] = timestamp (ms) when that image should next appear
  const scheduleRef = useRef<Map<string, number>>(new Map())

  // Initialise schedules on mount / when image items change
  useEffect(() => {
    const now = Date.now()
    imageItems.forEach(item => {
      if (!scheduleRef.current.has(item.id)) {
        const freqMs = (item.frequency ?? 5) * 60 * 1000
        scheduleRef.current.set(item.id, now + freqMs)
      }
    })
    // Remove stale entries
    scheduleRef.current.forEach((_, id) => {
      if (!imageItems.find(i => i.id === id)) scheduleRef.current.delete(id)
    })
  }, [imageItems]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tick every second to check if any image is due
  const showingRef = useRef(false)

  const tick = useCallback(() => {
    if (showingRef.current) return
    const now = Date.now()

    // Find earliest due item
    let due: TVContent | null = null
    let dueAt = Infinity
    imageItems.forEach(item => {
      const next = scheduleRef.current.get(item.id) ?? Infinity
      if (next <= now && next < dueAt) {
        due   = item
        dueAt = next
      }
    })

    if (!due) return

    // Schedule its next appearance immediately so we don't show twice
    const freqMs = ((due as TVContent).frequency ?? 5) * 60 * 1000
    scheduleRef.current.set((due as TVContent).id, now + freqMs)

    // Show fullscreen
    showingRef.current = true
    setFsItem(due)

    // Fade in after paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setFsVisible(true))
    })

    // After duration: fade out
    const showMs = ((due as TVContent).duration ?? 8) * 1000
    setTimeout(() => {
      setFsVisible(false)
      setTimeout(() => {
        setFsItem(null)
        showingRef.current = false
      }, 800)
    }, showMs)
  }, [imageItems])

  useEffect(() => {
    if (imageItems.length === 0) return
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [tick, imageItems.length])

  // ── Lower-third overlay state ─────────────────────────────────
  const [overlayIdx,     setOverlayIdx]     = useState(0)
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [mounted,        setMounted]        = useState(false)
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 2000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!mounted || overlayItems.length === 0) return
    setOverlayVisible(true)
    const current  = overlayItems[overlayIdx]
    const showMs   = (current?.duration ?? 8) * 1000

    overlayTimerRef.current = setTimeout(() => {
      setOverlayVisible(false)
      overlayTimerRef.current = setTimeout(() => {
        setOverlayIdx(i => (i + 1) % overlayItems.length)
      }, 700)
    }, showMs)

    return () => { if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current) }
  }, [mounted, overlayIdx, overlayItems.length]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Fullscreen image takeover */}
      {fsItem && (
        <FullscreenImageOverlay item={fsItem} visible={fsVisible} />
      )}

      {/* Lower-third for promotion / announcement */}
      {overlayItems.length > 0 && (
        <div
          className="absolute bottom-0 left-0 right-0 z-20"
          style={{
            opacity:    overlayVisible ? 1 : 0,
            transform:  overlayVisible ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.5s ease, transform 0.5s ease',
          }}
        >
          <div className="h-px bg-white/8" />
          <OverlayCard item={overlayItems[overlayIdx % overlayItems.length]} />
        </div>
      )}
    </>
  )
}
