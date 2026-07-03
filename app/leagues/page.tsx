import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { League } from '@/types'

async function getLeagues(): Promise<League[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('leagues')
    .select('*')
    .order('created_at', { ascending: false })
  return (data as League[]) ?? []
}

export default async function LeaguesPage() {
  const leagues = await getLeagues()

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto lg:py-4">

      {/* Hero */}
      <div className="relative bg-gradient-to-br from-[#1a0533] to-[#6D28D9] rounded-2xl p-5 overflow-hidden">
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/5" />
        <div className="absolute -right-2 top-8 w-16 h-16 rounded-full bg-white/5" />
        <div className="relative space-y-3">
          <p className="text-[11px] font-black uppercase tracking-widest text-white/40">Sistema de ligas</p>
          <p className="font-display text-3xl font-bold uppercase leading-tight text-white">
            Acompanhe o ranking geral
          </p>
          <Link
            href="/leagues/new"
            className="inline-flex items-center gap-2 bg-[#161616] text-[#C8F135] font-black text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-black/20"
          >
            <span className="text-base leading-none">+</span>
            Nova liga
          </Link>
        </div>
      </div>

      {/* League list */}
      {leagues.length > 0 ? (
        <section className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#888888] px-0.5">
            Suas ligas
          </p>
          <div className="stagger space-y-2">
            {leagues.map(l => <LeagueCard key={l.id} league={l} />)}
          </div>
        </section>
      ) : (
        <div className="text-center py-16 space-y-3 animate-fade-in">
          <p className="text-5xl">🏅</p>
          <p className="font-bold text-[#888888]">Nenhuma liga ainda</p>
          <p className="text-sm text-[#888888]">Crie sua primeira liga acima</p>
        </div>
      )}

    </div>
  )
}

function LeagueCard({ league }: { league: League }) {
  return (
    <Link
      href={`/leagues/${league.id}`}
      className="flex items-center gap-4 rounded-2xl px-4 py-4 bg-[#161616] border border-[#242424] shadow-sm transition-transform active:scale-[0.985]"
    >
      <div className="w-11 h-11 rounded-xl bg-[#1C1C1C] flex items-center justify-center text-2xl shrink-0">
        🏅
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[#F0F0F0] truncate text-[15px]">{league.name}</p>
        {league.description && (
          <p className="text-xs text-[#888888] mt-0.5 truncate">{league.description}</p>
        )}
      </div>
      <span className="text-[#444444] text-lg shrink-0">›</span>
    </Link>
  )
}
