'use client'

import { useEffect } from 'react'
import { useTopbar } from './TopbarContext'

interface TopbarMeta {
  title:    string
  subtitle?: string | null
  eyebrow?:  string | null
}

/**
 * Call this at the top of any 'use client' component to set the topbar title.
 * Updates whenever `meta` changes (deps are compared shallowly by React).
 *
 * Example:
 *   useSetTopbar({ title: tournament.name, subtitle: 'Fase de grupos', eyebrow: 'Torneio' })
 */
export function useSetTopbar(meta: TopbarMeta) {
  const { setMeta } = useTopbar()

  useEffect(() => {
    setMeta({
      title:    meta.title,
      subtitle: meta.subtitle ?? null,
      eyebrow:  meta.eyebrow  ?? null,
    })
    // Clear on unmount so the topbar doesn't show stale info
    return () => setMeta({ title: '', subtitle: null, eyebrow: null })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.title, meta.subtitle, meta.eyebrow])
}
