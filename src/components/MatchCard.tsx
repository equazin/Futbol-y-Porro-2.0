import { Link } from "@tanstack/react-router";
import { Clock, MapPin, Users } from "lucide-react";
import type { Match } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MatchCard({ match, featured = false }: { match: Match; featured?: boolean }) {
  const pct = Math.min(100, (match.confirmed.length / match.capacity) * 100);
  const remaining = Math.max(0, match.capacity - match.confirmed.length);
  return (
    <Link
      to="/partidos/$id"
      params={{ id: match.id }}
      className={cn(
        "group block rounded-2xl border border-border/70 bg-card p-5 transition hover:border-lime/50 hover:shadow-glow",
        featured && "border-lime/40 shadow-glow",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-3xl leading-none uppercase">{formatDate(match.date)}</div>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-3.5" />
            <span className="tabular-nums">{formatTime(match.date)} hs</span>
            <span className="opacity-50">·</span>
            <span className="font-medium text-foreground">{match.format}</span>
          </div>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider",
            remaining === 0
              ? "bg-gold/20 text-gold"
              : remaining <= 3
                ? "bg-lime/20 text-lime"
                : "bg-secondary text-muted-foreground",
          )}
        >
          {remaining === 0 ? "Completo" : `${remaining} lugar${remaining === 1 ? "" : "es"}`}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
        <MapPin className="size-3.5" />
        <span className="truncate">{match.venue}</span>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
          <span className="flex items-center gap-1">
            <Users className="size-3" /> Anotados
          </span>
          <span className="tabular-nums font-medium text-foreground">
            {match.confirmed.length}/{match.capacity}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-lime transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </Link>
  );
}
