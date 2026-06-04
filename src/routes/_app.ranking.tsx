import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDownUp, Crown, Medal, Trophy, Info } from "lucide-react";
import { useStore, computeRanking, type PlayerPoints } from "@/store/match-store";
import { PlayerAvatar } from "@/components/Avatar";
import { PlayerDetailModal } from "@/components/PlayerDetailModal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/ranking")({
  component: Ranking,
});

type SortKey = "points" | "attended" | "wins" | "losses" | "effectiveness";

function Ranking() {
  const { matches, rules, players } = useStore();
  const [sort, setSort] = useState<SortKey>("points");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerPoints | null>(null);

  const ranking = useMemo(() => computeRanking(matches, rules, players), [matches, rules, players]);

  const sorted = useMemo(() => {
    return [...ranking].sort((a, b) => {
      if (sort === "points") return b.points - a.points || b.player.rating - a.player.rating;
      if (sort === "effectiveness") {
        const aEff = a.attended > 0 ? a.wins / a.attended : 0;
        const bEff = b.attended > 0 ? b.wins / b.attended : 0;
        return bEff - aEff || b.points - a.points;
      }
      return b[sort] - a[sort] || b.points - a.points;
    });
  }, [ranking, sort]);

  const podium = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <div className="mx-auto max-w-4xl px-4 md:px-6 py-6">
      <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl md:text-5xl uppercase flex items-center gap-3">
            <Trophy className="text-gold size-8 md:size-10" /> Ranking
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Temporada actual.</p>
        </div>

        {/* Reglas de Puntuación */}
        <div className="rounded-xl border border-border bg-card/50 p-3 max-w-md">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground mb-2">
            <Info className="size-3.5 text-lime" /> Sistema de Puntos
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
            <div>Victoria: <span className="text-lime font-bold">+{rules.win}</span></div>
            <div>Empate: <span className="text-lime font-bold">+{rules.draw}</span></div>
            <div>Asistir: <span className="text-lime font-bold">+{rules.attendance}</span></div>
            <div>MVP: <span className="text-lime font-bold">+{rules.mvp}</span></div>
            <div>Gol de la Fecha: <span className="text-lime font-bold">+{rules.goalOfTheDay}</span></div>
          </div>
        </div>
      </header>

      {/* Podio */}
      {podium.length > 0 && (
        <section className="mb-8">
          <div className="grid grid-cols-3 gap-2 md:gap-4 items-end">
            <PodiumStep
              player={podium[1]}
              place={2}
              heightClass="h-32 md:h-40"
              onClick={() => setSelectedPlayer(podium[1])}
            />
            <PodiumStep
              player={podium[0]}
              place={1}
              heightClass="h-44 md:h-56"
              onClick={() => setSelectedPlayer(podium[0])}
            />
            <PodiumStep
              player={podium[2]}
              place={3}
              heightClass="h-28 md:h-36"
              onClick={() => setSelectedPlayer(podium[2])}
            />
          </div>
        </section>
      )}

      {/* Tabla */}
      <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="grid grid-cols-[2.5rem_1fr_repeat(5,3.4rem)] md:grid-cols-[3rem_1fr_repeat(5,4.5rem)] px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/60 bg-secondary/30">
          <span>#</span>
          <span>Jugador</span>
          {(["points", "attended", "wins", "losses", "effectiveness"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              className={cn(
                "text-right flex items-center justify-end gap-1 hover:text-foreground transition",
                sort === k && "text-lime",
              )}
            >
              {k === "points" ? "PTS" : k === "attended" ? "PJ" : k === "wins" ? "PG" : k === "losses" ? "PP" : "%"}
              <ArrowDownUp className="size-3 opacity-60" />
            </button>
          ))}
        </div>
        {sorted.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            No hay partidos jugados cargados todavía.
          </div>
        ) : (
          <ul>
            {sorted.map((p, i) => (
              <li
                key={p.player.id}
                onClick={() => setSelectedPlayer(p)}
                className="grid grid-cols-[2.5rem_1fr_repeat(5,3.4rem)] md:grid-cols-[3rem_1fr_repeat(5,4.5rem)] items-center px-4 py-2.5 border-b border-border/40 last:border-b-0 hover:bg-secondary/30 transition cursor-pointer select-none"
              >
                <span className={cn("font-mono tabular-nums text-sm", i < 3 ? "text-gold font-bold" : "text-muted-foreground")}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex items-center gap-3 min-w-0">
                  <PlayerAvatar player={p.player} size="sm" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate flex items-center gap-1.5">
                      {p.player.nickname}
                      {p.badges && p.badges.length > 0 && (
                        <div className="flex gap-0.5 select-none shrink-0">
                          {p.badges.map((b) => (
                            <span
                              key={b.type}
                              title={b.tooltip}
                              className="text-xs cursor-help hover:scale-110 transition duration-100"
                            >
                              {b.icon}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wider">{p.player.position}</div>
                  </div>
                </div>
                <span className={cn("text-right font-display text-lg tabular-nums", sort === "points" ? "text-lime" : "")}>
                  {p.points}
                </span>
                <span className={cn("text-right tabular-nums text-sm text-muted-foreground", sort === "attended" ? "text-lime font-semibold" : "")}>
                  {p.attended}
                </span>
                <span className={cn("text-right tabular-nums text-sm", sort === "wins" ? "text-lime font-semibold" : "")}>
                  {p.wins}
                </span>
                <span className={cn("text-right tabular-nums text-sm text-muted-foreground", sort === "losses" ? "text-lime font-semibold" : "")}>
                  {p.losses}
                </span>
                <span className={cn("text-right tabular-nums text-sm", sort === "effectiveness" ? "text-lime font-semibold" : "")}>
                  {p.attended > 0 ? Math.round((p.wins / p.attended) * 100) : 0}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Stats Modal */}
      {selectedPlayer && (
        <PlayerDetailModal
          playerStats={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}

function PodiumStep({
  player,
  place,
  heightClass,
  onClick,
}: {
  player: PlayerPoints;
  place: 1 | 2 | 3;
  heightClass: string;
  onClick?: () => void;
}) {
  if (!player) return null;
  const icon = place === 1 ? <Crown className="size-5" /> : <Medal className="size-4" />;
  const accent = place === 1 ? "text-gold border-gold/50 bg-gold/10" : "text-muted-foreground border-border/60 bg-card";
  return (
    <div
      onClick={onClick}
      className="flex flex-col items-center cursor-pointer group"
    >
      <div className={cn("flex items-center gap-1 mb-2 text-xs font-semibold", place === 1 ? "text-gold" : "text-muted-foreground")}>
        {icon} #{place}
      </div>
      <PlayerAvatar
        player={player.player}
        size="lg"
        className={cn("ring-2 transition-transform group-hover:scale-105", place === 1 ? "ring-gold" : "ring-border")}
      />
      <div className="mt-2 text-center min-w-0 w-full">
        <div className="font-display text-lg uppercase truncate flex items-center justify-center gap-1">
          {player.player.nickname}
        </div>
        <div className="flex justify-center gap-0.5 mb-0.5 select-none h-4">
          {player.badges && player.badges.map((b) => (
            <span key={b.type} title={b.tooltip} className="cursor-help text-xs hover:scale-110 transition">
              {b.icon}
            </span>
          ))}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{player.player.position}</div>
      </div>
      <div className={cn("mt-2 w-full rounded-t-xl border border-b-0 flex flex-col items-center justify-end pb-3 pt-2 transition-all group-hover:brightness-110", accent, heightClass)}>
        <div className="font-display text-4xl tabular-nums leading-none">{player.points}</div>
        <div className="text-[9px] uppercase tracking-wider opacity-70 mt-1">puntos</div>
      </div>
    </div>
  );
}
