'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface TopbarMeta {
  title:    string
  subtitle: string | null
  eyebrow:  string | null
}

interface TopbarContextValue {
  meta:    TopbarMeta
  setMeta: (m: Partial<TopbarMeta>) => void
}

const DEFAULT: TopbarMeta = { title: '', subtitle: null, eyebrow: null }

const TopbarContext = createContext<TopbarContextValue>({
  meta:    DEFAULT,
  setMeta: () => {},
})

export function TopbarProvider({ children }: { children: ReactNode }) {
  const [meta, setMetaState] = useState<TopbarMeta>(DEFAULT)

  const setMeta = useCallback((m: Partial<TopbarMeta>) => {
    setMetaState(prev => ({ ...prev, ...m }))
  }, [])

  return (
    <TopbarContext.Provider value={{ meta, setMeta }}>
      {children}
    </TopbarContext.Provider>
  )
}

export function useTopbar() {
  return useContext(TopbarContext)
}
