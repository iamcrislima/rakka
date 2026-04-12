import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Tournament } from '@/types'

const STATUS_LABEL: Record<string, string> = {
  draft:        'Rascunho',
  group_stage:  'Fase de grupos',
  finals:       'Finais',
  done:         'Encerrado',
}
const STATUS_COLOR: Record<string, string> = {
  draft:        'bg-gray-100 text-gray-500',
  group_stage:  'bg-sky-100 text-sky-700',
  finals:       'bg-amber-100 text-amber-700',
  done:         'bg-green-100 text-green-700',
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Torneios</h1>
        <Link
          href="/tournaments/new"
          className="bg-sky-600 text-white text-sm font-semibold px-4 py-2 rounded-lg active:bg-sky-700"
        >
          + Novo
        </Link>
      </div>

      {tournaments.length === 0 && (
        <div className="text-center py-16 text-gray-400 space-y-2">
          <p className="text-4xl">🎾</p>
          <p className="font-medium">Nenhum torneio criado ainda.</p>
          <p className="text-sm">Toque em "+ Novo" para começar.</p>
        </div>
      )}

      <ul className="space-y-3">
        {tournaments.map(t => (
          <li key={t.id}>
            <Link
              href={`/tournaments/${t.id}`}
              className="flex items-center justify-between bg-white rounded-xl px-4 py-4 shadow-sm border border-gray-100 active:bg-gray-50"
            >
              <div>
                <p className="font-semibold text-gray-800">{t.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(t.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[t.status]}`}>
                {STATUS_LABEL[t.status]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
