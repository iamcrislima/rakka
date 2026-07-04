import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Tournament } from '@/types'

const STATUS: Record<string, { label: string; dot: string; text: string; shape: string }> = {
  draft:       { label: 'Rascunho',     dot: 'bg-neutral-500',              text: 'text-neutral-400', shape: '○' },
  group_stage: { label: 'Em andamento', dot: 'bg-[#C8F135] animate-pulse',  text: 'text-[#C8F135]',   shape: '▶' },
  finals:      { label: 'Finais',       dot: 'bg-amber-400 animate-pulse', text: 'text-amber-400',    shape: '◆' },
  done:        { label: 'Encerrado',    dot: 'bg-emerald-400',             text: 'text-emerald-400',  shape: '✓' },
}

async function getTournaments(): Promise<Tournament[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let query = supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false })

  // Filter by owner if user is logged in and user_id column exists
  if (user) {
    query = query.or(`user_id.eq.${user.id},user_id.is.null`)
  }

  const { data } = await query
  return (data as Tournament[]) ?? []
}

export default async function HomePage() {
  const tournaments = await getTournaments()
  const active = tournaments.filter(t => t.status === 'group_stage' || t.status === 'finals')
  const rest   = tournaments.filter(t => t.status !== 'group_stage' && t.status !== 'finals')

  return (
    <div className="space-y-6 animate-fade-in max-w-[1400px] mx-auto lg:py-4">

      {/* Hero */}
      <div className="relative rounded-2xl p-5 overflow-hidden border" style={{ background: 'var(--bt-card)', borderColor: 'var(--bt-border)' }}>
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full" style={{ background: 'var(--bt-neon-dim)' }} />
        <div className="absolute -right-2 top-8 w-16 h-16 rounded-full" style={{ background: 'var(--bt-neon-dim)' }} />
        <div className="relative space-y-3">
          <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--bt-muted)' }}>Bem-vindo</p>
          <p className="font-display font-bold uppercase text-3xl leading-tight" style={{ color: 'var(--bt-text)' }}>
            Gerencie seus torneios
          </p>
          <Link
            href="/admin/tournaments/new"
            className="btn-primary inline-flex items-center gap-2 text-sm px-5 py-2.5"
          >
            <span className="text-base leading-none">+</span>
            Novo torneio
          </Link>
        </div>
      </div>

      {/* Active tournaments */}
      {active.length > 0 && (
        <section className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-widest px-0.5" style={{ color: 'var(--bt-muted)' }}>
            Em jogo agora
          </p>
          <div className="stagger grid grid-cols-1 lg:grid-cols-2 gap-2">
            {active.map(t => (
              <TournamentCard key={t.id} t={t} highlight />
            ))}
          </div>
        </section>
      )}

      {/* Other tournaments */}
      {rest.length > 0 && (
        <section className="space-y-2">
          {active.length > 0 && (
            <p className="text-[11px] font-black uppercase tracking-widest px-0.5" style={{ color: 'var(--bt-muted)' }}>
              Outros torneios
            </p>
          )}
          <div className="stagger grid grid-cols-1 lg:grid-cols-2 gap-2">
            {rest.map(t => (
              <TournamentCard key={t.id} t={t} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {tournaments.length === 0 && (
        <div className="text-center py-16 space-y-3 animate-fade-in">
          <p className="text-5xl" style={{ color: 'var(--bt-neon)' }}>🏆</p>
          <p className="font-bold" style={{ color: 'var(--bt-text)' }}>Nenhum torneio ainda</p>
          <p className="text-sm" style={{ color: 'var(--bt-muted)' }}>Crie seu primeiro torneio acima</p>
        </div>
      )}

    </div>
  )
}

function TournamentCard({ t, highlight }: { t: Tournament; highlight?: boolean }) {
  const cfg = STATUS[t.status] ?? STATUS.draft
  return (
    <Link
      href={`/admin/tournaments/${t.id}`}
      className="card-rakka flex items-center gap-4 px-4 py-4 transition-transform active:scale-[0.985]"
      style={highlight ? { borderColor: 'var(--bt-neon)' } : undefined}
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: 'var(--bt-elevated)' }}>
        <span style={{ color: 'var(--bt-neon)' }}>🎾</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold truncate text-[15px]" style={{ color: 'var(--bt-text)' }}>{t.name}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--bt-muted)' }}>
          {new Date(t.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
      </div>
      <div className={`flex items-center gap-1.5 shrink-0 ${cfg.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
        <span className="text-xs font-bold">{cfg.shape} {cfg.label}</span>
      </div>
    </Link>
  )
}
