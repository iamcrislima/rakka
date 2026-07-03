export type TournamentStatus = 'draft' | 'group_stage' | 'finals' | 'done'
export type MatchStatus      = 'pending' | 'done'
export type Stage =
  | 'group_a' | 'group_b' | 'group_c' | 'group_d'
  | 'group_e' | 'group_f' | 'group_g' | 'group_h'
  | 'final' | 'consolation_final'

export type RuleType = 'standard' | 'sum_of_games'

/**
 * 'standard'     — classic win-by-2 / tiebreak logic (max_games, deuce, tiebreak_to)
 * 'sum_of_games' — final score just needs s1 + s2 === targetSum, no advantage,
 *                  no tiebreak (e.g. targetSum 7 → 7-0, 6-1, 5-2, 4-3 only)
 */
export interface MatchRules {
  type:        RuleType
  max_games:   4 | 6
  deuce:       'tiebreak' | 'super_tiebreak'
  tiebreak_to: 7 | 10
  targetSum:   number | null
}

export interface Tournament {
  id:          string
  name:        string
  status:      TournamentStatus
  type:        'super' | 'doubles'
  max_games:   number
  deuce:       string
  tiebreak_to: number
  rule_type:   string
  target_sum:  number | null
  created_at:  string
}

export type PlayerGender = 'M' | 'F'

export interface Player {
  id:            string
  tournament_id: string
  category_id:   string | null
  name:          string
  position:      number
  gender:        PlayerGender
}

export interface Match {
  id:              string
  tournament_id:   string
  category_id:     string | null
  court_id:        string | null
  stage:           Stage
  round:           number
  team1_p1:        string   // player id
  team1_p2:        string
  team2_p1:        string
  team2_p2:        string
  score1:          number | null
  score2:          number | null
  status:          MatchStatus
  override_active: boolean
  queue_position:  number | null
  started_at:      string | null
  duration_seconds: number | null
  created_at:      string
}

export interface Court {
  id:            string
  tournament_id: string
  name:          string
  sort_order:    number
  created_at:    string
}

export type CategoryGender = 'mens' | 'womens' | 'mixed'
export type CategoryLevel  = 'E' | 'D' | 'C' | 'B' | 'Open'
export type CategoryFormat = 'round_robin' | 'group_playoffs' | 'super8_misto'

// ── Event mural ────────────────────────────────────────────────

export type MuralPhotoStatus = 'pending' | 'approved' | 'rejected'

export interface MuralPhoto {
  id:            string
  tournament_id: string
  storage_path:  string
  status:        MuralPhotoStatus
  created_at:    string
  moderated_at:  string | null
}

export interface Category {
  id:                  string
  tournament_id:       string
  name:                string
  status:              TournamentStatus
  max_games:           number
  deuce:               string
  tiebreak_to:         number
  rule_type:           string
  target_sum:          number | null
  sort_order:          number
  scheduled_at:        string | null
  player_limit:        number
  entry_mode:          'manual' | 'registration'
  price:               number | null
  payment_mode:        'individual' | 'pair' | null
  registration_id:     string | null
  format:              CategoryFormat
  consolation_bracket: boolean
  gender:              CategoryGender | null
  level:               CategoryLevel | null
  created_at:          string
}

// ── League types ─────────────────────────────────────────────

/**
 * Scoring rules: position (1-8) → points awarded.
 * Positions 5+6 share key "5", positions 7+8 share key "7".
 */
export type ScoringRules = Record<string, number>

export interface League {
  id:          string
  name:        string
  description: string | null
  scoring:     ScoringRules
  user_id:     string | null
  created_at:  string
}

export interface LeagueStage {
  id:            string
  league_id:     string
  tournament_id: string
  stage_number:  number
  created_at:    string
}

export interface TournamentFinish {
  playerId:       string
  playerName:     string
  normalizedName: string
  position:       number  // 1-8
  points:         number
  tournamentId:   string
  tournamentName: string
  stageNumber:    number
}

// ── TV content ────────────────────────────────────────────────

export type TVContentType = 'image' | 'promotion' | 'announcement'

export interface TVContent {
  id:            string
  tournament_id: string
  type:          TVContentType
  title:         string | null
  body:          string | null
  image_url:     string | null
  duration:      number
  frequency:     number | null  // minutes between fullscreen appearances (image type only)
  enabled:       boolean
  sort_order:    number
  created_at:    string
}

export interface LeaguePlayerStats {
  normalizedName: string
  displayName:    string
  totalPoints:    number
  finishes:       TournamentFinish[]
  rank:           number
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

// ── Registration types ────────────────────────────────────

export type RegistrantStatus = 'confirmed' | 'waiting'

export interface Registration {
  id:           string
  share_token:  string
  name:         string
  player_limit: number
  is_open:      boolean
  user_id:      string | null
  created_at:   string
}

export interface Registrant {
  id:              string
  registration_id: string
  name:            string
  partner_name:    string | null
  payment_status:  'pending' | 'paid' | 'waived' | null
  status:          RegistrantStatus
  joined_at:       string
}
