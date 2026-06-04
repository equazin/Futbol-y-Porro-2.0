import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MapPin, Share2, Sparkles, Zap } from "lucide-react";
import { matches, playerById, ranking } from "@/lib/mock-data";
import { Countdown } from "@/components/Countdown";
import { PlayerAvatar } from "@/components/Avatar";

export const Route = createFileRoute("/_app/")({
  component: Home,
});

function Home() {
  const next = matches.find((m) => m.status === "open")!;
  const remaining = next.capacity - next.confirmed.length;
  const pct = Math.min(100, (next.confirmed.length / next.capacity) * 100);
  const topThree = ranking.slice(0, 3);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl mt-4 md:mt-8 border border-border/60 pitch-lines">
        <div className="absolute inset-0 bg-gradient-to-br from-background/30 via-background/70 to-background" />
        <div className="absolute -right-20 -top-20 size-72 rounded-full bg-lime/20 blur-3xl" />
        <div className="absolute -left-10 -bottom-20 size-64 rounded-full bg-gold/10 blur-3xl" />

        <div className="relative px-6 md:px-12 py-10 md:py-16">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-lime/40 bg-lime/10 px-3 py-1 text-xs font-medium text-lime">
            <Zap className="size-3" /> Próximo picado en vivo
          </span>
          <h1 className="mt-4 font-display text-5xl md:text-7xl leading-[0.95] uppercase max-w-2xl">
            Organizá tu picado <span className="text-lime">sin quilombo</span>
          </h1>
          <p className="mt-4 max-w-lg text-base md:text-lg text-muted-foreground">
            Publicás el partido, los pibes se anotan con un toque y todos ven en vivo cuántos faltan. Chau Excel, chau cadena de WhatsApp.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-[1.2fr_1fr] max-w-3xl">
            {/* Next match card */}
            <div className="rounded-2xl border border-lime/30 bg-card/80 backdrop-blur p-5 shadow-glow">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-lime">Próximo</div>
                  <div className="font-display text-2xl uppercase leading-tight mt-0.5">
                    {new Date(next.date).toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long" })}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                    <MapPin className="size-3.5" /> {next.venue}
                  </div>
                </div>
                <div className="rounded-lg bg-secondary px-2.5 py-1.5 text-center">
                  <div className="font-display text-xl leading-none">{next.format}</div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">formato</div>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Cupo</span>
                  <span className="tabular-nums font-medium">
                    <span className="text-lime text-base font-display">{next.confirmed.length}</span>
                    <span className="text-muted-foreground">/{next.capacity}</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-lime to-gold transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {remaining > 0 ? (
                    <>Faltan <span className="font-semibold text-foreground tabular-nums">{remaining}</span> para llenar</>
                  ) : (
                    "Completo. Anotate en la lista de espera."
                  )}
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                <Link
                  to="/partidos/$id"
                  params={{ id: next.id }}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-lime px-4 py-3 text-sm font-semibold text-lime-foreground hover:brightness-110 transition"
                >
                  Anotarme <ArrowRight className="size-4" />
                </Link>
                <button className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-3 py-3 text-muted-foreground hover:text-foreground hover:border-lime/40 transition">
                  <Share2 className="size-4" />
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-5 flex flex-col justify-between">
              <Countdown to={next.closesAt} label="Cierra inscripción en" />
              <div className="mt-6">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Últimos en anotarse</div>
                <div className="flex -space-x-2">
                  {next.confirmed.slice(-6).map((id) => {
                    const p = playerById(id)!;
                    return <PlayerAvatar key={id} player={p} size="sm" className="ring-2 ring-card" />;
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Picados jugados" value="48" />
        <Stat label="Jugadores activos" value="16" />
        <Stat label="Goles esta temporada" value="187" />
      </section>

      {/* Próximos partidos */}
      <section className="mt-10">
        <div className="flex items-end justify-between mb-4">
          <h2 className="font-display text-3xl uppercase">Próximos picados</h2>
          <Link to="/partidos" className="text-sm text-lime hover:underline">Ver todos →</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {matches.filter((m) => m.status === "open").map((m) => (
            <MiniMatch key={m.id} match={m} />
          ))}
        </div>
      </section>

      {/* Podio mini */}
      <section className="mt-10 mb-6">
        <div className="flex items-end justify-between mb-4">
          <h2 className="font-display text-3xl uppercase flex items-center gap-2">
            <Sparkles className="size-6 text-gold" /> Podio de la temporada
          </h2>
          <Link to="/ranking" className="text-sm text-lime hover:underline">Ranking completo →</Link>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {topThree.map((p, i) => (
            <div
              key={p.id}
              className="rounded-2xl border border-border/60 bg-card p-4 flex items-center gap-3"
              style={i === 0 ? { borderColor: "color-mix(in oklab, var(--gold) 50%, transparent)" } : undefined}
            >
              <div className="font-display text-4xl tabular-nums text-gold w-8">{i + 1}</div>
              <PlayerAvatar player={p} size="md" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{p.nickname}</div>
                <div className="text-xs text-muted-foreground">{p.position} · {p.goals} goles</div>
              </div>
              <div className="font-display text-2xl tabular-nums text-lime">{p.rating}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 px-4 py-3">
      <div className="font-display text-3xl tabular-nums leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

import { MatchCard } from "@/components/MatchCard";
import type { Match } from "@/lib/mock-data";
function MiniMatch({ match }: { match: Match }) {
  return <MatchCard match={match} />;
}
