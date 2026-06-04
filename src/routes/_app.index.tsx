import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MapPin, Share2, Sparkles, Zap } from "lucide-react";
import { useStore, computeRanking, type PlayerPoints } from "@/store/match-store";
import { useMemo } from "react";
import { Countdown } from "@/components/Countdown";
import { PlayerAvatar } from "@/components/Avatar";
import { shareMatch } from "@/lib/share";
import { MatchCard } from "@/components/MatchCard";
import type { Match } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/")({
  component: Home,
});

function Home() {
  const { matches, rules, players } = useStore();
  const playerMap = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);
  const ranking = useMemo(() => computeRanking(matches, rules, players), [matches, rules, players]);
  const next = matches.find((m) => m.status === "open") || matches[0];
  const remaining = next ? next.capacity - next.confirmed.length : 0;
  const pct = next ? Math.min(100, (next.confirmed.length / next.capacity) * 100) : 0;
  const topThree = ranking.slice(0, 3);

  const playedMatchesCount = useMemo(() => matches.filter((m) => m.played).length, [matches]);
  const activePlayersCount = players.length;
  const totalGoals = useMemo(() => ranking.reduce((sum, p) => sum + p.goals, 0), [ranking]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 md:px-6 space-y-10">
      {/* Hero / Next Match Stub */}
      <section className="relative overflow-hidden rounded-[36px] mt-4 md:mt-8 border border-border/40 pitch-lines">
        <div className="absolute inset-0 bg-gradient-to-br from-background/40 via-background/80 to-background" />
        <div className="absolute -right-20 -top-20 size-72 rounded-full bg-lime/10 blur-3xl" />
        <div className="absolute -left-10 -bottom-20 size-64 rounded-full bg-gold/5 blur-3xl" />

        <div className="relative px-6 md:px-10 py-8 md:py-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-lime/40 bg-lime/10 px-3 py-1 text-xs font-semibold text-lime">
            <Zap className="size-3 text-lime animate-pulse" /> Próximo picado en vivo
          </span>
          <h1 className="mt-4 font-display text-5xl md:text-7xl leading-[0.95] uppercase max-w-2xl">
            Organizá tu picado <span className="text-lime">sin quilombo</span>
          </h1>
          <p className="mt-4 max-w-lg text-sm md:text-base text-muted-foreground leading-relaxed">
            Publicás el partido, los pibes se anotan con un toque y todos ven en vivo cuántos faltan. Chau Excel, chau cadena de WhatsApp.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-[1.5fr_1fr] max-w-4xl">
            {/* Ticket de Entrada Digital */}
            {next ? (
              <div className="ticket-card rounded-[28px] overflow-hidden flex flex-col md:flex-row relative group hover:border-lime/50 hover:shadow-neon-glow transition duration-300">
                {/* Lomo Izquierdo: Info Partido */}
                <div className="flex-1 p-6 flex flex-col justify-between space-y-6">
                  <div>
                    <span className="inline-flex items-center gap-1 text-[9px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-lime/10 border border-lime/30 text-lime mb-2.5 select-none">
                      🎫 Futbol y Porro FC
                    </span>
                    <h3 className="font-display text-3xl md:text-4xl uppercase leading-none text-foreground font-black">
                      {new Date(next.date).toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long" })}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-2.5 flex items-center gap-1.5">
                      <MapPin className="size-4 text-lime" /> {next.venue}
                    </p>
                  </div>

                  <div className="flex items-center gap-5 text-xs text-muted-foreground border-t border-border/30 pt-4">
                    <div>
                      <span className="block text-[8px] uppercase tracking-widest text-muted-foreground/60 mb-0.5 font-bold">Formato</span>
                      <span className="font-display text-base uppercase text-foreground">{next.format}</span>
                    </div>
                    <div className="border-l border-border/30 h-8" />
                    <div>
                      <span className="block text-[8px] uppercase tracking-widest text-muted-foreground/60 mb-0.5 font-bold">Hora</span>
                      <span className="font-display text-base uppercase text-foreground">{next.hora?.slice(0, 5) ?? next.date?.slice(11, 16)} hs</span>
                    </div>
                  </div>
                </div>

                {/* Perforación Central (Troquel CSS) */}
                <div className="hidden md:flex flex-col items-center justify-between relative w-4 shrink-0 py-2">
                  <div className="ticket-notch-top left-[-6px]" />
                  <div className="ticket-divider-line opacity-30 my-1" />
                  <div className="ticket-notch-bottom left-[-6px]" />
                </div>

                {/* Perforación Central Mobile */}
                <div className="md:hidden border-t-2 border-dashed border-border/30 relative w-full h-1 my-1">
                  <div className="absolute left-[-8px] top-[-8px] size-4 rounded-full bg-background border border-border/30" />
                  <div className="absolute right-[-8px] top-[-8px] size-4 rounded-full bg-background border border-border/30" />
                </div>

                {/* Lomo Derecho: Control de Cupos / Acciones */}
                <div className="w-full md:w-60 p-6 bg-secondary/15 flex flex-col justify-between items-center text-center space-y-4 shrink-0 md:border-l md:border-border/10">
                  <div className="w-full space-y-2.5">
                    <div className="flex justify-between items-center text-[10px] text-muted-foreground uppercase font-bold px-1">
                      <span>Cupo Confirmado</span>
                      <span className="font-mono text-foreground font-black">{next.confirmed.length}/{next.capacity}</span>
                    </div>

                    <div className="h-2 w-full bg-secondary/35 rounded-full overflow-hidden relative">
                      <div
                        className="h-full bg-gradient-to-r from-lime to-gold transition-all duration-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="text-[10px] text-muted-foreground font-semibold">
                      {remaining > 0 ? (
                        <>Faltan <span className="font-bold text-lime tabular-nums">{remaining}</span> confirmados</>
                      ) : (
                        <span className="text-gold font-bold">¡Cupo Completo!</span>
                      )}
                    </div>
                  </div>

                  {/* Acciones del Ticket */}
                  <div className="w-full flex gap-2">
                    <Link
                      to="/partidos/$id"
                      params={{ id: next.id }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-lime px-4 py-2.5 text-xs font-bold text-lime-foreground hover:brightness-110 shadow-glow transition"
                    >
                      Anotarme <ArrowRight className="size-3.5" />
                    </Link>
                    <button
                      onClick={() =>
                        shareMatch({
                          id: next.id,
                          title: `F y P FC ${next.format}`,
                          text: `${next.venue} · ${new Date(next.date).toLocaleString("es-AR")}`,
                        })
                      }
                      aria-label="Compartir"
                      className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-3 py-2.5 text-muted-foreground hover:text-foreground hover:border-lime/40 transition shrink-0"
                    >
                      <Share2 className="size-3.5" />
                    </button>
                  </div>
                  
                  {/* Código de barras del ticket */}
                  <div className="hidden md:flex flex-col items-center opacity-30 group-hover:opacity-60 transition duration-300 select-none">
                    <div className="w-28 h-5 bg-foreground" style={{ maskImage: "repeating-linear-gradient(90deg, black, black 2px, transparent 2px, transparent 4px, black 4px, black 5px, transparent 5px, transparent 7px)", WebkitMaskImage: "repeating-linear-gradient(90deg, black, black 2px, transparent 2px, transparent 4px, black 4px, black 5px, transparent 5px, transparent 7px)" }} />
                    <span className="text-[7px] font-mono tracking-widest text-muted-foreground/80 mt-1">FYP-{next.id.slice(0, 8).toUpperCase()}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="col-span-full rounded-[28px] border border-border/40 bg-card/45 backdrop-blur p-8 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3">
                <MapPin className="size-10 text-muted-foreground/45" />
                <h3 className="font-display text-xl uppercase text-foreground">No hay partidos programados</h3>
                <p className="text-xs text-muted-foreground max-w-sm">No hay picados abiertos para inscripción en este momento. Volvé más tarde.</p>
              </div>
            )}

            {/* Countdown stub */}
            {next && (
              <div className="rounded-[28px] border border-border/40 bg-card/45 backdrop-blur p-6 flex flex-col justify-between shadow-lg hover:border-lime/30 transition duration-300">
                <Countdown to={next.closesAt} label="Cierra inscripción en" />
                <div className="mt-6 border-t border-border/30 pt-4">
                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-2 font-bold">Últimos inscriptos</div>
                  <div className="flex -space-x-2.5 overflow-hidden">
                    {next.confirmed.length === 0 ? (
                      <span className="text-xs text-muted-foreground/50">Nadie confirmado todavía</span>
                    ) : (
                      next.confirmed.slice(-6).map((id) => {
                        const p = playerMap[id];
                        if (!p) return null;
                        return <PlayerAvatar key={id} player={p} size="sm" className="ring-2 ring-card shrink-0 hover:translate-y-[-2px] transition duration-200" />;
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Stats Bento Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Picados jugados" value={String(playedMatchesCount)} icon="⚽" color="border-lime/20 hover:border-lime/50 hover:shadow-neon-glow" />
        <Stat label="Jugadores activos" value={String(activePlayersCount)} icon="👥" color="border-blue-500/20 hover:border-blue-500/50 hover:shadow-[0_0_15px_-3px_rgba(59,130,246,0.2)]" />
        <Stat label="Goles esta temporada" value={String(totalGoals)} icon="🔥" color="border-gold/20 hover:border-gold/50 hover:shadow-gold-glow" />
      </section>

      {/* Próximos partidos */}
      {matches.filter((m) => m.status === "open").length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-4">
            <h2 className="font-display text-3xl uppercase tracking-wider">Próximos picados</h2>
            <Link to="/partidos" className="text-xs font-semibold text-lime hover:underline uppercase">Ver todos →</Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {matches.filter((m) => m.status === "open").map((m) => (
              <MiniMatch key={m.id} match={m} />
            ))}
          </div>
        </section>
      )}

      {/* Podio 3D de la Temporada */}
      <section className="pb-8">
        <div className="flex items-end justify-between mb-2">
          <h2 className="font-display text-3xl uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="size-6 text-gold animate-bounce" /> Podio de la temporada
          </h2>
          <Link to="/ranking" className="text-xs font-semibold text-lime hover:underline uppercase">Ranking completo →</Link>
        </div>
        
        {topThree.length === 0 ? (
          <div className="rounded-[28px] border border-border/40 bg-card/40 p-8 text-center text-muted-foreground">
            Aún no hay estadísticas registradas esta temporada. Todos los jugadores están en igualdad de condiciones.
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-center md:items-end justify-center gap-6 md:gap-4 max-w-3xl mx-auto py-8">
            {/* 2° Lugar */}
            {topThree[1] ? (
              <PodiumStand player={topThree[1]} place={2} height="h-24 md:h-32" color="from-slate-400/20 via-slate-400/5 to-transparent border-slate-400/20" accentColor="text-slate-300" />
            ) : (
              <div className="w-48 hidden md:block" />
            )}

            {/* 1° Lugar */}
            {topThree[0] ? (
              <PodiumStand player={topThree[0]} place={1} height="h-32 md:h-44" color="from-gold/25 via-gold/5 to-transparent border-gold/30 shadow-gold-glow" accentColor="text-gold" />
            ) : (
              <div className="w-56 text-center text-muted-foreground py-6">No hay datos suficientes.</div>
            )}

            {/* 3° Lugar */}
            {topThree[2] ? (
              <PodiumStand player={topThree[2]} place={3} height="h-20 md:h-24" color="from-amber-700/15 via-amber-700/5 to-transparent border-amber-700/20" accentColor="text-amber-600" />
            ) : (
              <div className="w-48 hidden md:block" />
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div className={cn("rounded-2xl border bg-card/45 backdrop-blur px-5 py-4 flex items-center justify-between transition-all duration-300 group hover:translate-y-[-2px]", color)}>
      <div className="space-y-1">
        <div className="font-display text-4xl tabular-nums leading-none tracking-wide text-foreground group-hover:scale-105 transition duration-300">{value}</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{label}</div>
      </div>
      <span className="text-2xl opacity-60 group-hover:opacity-100 group-hover:scale-110 transition duration-300 select-none">{icon}</span>
    </div>
  );
}

function PodiumStand({
  player,
  place,
  height,
  color,
  accentColor,
}: {
  player: PlayerPoints;
  place: 1 | 2 | 3;
  height: string;
  color: string;
  accentColor: string;
}) {
  const medal = place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉";
  return (
    <div className="flex flex-col items-center w-full max-w-[200px] group cursor-pointer">
      {/* Avatar flotando arriba de la columna */}
      <div className="relative mb-3 flex flex-col items-center space-y-1 z-10 transition-transform duration-300 group-hover:translate-y-[-4px]">
        <div className="relative">
          <PlayerAvatar
            player={player.player}
            size="lg"
            className={cn("!size-16 !text-2xl ring-4 ring-offset-4 ring-offset-background", place === 1 ? "ring-gold" : "ring-border")}
          />
          <span className="absolute -bottom-1 -right-1 text-sm p-0.5 rounded-full bg-card shadow-md flex items-center justify-center size-6 font-bold border border-border">
            {medal}
          </span>
        </div>
        <div className="text-center">
          <div className="font-display text-lg uppercase truncate max-w-[130px] font-bold text-foreground">
            {player.player.nickname}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
            {player.player.position} · {player.goals} goles
          </div>
        </div>
      </div>

      {/* Stand Column */}
      <div className={cn(
        "w-full rounded-t-2xl border border-b-0 bg-gradient-to-b flex flex-col items-center justify-end pb-4 pt-3 transition-all duration-300 group-hover:brightness-110",
        color,
        height
      )}>
        <div className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground/60 mb-0.5">Rating</div>
        <div className={cn("font-display text-4xl leading-none tabular-nums font-black", accentColor)}>
          {player.points}
        </div>
        <span className="text-[8px] uppercase tracking-widest text-muted-foreground/60 font-bold mt-1">puntos</span>
      </div>
    </div>
  );
}

function MiniMatch({ match }: { match: Match }) {
  return <MatchCard match={match} />;
}
