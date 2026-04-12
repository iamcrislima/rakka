export type TournamentStatus = 'draft' | 'group_stage' | 'finals' | 'done'
export type MatchStatus      = 'pending' | 'done'
export type Stage =
  | 'group_a' | 'group_b'
  | 'sf' | 'csf'
  | 'final' | 'consolation_final'

export interface Tournament {
  id:         string
  name:       string
  status:     TournamentStatus
  created_at: string
}

export interface Player {
  id:            string
  tournament_id: string
  name:          string
  position:      number   // 1-8
}

export interface Match {
  id:            string
  tournament_id: string
  stage:         Stage
  round:         number
  team1_p1:      string   // player id
  team1_p2:      string
  team2_p1:      string
  team2_p2:      string
  score1:        number | null
  score2:        number | null
  status:        MatchStatus
  created_at:    string
}

// ── Enriched types (joined with players) ─────────────────────

export interface MatchWithPlayers extends Omit<Match, 'team1_p1'|'team1_p2'|'team2_p1'|'team2_p2'> {
  t1p1: Player
  t1p2: Player
  t2p1: Player
  t2p2: Player
}

export interface PlayerStats {
  player:      Player
  wins:        number
  losses:      number
  gamesWon:    number
  gamesLost:   number
  gameDiff:    number
  rank:        number
}
