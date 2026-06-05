import { X } from "lucide-react";
import { PlayerAvatar } from "@/components/Avatar";
import type { Player } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type TeamCardProps = {
  team: "A" | "B";
  players: Player[];
  /** Si el admin puede arrastrar/mover jugadores (rol equipos o general). */
  canManageTeams: boolean;
  /** Si el partido ya se jugó (deshabilita el drag). */
  played: boolean;
  /** Si se muestra el botón de dar de baja (solo admin general). */
  canRemove: boolean;
  isDragOver: boolean;
  onDragStart: (e: React.DragEvent, playerId: string) => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onRemove: (playerId: string) => void;
};

/**
 * Zona de armado de un equipo (A o B) con drag & drop.
 * Reemplaza los dos bloques idénticos que vivían inline en el organizador.
 */
export function TeamCard({
  team,
  players,
  canManageTeams,
  played,
  canRemove,
  isDragOver,
  onDragStart,
  onDragEnter,
  onDragLeave,
  onDrop,
  onRemove,
}: TeamCardProps) {
  const isA = team === "A";
  const dotColor = isA ? "bg-lime" : "bg-gold";
  const dragOverClass = isA
    ? "border-lime shadow-glow bg-lime/5 scale-[1.01]"
    : "border-gold shadow-glow bg-gold/5 scale-[1.01]";

  return (
    <div
      onDragOver={(e) => {
        if (canManageTeams && !played) e.preventDefault();
      }}
      onDragEnter={() => {
        if (canManageTeams && !played) onDragEnter();
      }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "rounded-2xl border bg-card p-4 transition-all duration-200 min-h-[300px]",
        isDragOver ? dragOverClass : "border-border/60",
        played ? "opacity-90" : "",
      )}
    >
      <div className="flex items-center justify-between mb-3 border-b border-border/40 pb-2">
        <div className="flex items-center gap-2">
          <span className={cn("size-3 rounded-full", dotColor)} />
          <span className="font-display text-lg uppercase">Equipo {team}</span>
          <span className="text-xs text-muted-foreground">({players.length})</span>
        </div>
      </div>

      <ul className="space-y-1.5">
        {players.length === 0 ? (
          <div className="h-48 border border-dashed border-border/40 rounded-xl flex items-center justify-center text-xs text-muted-foreground/60">
            Arrastrá jugadores aquí
          </div>
        ) : (
          players.map((p) => (
            <li
              key={p.id}
              draggable={canManageTeams && !played}
              onDragStart={(e) => onDragStart(e, p.id)}
              className={cn(
                "flex items-center gap-3 rounded-xl bg-secondary/50 px-2.5 py-2",
                played || !canManageTeams
                  ? ""
                  : "cursor-grab active:cursor-grabbing hover:bg-secondary transition",
              )}
            >
              <PlayerAvatar player={p} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate">{p.nickname}</div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                  {p.position}
                </div>
              </div>
              {canRemove && !played && (
                <button
                  onClick={() => onRemove(p.id)}
                  className="p-1 rounded hover:bg-out/25 text-muted-foreground hover:text-out transition shrink-0"
                  title="Dar de baja de Supabase"
                >
                  <X className="size-3" />
                </button>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
