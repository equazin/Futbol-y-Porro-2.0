import { createFileRoute } from "@tanstack/react-router";
import { Plus, Pencil, Shuffle, Trash2 } from "lucide-react";
import { matches, players } from "@/lib/mock-data";
import { PlayerAvatar } from "@/components/Avatar";

export const Route = createFileRoute("/_app/organizador")({
  component: Organizador,
});

function Organizador() {
  const next = matches.find((m) => m.status === "open")!;
  const half = Math.ceil(next.confirmed.length / 2);
  const teamA = next.confirmed.slice(0, half).map((id) => players.find((p) => p.id === id)!);
  const teamB = next.confirmed.slice(half).map((id) => players.find((p) => p.id === id)!);

  return (
    <div className="mx-auto max-w-5xl px-4 md:px-6 py-6">
      <header className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-4xl md:text-5xl uppercase">Organizador</h1>
          <p className="text-muted-foreground text-sm mt-1">Creá partidos y armá equipos balanceados.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-lime px-4 py-2.5 text-sm font-semibold text-lime-foreground hover:brightness-110 transition">
          <Plus className="size-4" /> Nuevo partido
        </button>
      </header>

      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Tus partidos</h2>
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden divide-y divide-border/60">
          {matches.map((m) => (
            <div key={m.id} className="flex items-center gap-4 p-4">
              <div className="text-center w-14 shrink-0">
                <div className="font-display text-2xl leading-none">{new Date(m.date).getDate()}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {new Date(m.date).toLocaleDateString("es-AR", { month: "short" })}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{m.venue}</div>
                <div className="text-xs text-muted-foreground">
                  {m.format} · {m.confirmed.length}/{m.capacity} anotados
                  {m.status === "closed" && <span className="ml-2 text-out">Finalizado</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition">
                  <Pencil className="size-4" />
                </button>
                <button className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-out transition">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Armar equipos · próximo picado</h2>
          <button className="inline-flex items-center gap-1.5 rounded-md border border-lime/40 bg-lime/10 px-3 py-1.5 text-xs font-semibold text-lime hover:bg-lime/20 transition">
            <Shuffle className="size-3.5" /> Sortear balanceados
          </button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <TeamCard name="Equipo A" color="lime" team={teamA} />
          <TeamCard name="Equipo B" color="gold" team={teamB} />
        </div>
      </section>
    </div>
  );
}

function TeamCard({
  name,
  color,
  team,
}: {
  name: string;
  color: "lime" | "gold";
  team: (typeof players)[number][];
}) {
  const avg = team.length ? Math.round(team.reduce((a, p) => a + p.rating, 0) / team.length) : 0;
  return (
    <div
      className="rounded-2xl border bg-card p-4"
      style={{ borderColor: `color-mix(in oklab, var(--${color}) 40%, transparent)` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full" style={{ backgroundColor: `var(--${color})` }} />
          <span className="font-display text-xl uppercase">{name}</span>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl tabular-nums leading-none" style={{ color: `var(--${color})` }}>{avg}</div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">prom.</div>
        </div>
      </div>
      <ul className="space-y-1.5">
        {team.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-lg bg-secondary/50 px-2.5 py-2">
            <PlayerAvatar player={p} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{p.nickname}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.position}</div>
            </div>
            <span className="font-display text-base tabular-nums text-muted-foreground">{p.rating}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
