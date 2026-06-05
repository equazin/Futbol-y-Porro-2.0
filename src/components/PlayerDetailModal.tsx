import { X, Trophy, Award, Calendar, Flame, Shield, Target, User, Compass, HelpCircle } from "lucide-react";
import { PlayerPoints } from "@/store/match-store";
import { PlayerAvatar } from "@/components/Avatar";
import { cn } from "@/lib/utils";

interface PlayerDetailModalProps {
  playerStats: PlayerPoints;
  onClose: () => void;
}

const POS_LABELS: Record<string, string> = {
  ARQ: "Arquero",
  DEF: "Defensor",
  MED: "Mediocampista",
  DEL: "Delantero",
};

const POS_COLORS: Record<string, string> = {
  ARQ: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  DEF: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  MED: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  DEL: "text-rose-400 bg-rose-500/10 border-rose-500/20",
};

const POS_GLOW: Record<string, string> = {
  ARQ: "from-blue-500/30 via-blue-500/5 to-transparent",
  DEF: "from-emerald-500/30 via-emerald-500/5 to-transparent",
  MED: "from-amber-500/30 via-amber-500/5 to-transparent",
  DEL: "from-rose-500/30 via-rose-500/5 to-transparent",
};

const POS_BORDER: Record<string, string> = {
  ARQ: "border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.2)]",
  DEF: "border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.2)]",
  MED: "border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.2)]",
  DEL: "border-rose-500/50 shadow-[0_0_30px_rgba(244,63,94,0.2)]",
};

const POS_RING: Record<string, string> = {
  ARQ: "ring-blue-500/40",
  DEF: "ring-emerald-500/40",
  MED: "ring-amber-500/40",
  DEL: "ring-rose-500/40",
};

export function PlayerDetailModal({ playerStats, onClose }: PlayerDetailModalProps) {
  const { player, attended, wins, draws, losses, goals, assists, mvps, badges, bestPartner, nemesis } = playerStats;
  const pos = player.position || "MED";

  const winRate = attended > 0 ? Math.round((wins / attended) * 100) : 0;
  const goalsPerMatch = attended > 0 ? (goals / attended).toFixed(1) : "0.0";
  const assistsPerMatch = attended > 0 ? (assists / attended).toFixed(1) : "0.0";

  // Atributos estilo FUT 1-99, calculados a partir del rendimiento real
  // (goles, asistencias, win rate y presencia), sin depender de ningún rating.
  const attrAtaque = Math.min(99, Math.max(40, Math.round(55 + (goalsPerMatch as any) * 15 + (winRate > 50 ? 5 : 0))));
  const attrDefensa = Math.min(
    99,
    Math.max(40, Math.round(50 + (pos === "DEF" || pos === "ARQ" ? 20 : 0) + (winRate > 50 ? 8 : 0)))
  );
  const attrPase = Math.min(99, Math.max(40, Math.round(55 + (assistsPerMatch as any) * 20)));
  const attrPresencia = Math.min(99, Math.max(40, Math.round(45 + (attended > 0 ? Math.min(10, attended) * 5 : 0))));

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
      {/* Background click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* FUT Card Container */}
      <div
        className={cn(
          "relative w-full max-w-sm rounded-[36px] border bg-gradient-to-b from-card/90 to-background/95 overflow-hidden shadow-2xl p-6 flex flex-col items-center max-h-[95vh]",
          POS_BORDER[pos] || "border-border/60"
        )}
      >
        {/* Subtle Pitch Lines Mask Overlay (Fade to bottom) */}
        <div 
          className="absolute inset-x-0 top-0 h-44 pitch-lines opacity-[0.06] -z-10"
          style={{ maskImage: "linear-gradient(to bottom, black, transparent)", WebkitMaskImage: "linear-gradient(to bottom, black, transparent)" }}
        />

        {/* Glow behind card */}
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-52 bg-gradient-to-b -z-20 blur-3xl opacity-50 rounded-t-[36px]",
            POS_GLOW[pos] || "from-secondary/20"
          )}
        />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition z-10"
        >
          <X className="size-4" />
        </button>

        {/* FUT Card Header */}
        <div className="w-full flex items-center justify-between mt-1 mb-4 border-b border-border/40 pb-3 shrink-0">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Ficha Oficial
            </span>
            <span className="font-display text-lg uppercase font-bold text-foreground">
              {player.nickname}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold block">
              Posición
            </span>
            <span className="font-display text-2xl text-lime uppercase font-black leading-none">
              {pos}
            </span>
          </div>
        </div>

        {/* Scrollable Content Wrapper */}
        <div className="w-full overflow-y-auto scrollbar-none space-y-4 pr-0.5 flex flex-col items-center">
          {/* Player avatar with position-colored ring */}
          <div className="relative shrink-0">
            <PlayerAvatar
              player={player}
              size="lg"
              className={cn("!size-24 !text-3xl ring-4 ring-offset-4 ring-offset-card ring-inset", POS_RING[pos])}
            />
            <span className={cn(
              "absolute -bottom-1 -right-1 font-display text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-lg border",
              POS_COLORS[pos]
            )}>
              {pos}
            </span>
          </div>

          {/* Full Name & Position */}
          <div className="text-center space-y-0.5 shrink-0">
            <h3 className="font-display text-2xl uppercase font-bold tracking-tight text-foreground">
              {player.name}
            </h3>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              {POS_LABELS[pos] || "Jugador"}
            </p>
          </div>

          {/* Dynamic Badges List */}
          {badges && badges.length > 0 && (
            <div className="w-full bg-secondary/15 rounded-2xl p-3 border border-border/30 shrink-0">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold mb-1.5 flex items-center gap-1">
                🎖️ Insignias de la Temporada
              </div>
              <div className="flex flex-wrap gap-1.5">
                {badges.map((b) => (
                  <div
                    key={b.type}
                    title={b.tooltip}
                    className="flex items-center gap-1 bg-card border border-border/50 px-2 py-0.5 rounded-full text-xs font-semibold select-none cursor-help hover:border-lime/40 transition shrink-0"
                  >
                    <span>{b.icon}</span>
                    <span className="text-[9px] uppercase font-bold text-foreground/80">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Season Statistics Grid */}
          <div className="w-full grid grid-cols-3 gap-2 text-center shrink-0">
            <div className="bg-secondary/20 rounded-2xl border border-border/40 p-2.5">
              <div className="font-display text-xl tabular-nums font-bold leading-none">{attended}</div>
              <div className="text-[8px] uppercase tracking-wider text-muted-foreground mt-1">Partidos (PJ)</div>
            </div>
            <div className="bg-secondary/20 rounded-2xl border border-border/40 p-2.5">
              <div className="font-display text-xl tabular-nums font-bold leading-none text-lime">{goals}</div>
              <div className="text-[8px] uppercase tracking-wider text-muted-foreground mt-1">Goles (G)</div>
            </div>
            <div className="bg-secondary/20 rounded-2xl border border-border/40 p-2.5">
              <div className="font-display text-xl tabular-nums font-bold leading-none text-gold">{assists}</div>
              <div className="text-[8px] uppercase tracking-wider text-muted-foreground mt-1">Asistencias (A)</div>
            </div>
          </div>

          {/* Detailed stats stats row */}
          <div className="w-full bg-secondary/10 rounded-2xl px-4 py-3.5 border border-border/30 space-y-2 text-xs font-sans shrink-0">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Récord G / E / P:</span>
              <span className="font-mono text-foreground font-semibold">
                {wins}v / {draws}e / {losses}d
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground border-t border-border/30 pt-2">
              <span>Efectividad (Victorias):</span>
              <span className="font-mono text-foreground font-semibold">{winRate}%</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground border-t border-border/30 pt-2">
              <span>Goles por Partido:</span>
              <span className="font-mono text-foreground font-semibold">{goalsPerMatch}</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground border-t border-border/30 pt-2">
              <span>Asistencias por Partido:</span>
              <span className="font-mono text-foreground font-semibold">{assistsPerMatch}</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground border-t border-border/30 pt-2">
              <span>Premios MVP:</span>
              <span className="font-mono text-foreground font-semibold flex items-center gap-1">
                <Award className="size-3 text-gold" /> {mvps}
              </span>
            </div>
          </div>

          {/* Chemistry Section (Socio & Némesis) */}
          <div className="w-full grid grid-cols-2 gap-3 font-sans shrink-0">
            <div className="bg-secondary/15 rounded-2xl p-3 border border-border/30 flex flex-col items-center text-center">
              <div className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold mb-2 flex items-center gap-1">
                🤝 Mejor Socio
              </div>
              {bestPartner ? (
                <div className="flex flex-col items-center space-y-1 w-full">
                  <PlayerAvatar player={bestPartner.player} size="sm" className="!size-10 !text-sm shrink-0" />
                  <div className="text-[11px] font-bold text-foreground truncate w-full">
                    {bestPartner.player.nickname}
                  </div>
                  <div className="text-[10px] font-semibold text-emerald-400">
                    {bestPartner.winRate}% WR
                  </div>
                  <div className="text-[8px] text-muted-foreground uppercase">
                    {bestPartner.matches} {bestPartner.matches === 1 ? "partido" : "partidos"}
                  </div>
                </div>
              ) : (
                <div className="text-[10px] text-muted-foreground/60 my-auto py-3">
                  Sin datos suficientes
                </div>
              )}
            </div>

            <div className="bg-secondary/15 rounded-2xl p-3 border border-border/30 flex flex-col items-center text-center">
              <div className="text-[9px] uppercase tracking-wider text-rose-400 font-bold mb-2 flex items-center gap-1">
                ⚠️ Némesis
              </div>
              {nemesis ? (
                <div className="flex flex-col items-center space-y-1 w-full">
                  <PlayerAvatar player={nemesis.player} size="sm" className="!size-10 !text-sm shrink-0" />
                  <div className="text-[11px] font-bold text-foreground truncate w-full">
                    {nemesis.player.nickname}
                  </div>
                  <div className="text-[10px] font-semibold text-rose-400">
                    {nemesis.winRate}% WR
                  </div>
                  <div className="text-[8px] text-muted-foreground uppercase">
                    {nemesis.matches} {nemesis.matches === 1 ? "partido" : "partidos"}
                  </div>
                </div>
              ) : (
                <div className="text-[10px] text-muted-foreground/60 my-auto py-3">
                  Sin datos suficientes
                </div>
              )}
            </div>
          </div>

          {/* FUT Skill bars attributes (Ataque, Defensa, Pase, Físico, Gral) */}
          <div className="w-full space-y-2 shrink-0">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
              📊 Atributos de Juego
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <SkillBar label="ATA" value={attrAtaque} color="bg-rose-500" />
              <SkillBar label="DEF" value={attrDefensa} color="bg-emerald-500" />
              <SkillBar label="PAS" value={attrPase} color="bg-amber-500" />
              <SkillBar label="PRE" value={attrPresencia} color="bg-blue-500" />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function SkillBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between items-center text-[9px] font-bold text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono text-foreground">{value}</span>
      </div>
      <div className="h-1.5 w-full bg-secondary/40 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
