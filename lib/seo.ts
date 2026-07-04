import type { Metadata } from 'next'

export const SITE_NAME          = 'Rakka'
export const DEFAULT_TITLE       = 'Rakka — Gestão de torneios esportivos'
export const DEFAULT_DESCRIPTION = 'Gerencie seus torneios esportivos'

/** Static fallback preview image — a per-tournament dynamic OG image is a
 *  future improvement, not needed yet (see AGENTS.md task history). */
export const OG_IMAGE = {
  url:    '/og-image.png',
  width:  1200,
  height: 630,
  alt:    SITE_NAME,
}

export function buildOpenGraph({ title, description }: { title: string; description: string }): Metadata['openGraph'] {
  return {
    title,
    description,
    siteName: SITE_NAME,
    images:   [OG_IMAGE],
    locale:   'pt_BR',
    type:     'website',
  }
}

export function buildTwitter({ title, description }: { title: string; description: string }): Metadata['twitter'] {
  return {
    card:        'summary_large_image',
    title,
    description,
    images:      [OG_IMAGE.url],
  }
}
