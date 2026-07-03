import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Tournament, Category, Player, Match } from '@/types'
import TournamentPublicPage from './TournamentPublicPage'

// ── Exported types used by the client component ───────────

export interface RegContext {
  shareToken:     string
  isOpen:         boolean
  confirmedCount: number
  waitingCount:   number
}

export interface CategoryWithReg {
  category: Category
  reg:      RegContext | null
  players:  Player[]
  matches:  Match[]
}

// ── Data fetching ─────────────────────────────────────────

export default async function PublicTournamentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // 1. Tournament
  const { data: t } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .single()

  if (!t) notFound()
  const tournament = t as Tournament

  // 2. Categories
  const { data: cats } = await supabase
    .from('categories')
    .select('*')
    .eq('tournament_id', id)
    .order('sort_order')
    .order('created_at')

  const categories = (cats ?? []) as Category[]

  // 3. Legacy mode (no categories)
  let legacyPlayers: Player[] = []
  let legacyMatches: Match[]  = []

  if (categories.length === 0) {
    const [{ data: lp }, { data: lm }] = await Promise.all([
      supabase.from('players').select('*').eq('tournament_id', id).order('position'),
      supabase.from('matches').select('*').eq('tournament_id', id).order('round'),
    ])
    legacyPlayers = (lp ?? []) as Player[]
    legacyMatches = (lm ?? []) as Match[]
  }

  // 4. Per-category data
  const categoryData: CategoryWithReg[] = await Promise.all(
    categories.map(async (cat) => {
      const [{ data: cPlayers }, { data: cMatches }] = await Promise.all([
        supabase.from('players').select('*').eq('category_id', cat.id).order('position'),
        supabase.from('matches').select('*').eq('category_id', cat.id).order('round'),
      ])

      let reg: RegContext | null = null
      if (cat.registration_id) {
        const [{ data: regRow }, { data: registrants }] = await Promise.all([
          supabase
            .from('registrations')
            .select('share_token, is_open')
            .eq('id', cat.registration_id)
            .single(),
          supabase
            .from('registrants')
            .select('id, status')
            .eq('registration_id', cat.registration_id),
        ])
        if (regRow) {
          const confirmed = (registrants ?? []).filter(r => r.status === 'confirmed').length
          const waiting   = (registrants ?? []).filter(r => r.status === 'waiting').length
          reg = {
            shareToken:     regRow.share_token as string,
            isOpen:         regRow.is_open as boolean,
            confirmedCount: confirmed,
            waitingCount:   waiting,
          }
        }
      }

      return {
        category: cat,
        reg,
        players: (cPlayers ?? []) as Player[],
        matches: (cMatches ?? []) as Match[],
      }
    })
  )

  // 5. Global nameMap
  const allPlayers = [
    ...legacyPlayers,
    ...categoryData.flatMap(cd => cd.players),
  ]
  const nameMap = Object.fromEntries(allPlayers.map(p => [p.id, p.name]))

  return (
    <TournamentPublicPage
      tournament={tournament}
      categoryData={categoryData}
      legacyPlayers={legacyPlayers}
      legacyMatches={legacyMatches}
      nameMap={nameMap}
    />
  )
}
