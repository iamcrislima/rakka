import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Tournament } from '@/types'

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  draft:        { label: 'Rascunho',       color: 'bg-slate-100 text-slate-500',   dot: 'bg-slate-400' },
  group_stage:  { label: 'Em andamento',   color: 'bg-sky-100 text-sky-700',        dot: 'bg-sky-500 animate-pulse' },
  finals:       { label: 'Finais',         color: 'bg-amber-100 text-amber-700',    dot: 'bg-amber-500 animate-pulse' },
  done:         { label: 'Encerrado',      color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
}

async function getTournaments(): Promise<Tournament[]> {
  const { data } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false })
  return (data as Tournament[]) ?? []
}

export default async function HomePage() {
  const tournaments = await getTournaments()

  return (
    <div className="space-y-5">

      {/* Hero */}
      <div className="bg-gradient-to-br from-[#0F2044] to-[#1D4ED8] rounded-2xl p-5 text-white space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-white/50">Bem-vindo</p>
        <p className="text-2xl font-black leading-tight">
          Gerencie seus<br />torneios na quadra
        </p>
        <Link
          href="/tournaments/new"
          className="inline-flex items-center gap-2 bg-white text-[#1D4ED8] font-black text-sm px-5 py-3 rounded-xl active:scale-95 transition-transform"
        >
          <span className="text-lg leading-none">+</span>
          Novo torneio
        </Link>
      </div>

      {/* List */}
      {tournaments.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-5xl">🏖️</p>
          <p className="font-bold text-slate-600">Nenhum torneio ainda</p>
          <p className="text-sm text-slate-400">Crie seu primeiro torneio acima</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">
            {tournaments.length} torneio{tournaments.length !== 1 ? 's' : ''}
          </p>
          {tournaments.map(t => {
            const cfg = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.draft
            return (
              <Link
                key={t.id}
                href={`/tournaments/${t.id}`}
                className="flex items-center gap-4 bg-white rounded-2xl px-4 py-4 shadow-sm border border-white active:bg-slate-50 active:scale-[0.99] transition-transform"
              >
                <div className="w-11 h-11 rounded-xl bg-[#EFF6FF] flex items-center justify-center text-2xl shrink-0">
                  🎾
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 truncate">{t.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(t.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${cfg.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
