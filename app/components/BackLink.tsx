import Link from 'next/link'

/**
 * Standard "back" navigation link — a bold chevron (not the thin Unicode
 * "←" glyph, which renders hairline-thin regardless of font-weight) plus
 * the destination label. Never icon-only — always paired with text.
 */
export default function BackLink({ href, label, className }: {
  href: string; label: string; className?: string
}) {
  return (
    <Link href={href} className={`inline-flex items-center gap-1.5 transition-colors ${className ?? ''}`}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <path d="M15 19l-7-7 7-7" />
      </svg>
      <span className="truncate">{label}</span>
    </Link>
  )
}
