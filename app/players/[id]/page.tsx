import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Match, Player } from '@/types'
import { computeRanking } from '@/lib/ranking'
import PlayerProfile from './PlayerProfile'

// ── Data ──────────────────────────────────────────────────────

export interface MatchWithContext extends Match {
  tournament_name: string
  partner_id:      string | null
}

export interface ProfileStats {
  wins:          number
  losses:        number
  winRate:       number
  total:         number
  currentStreak: number
  maxStreak:     number
  gameDiff:      number
  gamesWon:      number
  gamesLost:     number
}

export interface AchievementDef {
  id:        string
  label:     string
  icon:      string
  desc:      string
  unlocked:  boolean
}

export interface GroupRank {
  rank:           number
  totalInGroup:   number
  group:          string
  tournamentName: string
}

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return `hsl(${Math.abs(hash) % 360}, 65%, 45%)`
}

function computeStats(playerId: string, matches: Match[]): ProfileStats {
  let wins = 0, losses = 0, gamesWon = 0, gamesLost = 0, tempStreak = 0, maxStreak = 0

  const chronological = [...matches].reverse()
  for (const m of chronological) {
    if (m.status !== 'done' || m.score1 == null || m.score2 == null) continue
    const onTeam1 = m.team1_p1 === playerId || m.team1_p2 === playerId
    const won     = onTeam1 ? m.score1 > m.score2 : m.score2 > m.score1
    const myGames = onTeam1 ? m.score1 : m.score2
    const opGames = onTeam1 ? m.score2 : m.score1
    if (won) { wins++; tempStreak++; maxStreak = Math.max(maxStreak, tempStreak) }
    else     { losses++; tempStreak = 0 }
    gamesWon  += myGames
    gamesLost += opGames
  }

  let currentStreak = 0
  for (const m of matches) {
    if (m.status !== 'done' || m.score1 == null || m.score2 == null) continue
    const onTeam1 = m.team1_p1 === playerId || m.team1_p2 === playerId
    const won     = onTeam1 ? m.score1 > m.score2 : m.score2 > m.score1
    if (won) currentStreak++; else break
  }

  const total   = wins + losses
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0
  return { wins, losses, winRate, total, currentStreak, maxStreak, gameDiff: gamesWon - gamesLost, gamesWon, gamesLost }
}

function buildAchievements(stats: ProfileStats): AchievementDef[] {
  return [
    { id: 'first_win',    icon: '🏅', label: 'Primeira Vitória',  desc: 'Vencer a primeira partida',       unlocked: stats.wins >= 1        },
    { id: 'played_5',     icon: '🎾', label: '5 Partidas',        desc: 'Disputar 5 partidas',              unlocked: stats.total >= 5       },
    { id: 'played_20',    icon: '🔢', label: '20 Partidas',       desc: 'Disputar 20 partidas',             unlocked: stats.total >= 20      },
    { id: 'wins_5',       icon: '⭐', label: '5 Vitórias',        desc: 'Acumular 5 vitórias',              unlocked: stats.wins >= 5        },
    { id: 'wins_10',      icon: '🌟', label: '10 Vitórias',       desc: 'Acumular 10 vitórias',             unlocked: stats.wins >= 10       },
    { id: 'wins_25',      icon: '💫', label: '25 Vitórias',       desc: 'Acumular 25 vitórias',             unlocked: stats.wins >= 25       },
    { id: 'streak_3',     icon: '🔥', label: 'Em Chamas',         desc: '3 vitórias seguidas',              unlocked: stats.maxStreak >= 3   },
    { id: 'streak_5',     icon: '💥', label: 'Imparável',         desc: '5 vitórias seguidas',              unlocked: stats.maxStreak >= 5   },
    { id: 'rate_60',      icon: '💪', label: 'Consistente 60%',   desc: '60% ou mais de aproveitamento',   unlocked: stats.winRate >= 60 && stats.total >= 5 },
    { id: 'rate_75',      icon: '🎯', label: 'Especialista 75%',  desc: '75% ou mais de aproveitamento',   unlocked: stats.winRate >= 75 && stats.total >= 8 },
    { id: 'rate_90',      icon: '🏆', label: 'Elite 90%',         desc: '90% ou mais de aproveitamento',   unlocked: stats.winRate >= 90 && stats.total >= 10 },
    { id: 'game_diff_10', icon: '📈', label: 'Saldo Positivo',    desc: 'Saldo de games maior que +10',    unlocked: stats.gameDiff >= 10   },
  ]
}

// ── Page ──────────────────────────────────────────────────────

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // 1. Fetch the anchor player record
  const { data: player } = await supabase
    .from('players')
    .select('*, tournaments(name, status)')
    .eq('id', id)
    .single()

  if (!player) notFound()

  const playerName = player.name

  // 2. All player records with this name (cross-tournament)
  const { data: sameNamePlayers } = await supabase
    .from('players')
    .select('id, tournament_id, tournaments(name)')
    .ilike('name', playerName)

  const allPlayerIds    = (sameNamePlayers ?? []).map(p => p.id)
  const tournamentNames = Object.fromEntries(
    (sameNamePlayers ?? []).map(p => {
      const t = p.tournaments as unknown as { name: string } | { name: string }[] | null
      const name = Array.isArray(t) ? t[0]?.name : t?.name
      return [p.id, name ?? '—']
    })
  )
  // tournament_id → name (for rank display)
  const tournamentNameByTid = Object.fromEntries(
    (sameNamePlayers ?? []).map(p => {
      const t = p.tournaments as unknown as { name: string } | { name: string }[] | null
      const name = Array.isArray(t) ? t[0]?.name : t?.name
      return [p.tournament_id as string, name ?? '—']
    })
  )

  // 3. All matches where any of these player IDs appear
  const matchFilters = allPlayerIds.map(pid =>
    `team1_p1.eq.${pid},team1_p2.eq.${pid},team2_p1.eq.${pid},team2_p2.eq.${pid}`
  ).join(',')

  const { data: rawMatches } = await supabase
    .from('matches')
    .select('*')
    .or(matchFilters)
    .order('created_at', { ascending: false })
    .limit(50)

  const matches: Match[] = rawMatches ?? []

  // 4. Resolve opponent names
  const opponentIdSet = new Set<string>()
  for (const m of matches) {
    for (const pid of [m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2]) {
      if (!allPlayerIds.includes(pid)) opponentIdSet.add(pid)
    }
  }

  const { data: opponentRecords } = await supabase
    .from('players')
    .select('id, name')
    .in('id', [...opponentIdSet])

  const nameMap: Record<string, string> = {
    ...Object.fromEntries(allPlayerIds.map(pid => [pid, playerName])),
    ...Object.fromEntries((opponentRecords ?? []).map(p => [p.id, p.name])),
  }

  // Enrich matches with tournament name + partner
  const enrichedMatches: MatchWithContext[] = matches.map(m => {
    const myId     = allPlayerIds.find(pid =>
      m.team1_p1 === pid || m.team1_p2 === pid || m.team2_p1 === pid || m.team2_p2 === pid
    ) ?? id
    const onTeam1  = m.team1_p1 === myId || m.team1_p2 === myId
    const partnerId = onTeam1
      ? (m.team1_p1 === myId ? m.team1_p2 : m.team1_p1)
      : (m.team2_p1 === myId ? m.team2_p2 : m.team2_p1)

    return {
      ...m,
      tournament_name: tournamentNames[myId] ?? '—',
      partner_id:      partnerId !== myId ? partnerId : null,
    }
  })

  // 5. Compute stats (using all matching player IDs)
  const allStats = allPlayerIds.reduce((acc, pid) => {
    const s = computeStats(pid, matches.filter(m =>
      m.team1_p1 === pid || m.team1_p2 === pid ||
      m.team2_p1 === pid || m.team2_p2 === pid
    ))
    return {
      wins:          acc.wins  + s.wins,
      losses:        acc.losses + s.losses,
      gamesWon:      acc.gamesWon  + s.gamesWon,
      gamesLost:     acc.gamesLost + s.gamesLost,
      total:         acc.total + s.total,
      maxStreak:     Math.max(acc.maxStreak, s.maxStreak),
      currentStreak: s.currentStreak, // from anchor ID
      winRate:       0,
      gameDiff:      0,
    }
  }, { wins: 0, losses: 0, gamesWon: 0, gamesLost: 0, total: 0, maxStreak: 0, currentStreak: 0, winRate: 0, gameDiff: 0 })

  const stats: ProfileStats = {
    ...allStats,
    winRate:  allStats.total > 0 ? Math.round((allStats.wins / allStats.total) * 100) : 0,
    gameDiff: allStats.gamesWon - allStats.gamesLost,
  }

  const achievements = buildAchievements(stats)
  const color        = avatarColor(playerName)

  // 6. Current group rank — derive from most recent group-stage matches
  const GROUP_STAGES = new Set([
    'group_a','group_b','group_c','group_d',
    'group_e','group_f','group_g','group_h',
  ])
  const recentGroupMatch = matches.find(m => GROUP_STAGES.has(m.stage))
  let currentGroupRank: GroupRank | null = null

  if (recentGroupMatch) {
    const tId   = recentGroupMatch.tournament_id
    const stage = recentGroupMatch.stage
    const cId   = recentGroupMatch.category_id

    // All matches in the same group
    const groupMatches = matches.filter(m =>
      m.tournament_id === tId &&
      m.stage         === stage &&
      m.category_id   === cId
    )

    // Collect every player ID that appears in those matches
    const pidSet = new Set<string>()
    for (const m of groupMatches) {
      for (const pid of [m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2]) {
        if (pid) pidSet.add(pid)
      }
    }

    // Build synthetic Player objects (enough for computeRanking)
    const groupPlayers: Player[] = [...pidSet].map(pid => ({
      id:            pid,
      name:          nameMap[pid] ?? pid,
      tournament_id: tId,
      category_id:   cId,
      position:      0,
      gender:        'M',
    }))

    const ranking = computeRanking(groupPlayers, groupMatches)
    const myEntry = ranking.find(r => allPlayerIds.includes(r.player.id))

    if (myEntry) {
      const groupLabel = stage.replace('group_', 'Grupo ').toUpperCase()
      currentGroupRank = {
        rank:           myEntry.rank,
        totalInGroup:   ranking.length,
        group:          groupLabel,
        tournamentName: tournamentNameByTid[tId] ?? '—',
      }
    }
  }

  return (
    <PlayerProfile
      player={player}
      matches={enrichedMatches}
      nameMap={nameMap}
      allPlayerIds={allPlayerIds}
      stats={stats}
      achievements={achievements}
      avatarColor={color}
      currentGroupRank={currentGroupRank}
    />
  )
}
