import { createClient } from '@/lib/supabase/server'
import { computeSuper8MistoResult, isSuper8MistoComplete } from '@/lib/super8-misto'
import type { Tournament, Player, Match, Category } from '@/types'
import RevelationCeremony from './RevelationCeremony'

async function getData(tournamentId: string) {
  const supabase = await createClient()
  const [{ data: t }, { data: cats }] = await Promise.all([
    supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
    supabase.from('categories').select('*').eq('tournament_id', tournamentId),
  ])
  return {
    tournament:  t as Tournament | null,
    categories: (cats ?? []) as Category[],
  }
}

export default async function RevelacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tournament, categories } = await getData(id)

  if (!tournament) {
    return <NotReady tournamentId={id} reason="Torneio não encontrado." />
  }

  const mistoCategory = categories.find(c => c.format === 'super8_misto') ?? null

  if (!mistoCategory) {
    return <NotReady tournamentId={id} reason="Este torneio não tem uma categoria Super Oito Misto." />
  }

  const supabase = await createClient()
  const [{ data: players }, { data: matches }] = await Promise.all([
    supabase.from('players').select('*').eq('category_id', mistoCategory.id).order('position'),
    supabase.from('matches').select('*').eq('category_id', mistoCategory.id),
  ])

  const allPlayers = (players ?? []) as Player[]
  const allMatches = (matches ?? []) as Match[]

  if (!isSuper8MistoComplete(allMatches)) {
    const done = allMatches.filter(m => m.status === 'done').length
    return (
      <NotReady
        tournamentId={id}
        reason={`Aguardando o fim das 32 partidas (${done}/32 concluídas).`}
      />
    )
  }

  const { kingRanking, queenRanking } = computeSuper8MistoResult(allPlayers, allMatches)

  // Suspense-screen stats — computed straight from the real match data.
  const doneMatches   = allMatches.filter(m => m.status === 'done')
  const matchesPlayed = doneMatches.length
  const totalGames    = doneMatches.reduce((sum, m) => sum + (m.score1 ?? 0) + (m.score2 ?? 0), 0)
  const pairKey = (a: string, b: string) => [a, b].sort().join('|')
  const pairSet = new Set<string>()
  for (const m of doneMatches) {
    pairSet.add(pairKey(m.team1_p1, m.team1_p2))
    pairSet.add(pairKey(m.team2_p1, m.team2_p2))
  }
  const durations = doneMatches
    .map(m => m.duration_seconds)
    .filter((d): d is number => d != null)
  const totalDurationSeconds = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) : null

  return (
    <RevelationCeremony
      tournamentName={tournament.name}
      categoryName={mistoCategory.name}
      kingRanking={kingRanking}
      queenRanking={queenRanking}
      stats={{
        matchesPlayed,
        uniquePairs: pairSet.size,
        totalGames,
        totalDurationSeconds,
      }}
    />
  )
}

function NotReady({ tournamentId, reason }: { tournamentId: string; reason: string }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 px-8 text-center"
      style={{ background: '#0A0A0A', color: '#F0F0F0' }}
    >
      <span className="text-6xl">🔒</span>
      <div className="space-y-2">
        <p className="text-2xl font-black">Cerimônia ainda não disponível</p>
        <p className="text-base" style={{ color: '#888888' }}>{reason}</p>
      </div>
      <a
        href={`/tournaments/${tournamentId}`}
        className="mt-4 px-6 py-3 rounded-full font-black text-sm uppercase tracking-widest transition-transform active:scale-95"
        style={{ background: '#C8F135', color: '#0A0A0A' }}
      >
        ← Voltar ao torneio
      </a>
    </div>
  )
}
