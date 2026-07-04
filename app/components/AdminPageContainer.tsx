/**
 * Shared page shell for every /admin/** screen — centers content and caps
 * it at a generous width on large monitors. This exact `max-w-[1400px]
 * mx-auto lg:py-4` string was previously hand-copied into each page file
 * independently, which is exactly how new pages (tournament wizard,
 * Quadras, Configurações) kept shipping without it — one page forgot to
 * paste the string, nothing enforced consistency. Import this instead of
 * retyping the className so every admin page shares one source of truth.
 */
export default function AdminPageContainer({ children, className = '' }: {
  children:   React.ReactNode
  className?: string
}) {
  return (
    <div className={`max-w-[1400px] mx-auto lg:py-4 ${className}`}>
      {children}
    </div>
  )
}
