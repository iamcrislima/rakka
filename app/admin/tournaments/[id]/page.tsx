import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { generateGroupMatches, generateKnockoutSeeds } from '@/lib/match-generator'
import { computeRanking } from '@/lib/ranking'
import { rulesFromTournament } from '@/lib/match-rules'
import type { Tournament, Player, Match, Category, Court } from '@/types'
import TournamentHub from './TournamentHub'
import QuickActions, { type QuickActionSpec } from './QuickActions'
import LiveGamesPanel, { type LiveGameCourt } from './LiveGamesPanel'
import BackLink from '@/app/components/BackLink'
import AdminPageContainer from '@/app/components/AdminPageContainer'

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

/** Tournament-wide players + matches + courts, across every category — for
 *  the overview header stats, per-category progress bars, and the live
 *  games panel (which needs court assignment, queue order, and team player
 *  ids on top of just status/started_at). Doesn't touch any category/match
 *  business logic, just reads. */
async function getCategoryModeExtras(id: string) {
  const supabase = await createClient()
  const [{ data: players }, { data: matches }, { data: courts }] = await Promise.all([
    supabase.from('players').select('id, name, category_id').eq('tournament_id', id),
    supabase.from('matches')
      .select('id, category_id, court_id, status, started_at, queue_position, team1_p1, team1_p2, team2_p1, team2_p2')
      .eq('tournament_id', id),
    supabase.from('courts').select('*').eq('tournament_id', id).order('sort_order'),
  ])
  return {
    players: (players ?? []) as Pick<Player, 'id' | 'name' | 'category_id'>[],
    matches: (matches ?? []) as Pick<Match,
      'id' | 'category_id' | 'court_id' | 'status' | 'started_at' | 'queue_position' |
      'team1_p1' | 'team1_p2' | 'team2_p1' | 'team2_p2'
    >[],
    courts: (courts ?? []) as Court[],
  }
}

/** Groups live (started, unconfirmed) matches by court, one card per busy
 *  court — cross-category by design, since a court cycles through whichever
 *  categories share it. Each card also carries the next queued match on
 *  that same court (which may belong to a different category). */
function buildLiveCourts(
  tournament: Tournament,
  courts:     Court[],
  matches:    Pick<Match, 'id' | 'category_id' | 'court_id' | 'status' | 'started_at' | 'queue_position' | 'team1_p1' | 'team1_p2' | 'team2_p1' | 'team2_p2'>[],
  playerName: Record<string, string>,
  categoryName: Record<string, string>,
): LiveGameCourt[] {
  const matchup = (m: Pick<Match, 'team1_p1' | 'team1_p2' | 'team2_p1' | 'team2_p2'>) =>
    ({
      team1: `${playerName[m.team1_p1] ?? '?'} + ${playerName[m.team1_p2] ?? '?'}`,
      team2: `${playerName[m.team2_p1] ?? '?'} + ${playerName[m.team2_p2] ?? '?'}`,
    })
  const catName = (categoryId: string | null) => categoryId ? (categoryName[categoryId] ?? '') : tournament.name

  const pending = matches.filter(m => m.status === 'pending')
  const live    = pending.filter(m => m.started_at != null)
  const queued  = pending.filter(m => m.started_at == null && m.court_id)

  const queueByCourtId = new Map<string, typeof queued>()
  for (const m of queued) {
    const arr = queueByCourtId.get(m.court_id!) ?? []
    arr.push(m)
    queueByCourtId.set(m.court_id!, arr)
  }
  for (const arr of queueByCourtId.values()) {
    arr.sort((a, b) => (a.queue_position ?? Infinity) - (b.queue_position ?? Infinity))
  }

  return courts
    .map((court): LiveGameCourt | null => {
      const match = live.find(m => m.court_id === court.id)
      if (!match) return null
      const next = (queueByCourtId.get(court.id) ?? [])[0]
      return {
        courtId:   court.id,
        courtName: court.name,
        match: {
          id:           match.id,
          categoryId:   match.category_id,
          categoryName: catName(match.category_id),
          startedAt:    match.started_at!,
          ...matchup(match),
        },
        next: next ? { id: next.id, categoryName: catName(next.category_id), ...matchup(next) } : null,
      }
    })
    .filter((c): c is LiveGameCourt => c !== null)
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
  const { players: allPlayers, matches: allMatches, courts: allCourts } = await getCategoryModeExtras(id)

  // ── Per-category match progress (used by both the header stats and ──
  // each category card's progress bar)
  const progressByCategory: Record<string, { done: number; total: number }> = {}
  for (const cat of categories) {
    const catMatches = allMatches.filter(m => m.category_id === cat.id)
    progressByCategory[cat.id] = {
      total: catMatches.length,
      done:  catMatches.filter(m => m.status === 'done').length,
    }
  }
  const liveCountByCategory: Record<string, number> = {}
  for (const cat of categories) {
    liveCountByCategory[cat.id] = allMatches.filter(
      m => m.category_id === cat.id && m.status === 'pending' && m.started_at != null
    ).length
  }

  const stats = {
    totalPlayers:    allPlayers.length,
    totalCategories: categories.length,
    liveMatchesNow:  allMatches.filter(m => m.status === 'pending' && m.started_at != null).length,
    matchesDone:     allMatches.filter(m => m.status === 'done').length,
    matchesTotal:    allMatches.length,
  }

  const playerName   = Object.fromEntries(allPlayers.map(p => [p.id, p.name]))
  const categoryName = Object.fromEntries(categories.map(c => [c.id, c.name]))
  const liveCourts    = buildLiveCourts(tournament, allCourts, allMatches, playerName, categoryName)

  return (
    <CategoryOverview
      tournament={tournament}
      categories={categories}
      stats={stats}
      progressByCategory={progressByCategory}
      liveCountByCategory={liveCountByCategory}
      liveCourts={liveCourts}
    />
  )
}

// ── Category overview (multiple categories) ───────────────────

interface TournamentStats {
  totalPlayers:    number
  totalCategories: number
  liveMatchesNow:  number
  matchesDone:     number
  matchesTotal:    number
}

function CategoryOverview({ tournament, categories, stats, progressByCategory, liveCountByCategory, liveCourts }: {
  tournament:           Tournament
  categories:           Category[]
  stats:                TournamentStats
  progressByCategory:   Record<string, { done: number; total: number }>
  liveCountByCategory:  Record<string, number>
  liveCourts:           LiveGameCourt[]
}) {
  const active = categories.filter(c => c.status === 'group_stage' || c.status === 'finals')
  const rest   = categories.filter(c => c.status !== 'group_stage' && c.status !== 'finals')
  const statusCfg = STATUS_CFG[tournament.status] ?? STATUS_CFG.draft

  const categoryHref = (categoryId: string) => `/admin/tournaments/${tournament.id}/categories/${categoryId}`

  // "Jogadores" — direct when there's only one place it could mean,
  // otherwise ask which category (per spec: ambiguity is purely category count).
  const playersAction: QuickActionSpec = categories.length === 1
    ? { key: 'players', icon: '👤', label: 'Jogadores', href: categoryHref(categories[0].id) }
    : {
        key: 'players', icon: '👤', label: 'Jogadores',
        options: categories.map(c => ({ id: c.id, name: c.name, href: categoryHref(c.id) })),
      }

  // "Resultados" — direct to the single most-active category when
  // that's unambiguous (one active category, or one with a live match right
  // now); otherwise ask among the active ones.
  const resultAction: QuickActionSpec = (() => {
    const base = { key: 'result', icon: '📝', label: 'Resultados', primary: true as const }
    if (categories.length === 1) return { ...base, href: categoryHref(categories[0].id) }
    if (active.length === 1) return { ...base, href: categoryHref(active[0].id) }
    if (active.length === 0) {
      return { ...base, options: categories.map(c => ({ id: c.id, name: c.name, href: categoryHref(c.id) })) }
    }
    const withLive = active.filter(c => (liveCountByCategory[c.id] ?? 0) > 0)
    if (withLive.length === 1) return { ...base, href: categoryHref(withLive[0].id) }
    return { ...base, options: active.map(c => ({ id: c.id, name: c.name, href: categoryHref(c.id) })) }
  })()

  const quickActions: QuickActionSpec[] = [
    resultAction,
    playersAction,
    { key: 'courts', icon: '🏟️', label: 'Quadras', href: `/admin/tournaments/${tournament.id}/tv-admin` },
    { key: 'settings', icon: '⚙️', label: 'Configurações', href: `/admin/tournaments/${tournament.id}/settings` },
    { key: 'tv', icon: '📺', label: 'Modo TV', href: `/t/${tournament.id}/tv`, newTab: true },
  ]

  return (
    <AdminPageContainer className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="relative rounded-2xl p-5 overflow-hidden" style={{ background: 'linear-gradient(135deg, #161616 0%, #0A0A0A 100%)', border: '1px solid #242424' }}>
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full" style={{ background: 'var(--bt-neon-dim)' }} />
        <div className="absolute -right-2 top-8 w-16 h-16 rounded-full" style={{ background: 'var(--bt-neon-dim)' }} />
        <div className="relative space-y-3">
          <BackLink href="/admin" label="Torneios" className="text-[10px] font-black uppercase tracking-widest text-[#888888] hover:text-[#F0F0F0]" />
          <div className="space-y-1.5">
            <p className="font-display text-2xl font-bold uppercase leading-tight text-[#F0F0F0]">{tournament.name}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${statusCfg.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusCfg.dot}`} />
                {statusCfg.shape} {statusCfg.label}
              </span>
              <span className="text-xs text-[#888888] font-semibold">
                · Criado em {new Date(tournament.created_at).toLocaleDateString('pt-BR')}
              </span>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <StatCard icon="👥" value={String(stats.totalPlayers)} label="Jogadores" />
            <StatCard icon="🏆" value={String(stats.totalCategories)} label={`Categoria${stats.totalCategories !== 1 ? 's' : ''}`} />
            <StatCard icon="🔴" value={String(stats.liveMatchesNow)} label="Ao vivo agora" accent={stats.liveMatchesNow > 0} />
            <StatCard icon="📊" value={`${stats.matchesDone}/${stats.matchesTotal}`} label="Partidas" />
          </div>
        </div>
      </div>

      {/* Jogos ao vivo — cross-category, one card per busy court */}
      <LiveGamesPanel tournamentId={tournament.id} courts={liveCourts} />

      {/* Quick actions */}
      <QuickActions actions={quickActions} />

      {/* Active categories */}
      {active.length > 0 && (
        <section className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#888888] px-0.5">Em andamento</p>
          <div className="stagger grid grid-cols-1 lg:grid-cols-2 gap-3">
            {active.map(c => (
              <CategoryCard key={c.id} category={c} tournamentId={tournament.id} progress={progressByCategory[c.id]} highlight />
            ))}
          </div>
        </section>
      )}

      {/* Other categories */}
      {rest.length > 0 && (
        <section className="space-y-2">
          {active.length > 0 && (
            <p className="text-[11px] font-black uppercase tracking-widest text-[#888888] px-0.5">Outras categorias</p>
          )}
          <div className="stagger grid grid-cols-1 lg:grid-cols-2 gap-3">
            {rest.map(c => (
              <CategoryCard key={c.id} category={c} tournamentId={tournament.id} progress={progressByCategory[c.id]} />
            ))}
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

    </AdminPageContainer>
  )
}

function StatCard({ icon, value, label, accent = false }: {
  icon: string; value: string; label: string; accent?: boolean
}) {
  return (
    <div className="bg-[#111111]/60 border border-[#242424] rounded-xl px-3 py-2.5 flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <span className="text-xs leading-none">{icon}</span>
        <span className={`font-display text-lg font-bold tabular-nums leading-none ${accent ? 'text-[#C8F135]' : 'text-[#F0F0F0]'}`}>
          {value}
        </span>
      </div>
      <span className="text-[10px] font-bold text-[#888888] uppercase tracking-wide truncate">{label}</span>
    </div>
  )
}

function CategoryCard({ category, tournamentId, highlight = false, progress }: {
  category:     Category
  tournamentId: string
  highlight?:   boolean
  progress?:    { done: number; total: number }
}) {
  const cfg = STATUS_CFG[category.status] ?? STATUS_CFG.draft
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
  return (
    <Link
      href={`/admin/tournaments/${tournamentId}/categories/${category.id}`}
      className={`flex flex-col gap-3 rounded-2xl px-4 py-4 border transition-transform active:scale-[0.985] bg-[#161616] ${
        highlight ? 'border-[#C8F135]/30 shadow-md shadow-black/20' : 'border-[#242424]'
      }`}
    >
      <div className="flex items-center gap-4">
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
      </div>

      {progress && progress.total > 0 && (
        <div className="space-y-1.5">
          <div className="h-1.5 rounded-full bg-[#0A0A0A] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: highlight ? '#C8F135' : '#4b5563' }}
            />
          </div>
          <p className="text-[11px] font-bold text-[#888888]">
            {progress.done}/{progress.total} partidas concluídas
          </p>
        </div>
      )}
    </Link>
  )
}
