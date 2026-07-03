import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { generateGroupMatches, generateKnockoutSeeds } from '@/lib/match-generator'
import { computeRanking } from '@/lib/ranking'
import { rulesFromTournament } from '@/lib/match-rules'
import { isSuper8MistoComplete } from '@/lib/super8-misto'
import type { Tournament, Player, Match, Category, Court } from '@/types'
import TournamentHub from './TournamentHub'

// ── Status config ─────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; dot: string; text: string; shape: string }> = {
  draft:       { label: 'Rascunho',        dot: 'bg-[#444444]',               text: 'text-[#888888]',  shape: '○' },
  group_stage: { label: 'Fase de grupos',  dot: 'bg-[#C8F135] animate-pulse', text: 'text-[#C8F135]',  shape: '▶' },
  finals:      { label: 'Finais',          dot: 'bg-amber-400 animate-pulse', text: 'text-amber-400',  shape: '◆' },
  done:        { label: 'Encerrado',       dot: 'bg-emerald-400',             text: 'text-emerald-400', shape: '✓' },
}

// ── Data fetching ─────────────────────────────────────────────

async function getData(id: string) {
  const supabase = await createClient()
  const [{ data: t }, { data: categories }] = await Promise.all([
    supabase.from('tournaments').select('*').eq('id', id).single(),
    supabase.from('categories').select('*').eq('tournament_id', id).order('sort_order').order('created_at'),
  ])
  return {
    tournament:  t as Tournament | null,
    categories: (categories ?? []) as Category[],
  }
}

async function getLegacyData(id: string) {
  const supabase = await createClient()
  const [{ data: players }, { data: matches }, { data: courts }] = await Promise.all([
    supabase.from('players').select('*').eq('tournament_id', id).is('category_id', null).order('position'),
    supabase.from('matches').select('*').eq('tournament_id', id).is('category_id', null),
    supabase.from('courts').select('*').eq('tournament_id', id).order('sort_order'),
  ])
  return {
    players: (players ?? []) as Player[],
    matches: (matches ?? []) as Match[],
    courts:  (courts  ?? []) as Court[],
  }
}

// ── Page ──────────────────────────────────────────────────────

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tournament, categories } = await getData(id)
  if (!tournament) notFound()

  // Legacy mode: tournament has direct players (no categories)
  if (categories.length === 0) {
    const { players, matches, courts } = await getLegacyData(id)

    const rules          = rulesFromTournament(tournament)
    const groupA         = players.filter(p => p.position <= 4)
    const groupB         = players.filter(p => p.position >= 5)
    const groupMatches   = matches.filter(m => m.stage === 'group_a' || m.stage === 'group_b')
    const allGroupDone   = groupMatches.length === 6 && groupMatches.every(m => m.status === 'done')
    const hasFinalsMatches = matches.some(m => m.stage === 'final' || m.stage === 'consolation_final')

    const finalsSeeds = (() => {
      if (!allGroupDone || hasFinalsMatches) return null
      const rankA = computeRanking(groupA, matches.filter(m => m.stage === 'group_a'))
      const rankB = computeRanking(groupB, matches.filter(m => m.stage === 'group_b'))
      if (rankA.length < 4 || rankB.length < 4) return null
      return generateKnockoutSeeds(rankA.map(s => s.player), rankB.map(s => s.player))
    })()

    const matchSeeds = players.length === 8 ? generateGroupMatches(players) : []

    return (
      <TournamentHub
        tournament={tournament}
        players={players}
        matches={matches}
        rules={rules}
        finalsSeeds={finalsSeeds}
        matchSeeds={matchSeeds}
        courts={courts}
      />
    )
  }

  // ── Category mode ─────────────────────────────────────────────
  const mistoCategory = categories.find(c => c.format === 'super8_misto') ?? null
  let revelationReady = false
  if (mistoCategory) {
    const supabase = await createClient()
    const { data: mistoMatches } = await supabase
      .from('matches').select('status').eq('category_id', mistoCategory.id)
    revelationReady = isSuper8MistoComplete((mistoMatches ?? []) as Match[])
  }

  return (
    <CategoryOverview
      tournament={tournament}
      categories={categories}
      revelationReady={revelationReady}
    />
  )
}

// ── Category overview (multiple categories) ───────────────────

function CategoryOverview({ tournament, categories, revelationReady }: {
  tournament: Tournament; categories: Category[]; revelationReady: boolean
}) {
  const active = categories.filter(c => c.status === 'group_stage' || c.status === 'finals')
  const rest   = categories.filter(c => c.status !== 'group_stage' && c.status !== 'finals')

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in lg:py-4">

      {/* Header */}
      <div className="relative rounded-2xl p-5 overflow-hidden" style={{ background: 'linear-gradient(135deg, #161616 0%, #0A0A0A 100%)', border: '1px solid #242424' }}>
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full" style={{ background: 'var(--bt-neon-dim)' }} />
        <div className="absolute -right-2 top-8 w-16 h-16 rounded-full" style={{ background: 'var(--bt-neon-dim)' }} />
        <div className="relative space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Link href="/admin" className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#888888] hover:text-[#F0F0F0] transition-colors">
              ← Torneios
            </Link>
            <div className="flex items-center gap-2">
              <a
                href={`/admin/tournaments/${tournament.id}/settings`}
                className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-[#1C1C1C] text-[#888888] hover:text-[#F0F0F0] transition-colors"
              >
                ⚙️ Configurações
              </a>
              <a
                href={`/t/${tournament.id}/tv`}
                className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-[#1C1C1C] text-[#888888] hover:text-[#F0F0F0] transition-colors"
              >
                📺 Modo TV
              </a>
              {revelationReady && (
                <a
                  href={`/t/${tournament.id}/tv/revelacao`}
                  className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full transition-colors"
                  style={{ background: '#C8F135', color: '#0A0A0A' }}
                >
                  🎉 Cerimônia de Revelação
                </a>
              )}
            </div>
          </div>
          <p className="font-display text-2xl font-bold uppercase leading-tight text-[#F0F0F0]">{tournament.name}</p>
          <p className="text-xs text-[#888888] font-semibold">
            {categories.length} categoria{categories.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Active categories */}
      {active.length > 0 && (
        <section className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#888888] px-0.5">Em andamento</p>
          <div className="stagger space-y-2">
            {active.map(c => <CategoryCard key={c.id} category={c} tournamentId={tournament.id} highlight />)}
          </div>
        </section>
      )}

      {/* Other categories */}
      {rest.length > 0 && (
        <section className="space-y-2">
          {active.length > 0 && (
            <p className="text-[11px] font-black uppercase tracking-widest text-[#888888] px-0.5">Outras categorias</p>
          )}
          <div className="stagger space-y-2">
            {rest.map(c => <CategoryCard key={c.id} category={c} tournamentId={tournament.id} />)}
          </div>
        </section>
      )}

      {/* Empty state */}
      {categories.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <p className="text-5xl">🏸</p>
          <p className="font-bold text-[#888888]">Nenhuma categoria ainda</p>
          <p className="text-sm text-[#888888]">Adicione a primeira categoria abaixo</p>
        </div>
      )}

      {/* Add category button */}
      <Link
        href={`/admin/tournaments/${tournament.id}/categories/new`}
        className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-[#242424] hover:border-[#C8F135]/40 bg-[#161616] hover:bg-[#1C1C1C] text-[#888888] hover:text-[#C8F135] font-bold text-sm py-4 rounded-2xl transition-all"
      >
        <span className="text-base leading-none">+</span>
        Adicionar categoria
      </Link>

    </div>
  )
}

function CategoryCard({ category, tournamentId, highlight = false }: {
  category:     Category
  tournamentId: string
  highlight?:   boolean
}) {
  const cfg = STATUS_CFG[category.status] ?? STATUS_CFG.draft
  return (
    <Link
      href={`/admin/tournaments/${tournamentId}/categories/${category.id}`}
      className={`flex items-center gap-4 rounded-2xl px-4 py-4 border transition-transform active:scale-[0.985] bg-[#161616] ${
        highlight ? 'border-[#C8F135]/30 shadow-md shadow-black/20' : 'border-[#242424]'
      }`}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg font-black shrink-0 ${
        highlight ? 'bg-[#C8F135] text-[#0A0A0A]' : 'bg-[#1C1C1C] text-[#888888] border border-[#242424]'
      }`}>
        {category.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[#F0F0F0] truncate text-[15px]">{category.name}</p>
        <p className="text-xs text-[#888888] mt-0.5">
          {category.max_games} games · TB até {category.tiebreak_to}
        </p>
      </div>
      <div className={`flex items-center gap-1.5 shrink-0 ${cfg.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
        <span className="text-xs font-bold">{cfg.shape} {cfg.label}</span>
      </div>
    </Link>
  )
}
