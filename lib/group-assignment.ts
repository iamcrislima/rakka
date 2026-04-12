/**
 * Randomly shuffle an array (Fisher-Yates).
 */
export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Assign positions 1-8 to 8 player names randomly.
 * Positions 1-4 → Group A, 5-8 → Group B.
 */
export function assignGroups(names: string[]): Array<{ name: string; position: number }> {
  const shuffled = shuffle(names.map(n => n.trim()).filter(Boolean))
  return shuffled.map((name, i) => ({ name, position: i + 1 }))
}
