import type { Match, Player, PlayerStats } from '@/types'

/**
 * Compute group rankings from completed matches.
 * Sorted by: wins DESC → game difference DESC → games won DESC
 */
export function computeRanking(
  players: Player[],
  matches: Match[],
): PlayerStats[] {
  const statsMap = new Map<string, PlayerStats>()

  for (const p of players) {
    statsMap.set(p.id, {
      player:    p,
      wins:      0,
      losses:    0,
      gamesWon:  0,
      gamesLost: 0,
      gameDiff:  0,
      rank:      0,
    })
  }

  for (const m of matches) {
    if (m.status !== 'done' || m.score1 == null || m.score2 == null) continue

    const team1 = [m.team1_p1, m.team1_p2]
    const team2 = [m.team2_p1, m.team2_p2]
    const t1Won = m.score1 > m.score2

    for (const pid of team1) {
      const s = statsMap.get(pid)
      if (!s) continue
      t1Won ? s.wins++ : s.losses++
      s.gamesWon  += m.score1
      s.gamesLost += m.score2
    }
    for (const pid of team2) {
      const s = statsMap.get(pid)
      if (!s) continue
      t1Won ? s.losses++ : s.wins++
      s.gamesWon  += m.score2
      s.gamesLost += m.score1
    }
  }

  const stats = [...statsMap.values()].map(s => ({
    ...s,
    gameDiff: s.gamesWon - s.gamesLost,
  }))

  stats.sort((a, b) => {
    if (b.wins      !== a.wins)      return b.wins      - a.wins
    if (b.gameDiff  !== a.gameDiff)  return b.gameDiff  - a.gameDiff
    return b.gamesWon - a.gamesWon
  })

  stats.forEach((s, i) => { s.rank = i + 1 })

  return stats
}
