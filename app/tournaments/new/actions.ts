'use server'

import { createClient } from '@/lib/supabase/server'
import type { CategoryFormat, CategoryGender, CategoryLevel, RuleType } from '@/types'

export interface CategoryInput {
  name:               string
  playerLimit:        number
  entryMode:          'manual' | 'registration'
  maxGames:           4 | 6
  deuce:              'tiebreak' | 'super_tiebreak'
  tiebreakTo:         7 | 10
  ruleType:           RuleType
  targetSum:          number | null
  priceEnabled:       boolean
  price:              string
  paymentMode:        'individual' | 'pair'
  format:             CategoryFormat
  consolationBracket: boolean
  gender:             CategoryGender | null
  level:              CategoryLevel | null
}

export interface CreateResult {
  id:                string
  registrationLinks: Array<{ categoryName: string; token: string }>
}

export async function createTournamentFromBuilder(
  tournamentName: string,
  type:           'super' | 'doubles',
  categories:     CategoryInput[],
): Promise<CreateResult | { error: string }> {
  const supabase = await createClient()

  // Auth (optional — tournaments allow anonymous ownership)
  const { data: { user } } = await supabase.auth.getUser()

  // 1. Create tournament
  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .insert({
      name:        tournamentName.trim(),
      type,
      status:      'draft',
      user_id:     user?.id ?? null,
      max_games:   6,
      deuce:       'super_tiebreak',
      tiebreak_to: 10,
    })
    .select('id')
    .single()

  if (tErr || !tournament) return { error: tErr?.message ?? 'Erro ao criar torneio.' }

  const registrationLinks: CreateResult['registrationLinks'] = []

  // 2. Create categories (sequential to respect sort_order)
  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i]

    let registrationId: string | null = null
    let shareToken:     string | null = null

    // 2a. If open registration, create a registration record first
    if (cat.entryMode === 'registration') {
      const regName = `${cat.name} — ${tournamentName.trim()}`
      const { data: reg, error: regErr } = await supabase
        .from('registrations')
        .insert({
          name:         regName,
          player_limit: cat.playerLimit,
          is_open:      true,
          user_id:      user?.id ?? null,
        })
        .select('id, share_token')
        .single()

      if (regErr || !reg) return { error: regErr?.message ?? 'Erro ao criar inscrição.' }
      registrationId = reg.id
      shareToken     = reg.share_token
    }

    const priceValue = cat.priceEnabled && cat.price.trim()
      ? parseFloat(cat.price)
      : null

    const { error: catErr } = await supabase
      .from('categories')
      .insert({
        tournament_id:       tournament.id,
        name:                cat.name.trim(),
        status:              'draft',
        max_games:           cat.maxGames,
        deuce:               cat.deuce,
        tiebreak_to:         cat.tiebreakTo,
        rule_type:           cat.ruleType,
        target_sum:          cat.targetSum,
        sort_order:          i,
        player_limit:        cat.playerLimit,
        entry_mode:          cat.entryMode,
        price:               priceValue,
        payment_mode:        cat.priceEnabled ? cat.paymentMode : null,
        registration_id:     registrationId,
        format:              cat.format,
        consolation_bracket: cat.consolationBracket,
        gender:              cat.gender,
        level:               cat.level,
      })

    if (catErr) return { error: catErr.message }

    if (shareToken) {
      registrationLinks.push({ categoryName: cat.name.trim(), token: shareToken })
    }
  }

  return { id: tournament.id, registrationLinks }
}
