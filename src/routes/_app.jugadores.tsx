import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useStore, computeRanking } from "@/store/match-store";
import { cn } from "@/lib/utils";
import { PlayerDetailModal } from "@/components/PlayerDetailModal";
import { type PlayerPoints } from "@/store/match-store";

export const Route = createFileRoute("/_app/jugadores")({
  component: Jugadores,
  pendingComponent: JugadoresPending,
  loader: () => [],
});

// ── Helpers ───────────────────────────────────────────────

type PosKey = "TODOS" | "ARQ" | "DEF" | "MED" | "DEL";

const POS_LABEL: Record<string, string> = {
  arquero: "ARQ",
  defensor: "DEF",
  mediocampista: "MED",
  delantero: "DEL",
};

const POS_COLORS: Record<string, string> = {
  ARQ: "oklch(0.7 0.18 250)",
  DEF: "oklch(0.78 0.18 145)",
  MED: "oklch(0.82 0.15 80)",
  DEL: "oklch(0.7 0.2 20)",
};

function posKey(posicion: string | null): string {
  return POS_LABEL[posicion ?? ""] ?? "—";
}

function avatarColor(jugador: JugadorRow): string {
  const pk = posKey(jugador.posicion);
  return POS_COLORS[pk] ?? "oklch(0.75 0.18 300)";
}

function initials(jugador: JugadorRow): string {
  const src = jugador.apodo ?? jugador.nombre;
  return src.slice(0, 2).toUpperCase();
}

function displayName(jugador: JugadorRow): string {
  return jugador.apodo ?? jugador.nombre;
}

// ── Avatar ────────────────────────────────────────────────

function Avatar({ jugador, size = "md" }: { jugador: JugadorRow; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-14 text-lg" };

  if (jugador.foto_url) {
    return (
      <img
        src={jugador.foto_url}
        alt={displayName(jugador)}
        className={cn("rounded-full object-cover ring-1 ring-black/20", sizes[size])}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-display font-medium tracking-wide text-background ring-1 ring-inset ring-black/20",
        sizes[size],
      )}
      style={{ backgroundColor: avatarColor(jugador) }}
      title={displayName(jugador)}
    >
      {initials(jugador)}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────

const POSITIONS: PosKey[] = ["TODOS", "ARQ", "DEF", "MED", "DEL"];

function Jugadores() {
  const { matches, rules, players } = useStore();
  const ranking = useMemo(() => computeRanking(matches, rules, players), [matches, rules, players]);
  
  const jugadores = useMemo(() => {
    return ranking.map((p) => ({
      id: p.player.id,
      nombre: p.player.name,
      apodo: p.player.nickname,
      posicion: p.player.position,
      foto_url: p.player.foto_url,
      elo: p.player.rating,
      tipo: "titular",
      partidos_jugados: p.attended,
      goles: p.goals,
      badges: p.badges,
    }));
  }, [ranking]);

  const [q, setQ] = useState("");
  const [pos, setPos] = useState<PosKey>("TODOS");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const selectedPlayerStats = useMemo(() => {
    if (!selectedPlayerId) return null;
    return ranking.find((r) => r.player.id === selectedPlayerId) || null;
  }, [ranking, selectedPlayerId]);

  const filtered = useMemo(
    () =>
      jugadores.filter((p) => {
        const pk = posKey(p.posicion);
        const matchPos = pos === "TODOS" || pk === pos;
        const matchQ =
          q === "" ||
          (p.apodo ?? "").toLowerCase().includes(q.toLowerCase()) ||
          p.nombre.toLowerCase().includes(q.toLowerCase());
        return matchPos && matchQ;
      }),
    [jugadores, q, pos],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6 py-6">
      <header className="mb-6">
        <h1 className="font-display text-4xl md:text-5xl uppercase">Plantel</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {jugadores.length} jugadores en el grupo.
        </p>
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
          {POSITIONS.map((p) => (
            <button
              key={p}
              onClick={() => setPos(p)}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold uppercase rounded-md transition whitespace-nowrap",
                pos === p
                  ? "bg-lime text-lime-foreground"
                  : "text-muted-foreground hover:text-foreground",
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
            onClick={() => setSelectedPlayerId(p.id)}
            className="group relative rounded-2xl border border-border/60 bg-card p-4 hover:border-lime/40 transition overflow-hidden cursor-pointer select-none"
          >
            <div
              className="absolute -right-8 -top-8 size-24 rounded-full opacity-20 blur-xl"
              style={{ backgroundColor: avatarColor(p) }}
            />
            <div className="relative flex items-center justify-between mb-3">
              <Avatar jugador={p} size="lg" />
              <div className="text-right">
                <div className="font-display text-3xl tabular-nums leading-none text-lime">
                  {p.elo}
                </div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">
                  elo
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="font-display text-xl uppercase leading-tight truncate flex items-center justify-between gap-1.5">
                <span>{displayName(p)}</span>
                {p.badges && p.badges.length > 0 && (
                  <div className="flex gap-0.5 select-none shrink-0">
                    {p.badges.map((b) => (
                      <span key={b.type} title={b.tooltip} className="text-xs cursor-help hover:scale-110 transition">
                        {b.icon}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground truncate">{p.nombre}</div>
              <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-wider">
                <span className="rounded-md bg-secondary px-2 py-0.5 font-semibold">
                  {posKey(p.posicion)}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  <span className="text-foreground font-semibold">{p.goles}</span> G ·{" "}
                  <span className="text-foreground font-semibold">{p.partidos_jugados}</span> PJ
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
      {selectedPlayerStats && (
        <PlayerDetailModal
          playerStats={selectedPlayerStats}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}
    </div>
  );
}

function JugadoresPending() {
  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6 py-6 space-y-6">
      <div className="space-y-2">
        <div className="h-10 w-48 bg-secondary/50 animate-pulse rounded" />
        <div className="h-4 w-32 bg-secondary/50 animate-pulse rounded" />
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="h-10 flex-1 bg-secondary/30 animate-pulse rounded-lg" />
        <div className="h-10 w-64 bg-secondary/30 animate-pulse rounded-lg" />
      </div>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-48 border border-border/40 bg-card/40 rounded-2xl p-4 space-y-4">
            <div className="flex justify-between items-center">
              <div className="size-14 rounded-full bg-secondary/50 animate-pulse" />
              <div className="space-y-1">
                <div className="h-6 w-12 bg-secondary/50 animate-pulse rounded" />
                <div className="h-2 w-8 bg-secondary/50 animate-pulse rounded" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-5 w-28 bg-secondary/50 animate-pulse rounded" />
              <div className="h-3 w-20 bg-secondary/50 animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
