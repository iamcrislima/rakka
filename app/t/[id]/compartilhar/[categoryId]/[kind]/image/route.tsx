import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createClient } from '@/lib/supabase/server'
import { computeSuper8MistoResult } from '@/lib/super8-misto'
import type { Match, Player } from '@/types'

export const dynamic = 'force-dynamic'

const W = 1080
const H = 1920

const KING_ACCENT  = '#C8F135'
const QUEEN_ACCENT = '#f472b6'

/** Deterministic-enough scatter for a static image — doesn't need to be
 *  seeded, this is generated fresh per share/download anyway. */
function confettiPieces(accent: string) {
  const colors = [accent, '#FFFFFF', KING_ACCENT]
  return Array.from({ length: 40 }, (_, i) => ({
    left:   Math.random() * W,
    top:    Math.random() * (H * 0.65),
    size:   8 + Math.random() * 10,
    rotate: Math.random() * 360,
    color:  colors[i % colors.length],
  }))
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; categoryId: string; kind: string }> },
) {
  const { id, categoryId, kind } = await params
  if (kind !== 'rei' && kind !== 'rainha') {
    return new Response('Tipo inválido', { status: 400 })
  }

  const supabase = await createClient()
  const [{ data: t }, { data: cat }, { data: players }, { data: matches }] = await Promise.all([
    supabase.from('tournaments').select('name').eq('id', id).single(),
    supabase.from('categories').select('name').eq('id', categoryId).eq('tournament_id', id).single(),
    supabase.from('players').select('*').eq('category_id', categoryId),
    supabase.from('matches').select('*').eq('category_id', categoryId),
  ])

  if (!t || !cat) return new Response('Não encontrado', { status: 404 })

  const { kingRanking, queenRanking } = computeSuper8MistoResult(
    (players ?? []) as Player[],
    (matches ?? []) as Match[],
  )
  const ranking  = kind === 'rei' ? kingRanking : queenRanking
  const champion = ranking[0]
  if (!champion) return new Response('Sem campeão ainda', { status: 404 })

  const accent = kind === 'rei' ? KING_ACCENT : QUEEN_ACCENT
  const title  = kind === 'rei' ? 'Rei da Quadra' : 'Rainha da Quadra'

  const logoData = await readFile(join(process.cwd(), 'public/rakka-logo-full.png'), 'base64')
  const logoSrc  = `data:image/png;base64,${logoData}`

  const pieces = confettiPieces(accent)

  return new ImageResponse(
    (
      <div
        style={{
          width: W, height: H, display: 'flex', flexDirection: 'column',
          position: 'relative', background: '#0A0A0A', overflow: 'hidden',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Ambient glow */}
        <div style={{
          position: 'absolute', top: -160, right: -160, width: 520, height: 520,
          borderRadius: 9999, background: `${accent}22`, display: 'flex',
        }} />

        {/* Confetti */}
        {pieces.map((p, i) => (
          <div
            key={i}
            style={{
              position: 'absolute', left: p.left, top: p.top,
              width: p.size, height: p.size * 1.6, borderRadius: 3,
              background: p.color, opacity: 0.85,
              transform: `rotate(${p.rotate}deg)`,
              display: 'flex',
            }}
          />
        ))}

        {/* Content column */}
        <div style={{
          position: 'relative', display: 'flex', flexDirection: 'column',
          alignItems: 'center', width: '100%', height: '100%',
          padding: '90px 70px', boxSizing: 'border-box',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={280} height={Math.round(280 * (135 / 900))} alt="Rakka" />

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 70, gap: 10 }}>
            <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, letterSpacing: 4, color: '#888888', textTransform: 'uppercase' }}>
              {t.name as string}
            </div>
            <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: '#F0F0F0' }}>
              {cat.name as string}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 90, gap: 24 }}>
            <div style={{
              display: 'flex', fontSize: 40, fontWeight: 900, letterSpacing: 6,
              textTransform: 'uppercase', color: accent,
            }}>
              {title}
            </div>
            <div style={{ display: 'flex', fontSize: 150 }}>🏆</div>
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            marginTop: 40, padding: '36px 56px', borderRadius: 40,
            border: `4px solid ${accent}`,
            background: `${accent}1A`,
            maxWidth: '100%',
          }}>
            <div style={{
              display: 'flex', fontSize: 84, fontWeight: 900, color: '#FFFFFF',
              textAlign: 'center', textTransform: 'uppercase', maxWidth: 880,
            }}>
              {champion.player.name}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginTop: 56 }}>
            <StatBlock value={String(champion.wins)}  label="Vitórias" color={accent} />
            <StatBlock value={String(champion.losses)} label="Derrotas" color="#F0F0F0" />
            <StatBlock value={`${champion.gameDiff > 0 ? '+' : ''}${champion.gameDiff}`} label="Saldo" color={champion.gameDiff >= 0 ? '#22C55E' : '#FF4444'} />
          </div>

          <div style={{ display: 'flex', flex: 1 }} />

          <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, letterSpacing: 3, color: '#6B6B6B', textTransform: 'uppercase' }}>
            rakka — gestão de torneios esportivos
          </div>
        </div>
      </div>
    ),
    { width: W, height: H },
  )
}

function StatBlock({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ display: 'flex', fontSize: 56, fontWeight: 900, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ display: 'flex', fontSize: 20, fontWeight: 700, color: '#888888', textTransform: 'uppercase', letterSpacing: 2 }}>{label}</div>
    </div>
  )
}
