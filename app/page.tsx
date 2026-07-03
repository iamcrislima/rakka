import Link from 'next/link'

/**
 * Placeholder — the real public home page is being built in a separate
 * pass. The organizer dashboard that used to live here moved to /admin.
 */
export default function HomePage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-6 px-6 text-center" style={{ background: 'var(--bt-bg)' }}>
      <img src="/rakka-logo-full.svg" alt="Rakka" className="h-9 w-auto" />
      <p className="text-sm font-semibold" style={{ color: 'var(--bt-muted)' }}>
        A home pública está a caminho.
      </p>
      <Link href="/admin/login" className="btn-primary inline-flex items-center gap-2 text-sm px-5 py-2.5">
        Acessar painel do organizador
      </Link>
    </div>
  )
}
