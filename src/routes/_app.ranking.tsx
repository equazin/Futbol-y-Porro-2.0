import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDownUp, Crown, Medal, Trophy } from "lucide-react";
import { ranking } from "@/lib/mock-data";
import { PlayerAvatar } from "@/components/Avatar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/ranking")({
  component: Ranking,
});

type SortKey = "rating" | "goals" | "played";

function Ranking() {
  const [sort, setSort] = useState<SortKey>("rating");
  const sorted = useMemo(() => [...ranking].sort((a, b) => b[sort] - a[sort]), [sort]);
  const podium = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <div className="mx-auto max-w-4xl px-4 md:px-6 py-6">
      <header className="mb-6">
        <h1 className="font-display text-4xl md:text-5xl uppercase flex items-center gap-3">
          <Trophy className="text-gold size-8 md:size-10" /> Ranking
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Temporada actual.</p>
      </header>

      {/* Podio */}
      <section className="mb-8">
        <div className="grid grid-cols-3 gap-2 md:gap-4 items-end">
          <PodiumStep player={podium[1]} place={2} heightClass="h-32 md:h-40" />
          <PodiumStep player={podium[0]} place={1} heightClass="h-44 md:h-56" />
          <PodiumStep player={podium[2]} place={3} heightClass="h-28 md:h-36" />
        </div>
      </section>

      {/* Tabla */}
      <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="grid grid-cols-[2.5rem_1fr_repeat(3,4rem)] md:grid-cols-[3rem_1fr_repeat(3,5rem)] px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/60 bg-secondary/30">
          <span>#</span>
          <span>Jugador</span>
          {(["rating", "goals", "played"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              className={cn(
                "text-right flex items-center justify-end gap-1 hover:text-foreground transition",
                sort === k && "text-lime",
              )}
            >
              {k === "rating" ? "RTG" : k === "goals" ? "G" : "PJ"}
              <ArrowDownUp className="size-3 opacity-60" />
            </button>
          ))}
        </div>
        <ul>
          {sorted.map((p, i) => (
            <li
              key={p.id}
              className="grid grid-cols-[2.5rem_1fr_repeat(3,4rem)] md:grid-cols-[3rem_1fr_repeat(3,5rem)] items-center px-4 py-2.5 border-b border-border/40 last:border-b-0 hover:bg-secondary/30 transition"
            >
              <span className={cn("font-mono tabular-nums text-sm", i < 3 ? "text-gold font-bold" : "text-muted-foreground")}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex items-center gap-3 min-w-0">
                <PlayerAvatar player={p} size="sm" />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.nickname}</div>
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider">{p.position}</div>
                </div>
              </div>
              <span className={cn("text-right font-display text-lg tabular-nums", sort === "rating" ? "text-lime" : "")}>{p.rating}</span>
              <span className={cn("text-right tabular-nums text-sm", sort === "goals" ? "text-lime font-semibold" : "")}>{p.goals}</span>
              <span className={cn("text-right tabular-nums text-sm text-muted-foreground", sort === "played" ? "text-lime font-semibold" : "")}>{p.played}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function PodiumStep({
  player,
  place,
  heightClass,
}: {
  player: (typeof ranking)[number];
  place: 1 | 2 | 3;
  heightClass: string;
}) {
  const icon = place === 1 ? <Crown className="size-5" /> : <Medal className="size-4" />;
  const accent = place === 1 ? "text-gold border-gold/50 bg-gold/10" : "text-muted-foreground border-border/60 bg-card";
  return (
    <div className="flex flex-col items-center">
      <div className={cn("flex items-center gap-1 mb-2 text-xs font-semibold", place === 1 ? "text-gold" : "text-muted-foreground")}>
        {icon} #{place}
      </div>
      <PlayerAvatar player={player} size="lg" className={cn("ring-2", place === 1 ? "ring-gold" : "ring-border")} />
      <div className="mt-2 text-center min-w-0 w-full">
        <div className="font-display text-lg uppercase truncate">{player.nickname}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{player.position}</div>
      </div>
      <div className={cn("mt-2 w-full rounded-t-xl border border-b-0 flex flex-col items-center justify-end pb-3 pt-2", accent, heightClass)}>
        <div className="font-display text-4xl tabular-nums leading-none">{player.rating}</div>
        <div className="text-[9px] uppercase tracking-wider opacity-70 mt-1">rating</div>
      </div>
    </div>
  );
}
