import { Award } from "lucide-react";
import { PlayerAvatar } from "@/components/Avatar";
import type { Player } from "@/lib/mock-data";
import type { PlayerStats } from "@/store/match-store";
import { cn } from "@/lib/utils";

type StatsTableRowProps = {
  player: Player;
  stats: PlayerStats;
  isTeamA: boolean;
  /** Partido ya jugado: deshabilita la edición. */
  played: boolean;
  onUpdateStat: (field: keyof PlayerStats, val: PlayerStats[keyof PlayerStats]) => void;
  onToggleMvp: () => void;
};

/**
 * Fila de la planilla de resultados de un jugador: asistencia, goles,
 * asistencias y MVP. Extraída del organizador para reducir su tamaño.
 */
export function StatsTableRow({
  player,
  stats,
  isTeamA,
  played,
  onUpdateStat,
  onToggleMvp,
}: StatsTableRowProps) {
  const disabled = played || !stats.attended;

  return (
    <li
      className={cn(
        "grid grid-cols-[1fr_repeat(4,3.8rem)] md:grid-cols-[1fr_repeat(4,5rem)] items-center px-4 py-2.5",
        stats.attended ? "" : "opacity-50 bg-secondary/10",
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <PlayerAvatar player={player} size="sm" />
        <div className="min-w-0">
          <div className="text-xs font-semibold truncate flex items-center gap-1">
            {player.nickname}
            <span
              className={cn(
                "size-1.5 rounded-full inline-block shrink-0",
                isTeamA ? "bg-lime" : "bg-gold",
              )}
            />
          </div>
          <span className="text-[9px] text-muted-foreground uppercase">{player.position}</span>
        </div>
      </div>

      {/* Checkbox Asistencia */}
      <div className="flex justify-center">
        <input
          type="checkbox"
          checked={stats.attended}
          disabled={played}
          onChange={(e) => onUpdateStat("attended", e.target.checked)}
          className="size-4 rounded border-border bg-secondary text-lime focus:ring-lime focus:ring-offset-background cursor-pointer"
        />
      </div>

      {/* Contador Goles */}
      <div className="flex items-center justify-center gap-1 font-mono text-xs">
        <button
          onClick={() => onUpdateStat("goals", Math.max(0, stats.goals - 1))}
          disabled={disabled}
          className="size-5 rounded bg-secondary hover:bg-border text-[9px] flex items-center justify-center font-bold"
        >
          -
        </button>
        <span className="w-4 text-center tabular-nums">{stats.goals}</span>
        <button
          onClick={() => onUpdateStat("goals", stats.goals + 1)}
          disabled={disabled}
          className="size-5 rounded bg-secondary hover:bg-border text-[9px] flex items-center justify-center font-bold"
        >
          +
        </button>
      </div>

      {/* Contador Asistencias */}
      <div className="flex items-center justify-center gap-1 font-mono text-xs">
        <button
          onClick={() => onUpdateStat("assists", Math.max(0, stats.assists - 1))}
          disabled={disabled}
          className="size-5 rounded bg-secondary hover:bg-border text-[9px] flex items-center justify-center font-bold"
        >
          -
        </button>
        <span className="w-4 text-center tabular-nums">{stats.assists}</span>
        <button
          onClick={() => onUpdateStat("assists", stats.assists + 1)}
          disabled={disabled}
          className="size-5 rounded bg-secondary hover:bg-border text-[9px] flex items-center justify-center font-bold"
        >
          +
        </button>
      </div>

      {/* MVP */}
      <div className="flex justify-center">
        <button
          onClick={() => !disabled && onToggleMvp()}
          disabled={disabled}
          className={cn(
            "p-1 rounded-full border transition",
            stats.mvp
              ? "bg-gold/20 border-gold/50 text-gold"
              : "border-border/40 text-muted-foreground/30 hover:border-border hover:text-muted-foreground",
          )}
        >
          <Award className="size-4" />
        </button>
      </div>
    </li>
  );
}
