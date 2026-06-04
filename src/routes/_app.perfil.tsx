import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, CalendarDays, Goal, LogOut, Shield, Star, Trophy, UserRound } from "lucide-react";
import { useMemo } from "react";
import type { ComponentType } from "react";
import { PlayerAvatar } from "@/components/Avatar";
import { usePicadoPlayer } from "@/hooks/use-picado-player";
import { computeRanking, type StoredMatch, useStore } from "@/store/match-store";
import type { Player } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/perfil")({
  component: Perfil,
});

const POS_MAP: Record<string, Player["position"]> = {
  arquero: "ARQ",
  defensor: "DEF",
  mediocampista: "MED",
  delantero: "DEL",
  polifuncional: "MED",
};

function Perfil() {
  const { stored, clear } = usePicadoPlayer();
  const { matches, rules, players } = useStore();

  const ranking = useMemo(() => computeRanking(matches, rules, players), [matches, rules, players]);
  const playerMap = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const rankingIndex = ranking.findIndex((row) => row.player.id === stored?.player_id);
  const stats = rankingIndex >= 0 ? ranking[rankingIndex] : null;
  const player = stored ? (playerMap.get(stored.player_id) ?? playerFromStored(stored)) : null;

  const upcoming = useMemo(
    () =>
      stored
        ? [...matches]
            .filter(
              (match) =>
                !match.played &&
                match.status === "open" &&
                [...match.confirmed, ...match.waitlist].includes(stored.player_id),
            )
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        : [],
    [matches, stored],
  );

  const history = useMemo(
    () =>
      stored
        ? [...matches]
            .filter((match) => match.played && Boolean(match.result?.stats?.[stored.player_id]))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        : [],
    [matches, stored],
  );

  if (!stored || !player) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center text-sm text-muted-foreground">
        No se pudo cargar tu perfil.
      </div>
    );
  }

  const attended = stats?.attended ?? 0;
  const winRate = attended > 0 ? Math.round(((stats?.wins ?? 0) / attended) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">
      <section className="overflow-hidden rounded-3xl border border-border/60 bg-card">
        <div className="relative pitch-lines h-28" />
        <div className="relative px-5 pb-5 -mt-12">
          <PlayerAvatar player={player} size="lg" className="!size-24 !text-3xl ring-4 ring-card" />
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-lime/30 bg-lime/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-lime">
                <Shield className="size-3" />
                Jugador verificado
              </div>
              <h1 className="font-display text-5xl uppercase leading-none">{player.nickname}</h1>
              <div className="mt-1 text-sm text-muted-foreground">
                {player.name} · {player.position} · Ranking{" "}
                {rankingIndex >= 0 ? `#${rankingIndex + 1}` : "-"}
              </div>
            </div>

            <button
              onClick={clear}
              className="inline-flex items-center gap-2 rounded-xl border border-out/30 bg-out/10 px-4 py-2.5 text-sm font-semibold text-out transition hover:bg-out/15"
            >
              <LogOut className="size-4" />
              Cerrar sesion
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <ProfileStat label="ELO" value={player.rating} icon={UserRound} />
        <ProfileStat label="Puntos" value={stats?.points ?? 0} icon={Trophy} accent="text-lime" />
        <ProfileStat label="Partidos" value={attended} icon={CalendarDays} />
        <ProfileStat label="Goles" value={stats?.goals ?? 0} icon={Goal} accent="text-lime" />
        <ProfileStat label="MVP" value={stats?.mvps ?? 0} icon={Award} accent="text-gold" />
      </section>

      <section className="mt-6 grid gap-6 md:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h2 className="font-display text-3xl uppercase">Ficha completa</h2>
          <div className="mt-4 space-y-3">
            <InfoRow label="Nombre" value={player.name} />
            <InfoRow label="Apodo" value={player.nickname} />
            <InfoRow label="Posicion" value={player.position} />
            <InfoRow
              label="Record"
              value={`${stats?.wins ?? 0}V / ${stats?.draws ?? 0}E / ${stats?.losses ?? 0}D`}
            />
            <InfoRow label="Efectividad" value={`${winRate}%`} />
            <InfoRow label="Asistencias" value={String(stats?.assists ?? 0)} />
            <InfoRow label="Goles de la fecha" value={String(stats?.goalsOfTheDay ?? 0)} />
            <InfoRow label="Ausencias" value={String(stats?.absences ?? 0)} />
          </div>
        </div>

        <div className="space-y-6">
          <ProfileList
            title="Tus proximos picados"
            empty="No estas anotado en ningun picado abierto."
            matches={upcoming}
            playerId={stored.player_id}
            mode="upcoming"
          />
          <ProfileList
            title="Historial reciente"
            empty="Todavia no hay partidos jugados en tu perfil."
            matches={history.slice(0, 5)}
            playerId={stored.player_id}
            mode="history"
          />
        </div>
      </section>
    </div>
  );
}

function playerFromStored(
  stored: NonNullable<ReturnType<typeof usePicadoPlayer>["stored"]>,
): Player {
  const nickname = stored.apodo || stored.nombre;
  return {
    id: stored.player_id,
    name: stored.nombre,
    nickname,
    position: stored.posicion ? (POS_MAP[stored.posicion] ?? "MED") : "MED",
    rating: stored.elo ?? 1000,
    goals: 0,
    played: 0,
    initials: nickname.slice(0, 2).toUpperCase(),
    color: "oklch(0.78 0.18 145)",
    foto_url: stored.foto_url ?? null,
  };
}

function ProfileStat({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <Icon className={cn("mb-3 size-5 text-muted-foreground", accent)} />
      <div className={cn("font-display text-4xl leading-none tabular-nums", accent)}>{value}</div>
      <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-mono text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function ProfileList({
  title,
  empty,
  matches,
  playerId,
  mode,
}: {
  title: string;
  empty: string;
  matches: StoredMatch[];
  playerId: string;
  mode: "upcoming" | "history";
}) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      {matches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
          {empty}
        </div>
      ) : (
        <ul className="space-y-2">
          {matches.map((match) => (
            <ProfileMatchRow key={match.id} match={match} playerId={playerId} mode={mode} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ProfileMatchRow({
  match,
  playerId,
  mode,
}: {
  match: StoredMatch;
  playerId: string;
  mode: "upcoming" | "history";
}) {
  const date = new Date(match.date);
  const status = match.confirmed.includes(playerId)
    ? "Titular"
    : match.waitlist.includes(playerId)
      ? "Espera"
      : "No anotado";
  const row = match.result?.stats?.[playerId];

  return (
    <li>
      <Link
        to="/partidos/$id"
        params={{ id: match.id }}
        className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 transition hover:border-lime/40"
      >
        <div className="w-12 text-center">
          <div className="font-display text-2xl leading-none">{date.getDate()}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {date.toLocaleDateString("es-AR", { month: "short" })}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{match.venue}</div>
          <div className="text-xs text-muted-foreground">
            {match.format} ·{" "}
            {date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} hs
          </div>
        </div>
        <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {mode === "upcoming" ? status : `${row?.goals ?? 0}G ${row?.mvp ? "MVP" : ""}`.trim()}
        </span>
      </Link>
    </li>
  );
}
