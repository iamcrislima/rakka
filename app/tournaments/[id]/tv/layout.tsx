// TV mode renders its own full-screen shell — bypass the app shell
export default function TvLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
