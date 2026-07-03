import type { Court, Match } from '@/types'

// ── Stage sort priority ───────────────────────────────────────

const STAGE_SORT: Record<string, number> = {
  group_a: 0, group_b: 1, consolation_final: 2, final: 3,
}

// ── Public API ────────────────────────────────────────────────

export interface AssignOptions {
  /** When true, all group_a matches stay on one court and group_b on another. */
  sameGroupSameCourt: boolean
}

export interface AssignResult {
  /** matchId → courtId */
  assignment: Record<string, string>
  /** matchId → queue_position (0-indexed, per court) */
  positions:  Record<string, number>
  /** matchId → reason the match was skipped (e.g., no courts available) */
  skipped:    Record<string, string>
  /** Per-court match count */
  courtLoad:  Record<string, number>
}

/**
 * Distributes pending matches across courts.
 *
 * Algorithm:
 *   0. Matches that already have a court_id/queue_position are PINNED — they
 *      keep their current court and just occupy their existing slot depth.
 *      This makes the function safe to re-run after the court pool grows
 *      (e.g. category B's courts come online at 11h): already-playing
 *      category A matches never get bounced to a different court.
 *   1. Sort the remaining (unassigned) matches: earlier category.scheduled_at
 *      → group rounds → finals.
 *   2. Maintain a per-court "time-slot queue" (each position = one simultaneous slot).
 *   3. For each match, pick the conflict-free, least-loaded court.
 *      A conflict exists when a player appears in another court's match at the
 *      same time-slot (same queue depth).
 *   4. When sameGroupSameCourt is on, prefer the court already used for that group.
 *
 * @param courts           Courts sorted by sort_order.
 * @param matches          Pending matches only (already-assigned ones included — they're pinned, not reshuffled).
 * @param categorySchedule categoryId → ISO start time (null = starts immediately).
 * @param options
 */
export function assignCourts(
  courts:           Court[],
  matches:          Match[],
  categorySchedule: Record<string, string | null>,
  options:          AssignOptions = { sameGroupSameCourt: false },
): AssignResult {

  const assignment: Record<string, string> = {}
  const positions:  Record<string, number> = {}
  const skipped:    Record<string, string> = {}
  const courtLoad:  Record<string, number> = Object.fromEntries(courts.map(c => [c.id, 0]))
  const courtPos:   Record<string, number> = {}   // courtId → next queue_position

  if (!courts.length || !matches.length) {
    return { assignment, positions, skipped, courtLoad }
  }

  const courtIds = new Set(courts.map(c => c.id))

  // ── Pinned (already-assigned) matches keep their court — never reshuffled ──
  const pinned     = matches.filter(m => m.court_id && courtIds.has(m.court_id))
  const unassigned = matches.filter(m => !(m.court_id && courtIds.has(m.court_id)))

  // ── Sort only the unassigned matches ─────────────────────────
  const sorted = [...unassigned].sort((a, b) => {
    const tA = startMs(a.category_id, categorySchedule)
    const tB = startMs(b.category_id, categorySchedule)
    if (tA !== tB) return tA - tB
    const sA = STAGE_SORT[a.stage] ?? 0
    const sB = STAGE_SORT[b.stage] ?? 0
    if (sA !== sB) return sA - sB
    return a.round - b.round
  })

  // ── Per-court slot queues (each entry = Set of player IDs at that depth) ──
  const queues = new Map<string, Set<string>[]>()
  for (const c of courts) queues.set(c.id, [])

  // Track which court "owns" each group stage (for sameGroupSameCourt)
  const groupOwner: Record<string, string> = {}   // stage key → courtId

  // ── Seed queues with pinned matches, in queue_position order ───
  for (const match of [...pinned].sort((a, b) => (a.queue_position ?? 0) - (b.queue_position ?? 0))) {
    const courtId = match.court_id!
    const queue   = queues.get(courtId)!
    const depth   = match.queue_position ?? queue.length
    queue[depth]  = playerSet(match)
    assignment[match.id] = courtId
    positions[match.id]  = depth
    courtPos[courtId]    = Math.max(courtPos[courtId] ?? 0, depth + 1)
    courtLoad[courtId]   = (courtLoad[courtId] ?? 0) + 1

    if (options.sameGroupSameCourt && !groupOwner[match.stage]) {
      const isFinals = match.stage === 'final' || match.stage === 'consolation_final'
      if (!isFinals) groupOwner[match.stage] = courtId
    }
  }

  // ── Assign the remaining matches ─────────────────────────────
  for (const match of sorted) {
    const players = playerSet(match)

    // Build ordered candidate list
    const candidates = buildCandidates(courts, match, groupOwner, options)

    // Find conflict-free, least-loaded court
    const chosen = chooseCourt(candidates, queues, players)

    if (!chosen) {
      skipped[match.id] = 'Nenhuma quadra disponível'
      continue
    }

    const queue = queues.get(chosen.id)!
    queue.push(players)
    assignment[match.id] = chosen.id
    positions[match.id]  = courtPos[chosen.id] ?? 0
    courtPos[chosen.id]  = (courtPos[chosen.id] ?? 0) + 1
    courtLoad[chosen.id] = (courtLoad[chosen.id] ?? 0) + 1

    // Record group ownership on first assignment
    if (options.sameGroupSameCourt && !groupOwner[match.stage]) {
      const isFinals = match.stage === 'final' || match.stage === 'consolation_final'
      if (!isFinals) groupOwner[match.stage] = chosen.id
    }
  }

  return { assignment, positions, skipped, courtLoad }
}

// ── Helpers ───────────────────────────────────────────────────

function startMs(categoryId: string | null, schedule: Record<string, string | null>): number {
  if (!categoryId) return 0
  const iso = schedule[categoryId]
  return iso ? new Date(iso).getTime() : 0
}

function playerSet(m: Match): Set<string> {
  return new Set([m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2])
}

/**
 * Build the ordered list of candidate courts for a match.
 * Preferred court (from sameGroupSameCourt) comes first.
 */
function buildCandidates(
  courts:     Court[],
  match:      Match,
  groupOwner: Record<string, string>,
  options:    AssignOptions,
): Court[] {
  if (!options.sameGroupSameCourt) return courts

  const isFinals = match.stage === 'final' || match.stage === 'consolation_final'
  if (isFinals) {
    // Finals go to the least-loaded court (handled by chooseCourt), no preference
    return courts
  }

  const preferred = groupOwner[match.stage]
  if (!preferred) return courts

  return [
    ...courts.filter(c => c.id === preferred),
    ...courts.filter(c => c.id !== preferred),
  ]
}

/**
 * Pick the conflict-free, least-loaded court.
 * Conflict = a player appears in another court's match at the same time-slot depth.
 * Falls back to least-loaded if every court has a conflict.
 */
function chooseCourt(
  candidates: Court[],
  queues:     Map<string, Set<string>[]>,
  players:    Set<string>,
): Court | null {
  if (!candidates.length) return null

  let best:          Court | null = null
  let bestDepth:     number       = Infinity
  let fallback:      Court | null = null
  let fallbackDepth: number       = Infinity

  for (const court of candidates) {
    const queue = queues.get(court.id)!
    const depth = queue.length                    // slot this match would occupy

    // Least-loaded fallback (used only if no conflict-free option exists)
    if (depth < fallbackDepth) { fallbackDepth = depth; fallback = court }

    // Check sibling courts at the same depth
    let conflict = false
    for (const [otherId, otherQueue] of queues) {
      if (otherId === court.id) continue
      const sibling = otherQueue[depth]
      if (!sibling) continue
      for (const p of players) {
        if (sibling.has(p)) { conflict = true; break }
      }
      if (conflict) break
    }

    if (!conflict && depth < bestDepth) {
      bestDepth = depth
      best      = court
    }
  }

  return best ?? fallback
}
