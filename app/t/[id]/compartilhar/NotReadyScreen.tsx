export default function NotReadyScreen({ tournamentId, reason }: { tournamentId: string; reason: string }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-6 px-8 text-center bg-[#0A0A0A] text-[#F0F0F0]">
      <span className="text-6xl">🔒</span>
      <div className="space-y-2">
        <p className="text-2xl font-black">Resultado ainda não disponível</p>
        <p className="text-base text-[#888888]">{reason}</p>
      </div>
      <a
        href={`/t/${tournamentId}`}
        className="mt-4 px-6 py-3 rounded-full font-black text-sm uppercase tracking-widest transition-transform active:scale-95 bg-[#C8F135] text-[#0A0A0A]"
      >
        ← Voltar ao torneio
      </a>
    </div>
  )
}
