import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { players, type Position } from "@/lib/mock-data";
import { PlayerAvatar } from "@/components/Avatar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/jugadores")({
  component: Jugadores,
});

const positions: ("TODOS" | Position)[] = ["TODOS", "ARQ", "DEF", "MED", "DEL"];

function Jugadores() {
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<(typeof positions)[number]>("TODOS");

  const filtered = useMemo(
    () =>
      players.filter(
        (p) =>
          (pos === "TODOS" || p.position === pos) &&
          (q === "" ||
            p.nickname.toLowerCase().includes(q.toLowerCase()) ||
            p.name.toLowerCase().includes(q.toLowerCase())),
      ),
    [q, pos],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6 py-6">
      <header className="mb-6">
        <h1 className="font-display text-4xl md:text-5xl uppercase">Plantel</h1>
        <p className="text-muted-foreground text-sm mt-1">{players.length} jugadores en el grupo.</p>
      </header>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o apodo…"
            className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-lime/60"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-card p-1 overflow-x-auto">
          {positions.map((p) => (
            <button
              key={p}
              onClick={() => setPos(p)}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold uppercase rounded-md transition whitespace-nowrap",
                pos === p ? "bg-lime text-lime-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((p) => (
          <div
            key={p.id}
            className="group relative rounded-2xl border border-border/60 bg-card p-4 hover:border-lime/40 transition overflow-hidden"
          >
            <div
              className="absolute -right-8 -top-8 size-24 rounded-full opacity-20 blur-xl"
              style={{ backgroundColor: p.color }}
            />
            <div className="relative flex items-center justify-between mb-3">
              <PlayerAvatar player={p} size="lg" />
              <div className="text-right">
                <div className="font-display text-3xl tabular-nums leading-none text-lime">{p.rating}</div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">rating</div>
              </div>
            </div>
            <div className="relative">
              <div className="font-display text-xl uppercase leading-tight truncate">{p.nickname}</div>
              <div className="text-xs text-muted-foreground truncate">{p.name}</div>
              <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-wider">
                <span className="rounded-md bg-secondary px-2 py-0.5 font-semibold">{p.position}</span>
                <span className="tabular-nums text-muted-foreground">
                  <span className="text-foreground font-semibold">{p.goals}</span> G · <span className="text-foreground font-semibold">{p.played}</span> PJ
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No encontramos jugadores con esos filtros.
        </div>
      )}
    </div>
  );
}
