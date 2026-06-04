import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Award,
  CalendarDays,
  CheckCircle2,
  Clock,
  Goal,
  LineChart,
  MapPin,
  Star,
  Trophy,
  UserRound,
} from "lucide-react";
import { useMemo } from "react";
import type { ComponentType } from "react";
import { PlayerAvatar } from "@/components/Avatar";
import { usePicadoPlayer } from "@/hooks/use-picado-player";
import { computeRanking, type StoredMatch, useStore } from "@/store/match-store";
import type { Player } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/")({
  component: Home,
});

const POS_MAP: Record<string, Player["position"]> = {
  arquero: "ARQ",
  defensor: "DEF",
  mediocampista: "MED",
  delantero: "DEL",
  polifuncional: "MED",
};

function Home() {
  const { stored } = usePicadoPlayer();
  const { matches, rules, players } = useStore();

  const ranking = useMemo(() => computeRanking(matches, rules, players), [matches, rules, players]);
  const playerMap = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const rankingIndex = ranking.findIndex((row) => row.player.id === stored?.player_id);
  const stats = rankingIndex >= 0 ? ranking[rankingIndex] : null;
  const player = stored ? (playerMap.get(stored.player_id) ?? playerFromStored(stored)) : null;

  const playedMatches = useMemo(
    () =>
      [...matches]
        .filter((match) => match.played && match.result)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [matches],
  );

  const upcomingMatches = useMemo(
    () =>
      [...matches]
        .filter((match) => !match.played && match.status === "open")
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 4),
    [matches],
  );

  const myRecentMatches = useMemo(
    () =>
      stored
        ? playedMatches
            .filter((match) => Boolean(match.result?.stats?.[stored.player_id]))
            .slice(0, 4)
        : [],
    [playedMatches, stored],
  );

  if (!stored || !player) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center text-sm text-muted-foreground">
        No se pudo cargar tu ficha. Cerra sesion e ingresa nuevamente.
      </div>
    );
  }

  const attended = stats?.attended ?? 0;
  const seasonMatches = playedMatches.length;
  const attendanceRate = seasonMatches > 0 ? Math.round((attended / seasonMatches) * 100) : 0;
  const winRate = attended > 0 ? Math.round(((stats?.wins ?? 0) / attended) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 md:px-6 md:py-8">
      <section className="overflow-hidden rounded-3xl border border-border/60 bg-card">
        <div className="relative pitch-lines px-5 py-7 md:px-8 md:py-9">
          <div className="absolute inset-0 bg-gradient-to-br from-background/10 via-card/80 to-card" />
          <div className="relative grid gap-6 md:grid-cols-[1.1fr_0.9fr] md:items-end">
            <div className="flex items-start gap-4">
              <PlayerAvatar
                player={player}
                size="lg"
                className="!size-20 !text-2xl ring-4 ring-card"
              />
              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-lime/30 bg-lime/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-lime">
                  <UserRound className="size-3" />
                  Perfil verificado
                </div>
                <h1 className="font-display text-5xl uppercase leading-none md:text-6xl">
                  {player.nickname}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {player.name} · {player.position} · ELO {player.rating}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <HeroMetric
                label="Ranking"
                value={rankingIndex >= 0 ? `#${rankingIndex + 1}` : "-"}
              />
              <HeroMetric label="Puntos" value={String(stats?.points ?? 0)} accent />
              <HeroMetric label="Asistencia" value={`${attendanceRate}%`} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric icon={CalendarDays} label="Partidos jugados" value={attended} />
        <Metric icon={Goal} label="Goles" value={stats?.goals ?? 0} accent="text-lime" />
        <Metric icon={Award} label="MVP" value={stats?.mvps ?? 0} accent="text-gold" />
        <Metric
          icon={Star}
          label="Goles de la fecha"
          value={stats?.goalsOfTheDay ?? 0}
          accent="text-gold"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-3xl uppercase">Tus proximos partidos</h2>
              <p className="text-sm text-muted-foreground">
                Estado de tu lugar en cada convocatoria abierta.
              </p>
            </div>
            <Link
              to="/partidos"
              className="hidden text-xs font-bold uppercase text-lime hover:underline sm:inline"
            >
              Ver todos
            </Link>
          </div>

          {upcomingMatches.length === 0 ? (
            <EmptyState text="No hay partidos abiertos por ahora." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {upcomingMatches.map((match) => (
                <PersonalMatchCard key={match.id} match={match} playerId={stored.player_id} />
              ))}
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-border/60 bg-card p-5">
          <h2 className="font-display text-3xl uppercase">Resumen temporada</h2>
          <div className="mt-4 space-y-3">
            <SeasonRow
              label="Record"
              value={`${stats?.wins ?? 0}V / ${stats?.draws ?? 0}E / ${stats?.losses ?? 0}D`}
            />
            <SeasonRow label="Efectividad" value={`${winRate}%`} />
            <SeasonRow label="Asistencias" value={String(stats?.assists ?? 0)} />
            <SeasonRow label="Ausencias" value={String(stats?.absences ?? 0)} />
          </div>
          <Link
            to="/perfil"
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-lime/40 bg-lime/10 px-4 py-3 text-sm font-bold text-lime transition hover:bg-lime/15"
          >
            Ver perfil completo
            <ArrowRight className="size-4" />
          </Link>
        </aside>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl uppercase">Ultimos partidos</h2>
            <p className="text-sm text-muted-foreground">
              Tu rendimiento registrado en partidos cerrados.
            </p>
          </div>
          <Link
            to="/ranking"
            className="hidden text-xs font-bold uppercase text-lime hover:underline sm:inline"
          >
            Ver ranking
          </Link>
        </div>

        {myRecentMatches.length === 0 ? (
          <EmptyState text="Todavia no tenes partidos jugados registrados." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {myRecentMatches.map((match) => (
              <RecentMatchCard key={match.id} match={match} playerId={stored.player_id} />
            ))}
          </div>
        )}
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

function HeroMetric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/35 px-4 py-3 backdrop-blur">
      <div className={cn("font-display text-3xl leading-none tabular-nums", accent && "text-lime")}>
        {value}
      </div>
      <div className="mt-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card px-4 py-4">
      <div className="flex items-center justify-between">
        <Icon className={cn("size-5 text-muted-foreground", accent)} />
        <span className={cn("font-display text-4xl leading-none tabular-nums", accent)}>
          {value}
        </span>
      </div>
      <div className="mt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function PersonalMatchCard({ match, playerId }: { match: StoredMatch; playerId: string }) {
  const status = match.confirmed.includes(playerId)
    ? "Titular"
    : match.waitlist.includes(playerId)
      ? "Espera"
      : "No anotado";
  const isIn = status !== "No anotado";
  const date = new Date(match.date);

  return (
    <Link
      to="/partidos/$id"
      params={{ id: match.id }}
      className="group rounded-2xl border border-border/60 bg-card p-4 transition hover:border-lime/40 hover:bg-secondary/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-lime">
            <CalendarDays className="size-3.5" />
            {date.toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "short" })}
          </div>
          <h3 className="mt-2 text-sm font-semibold text-foreground">{match.venue}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} hs
            </span>
            <span>{match.format}</span>
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
            isIn ? "bg-lime/10 text-lime" : "bg-secondary text-muted-foreground",
          )}
        >
          {status}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {match.confirmed.length}/{match.capacity} titulares
        </span>
        <span className="inline-flex items-center gap-1 font-semibold text-lime">
          {isIn ? "Ver detalle" : "Anotarme"}
          <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function RecentMatchCard({ match, playerId }: { match: StoredMatch; playerId: string }) {
  const row = match.result?.stats?.[playerId];
  const date = new Date(match.date);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <MapPin className="size-3.5" />
            {match.venue}
          </div>
          <h3 className="mt-2 font-display text-2xl uppercase leading-none">
            {date.toLocaleDateString("es-AR", { day: "2-digit", month: "long" })}
          </h3>
        </div>
        <span className="rounded-md bg-secondary px-2 py-1 text-xs font-semibold text-foreground">
          {match.result?.scoreA ?? 0}-{match.result?.scoreB ?? 0}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        <MiniStat label="Asistio" value={row?.attended ? "Si" : "No"} icon={CheckCircle2} />
        <MiniStat label="Goles" value={String(row?.goals ?? 0)} icon={Goal} />
        <MiniStat label="MVP" value={row?.mvp ? "Si" : "No"} icon={Trophy} />
        <MiniStat label="GDF" value={row?.golVote ? "Si" : "No"} icon={Star} />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl bg-secondary/35 px-2 py-2">
      <Icon className="mx-auto mb-1 size-3.5 text-muted-foreground" />
      <div className="font-display text-lg leading-none">{value}</div>
      <div className="mt-1 text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function SeasonRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-3 last:border-b-0 last:pb-0">
      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <LineChart className="size-4 text-lime" />
        {label}
      </span>
      <span className="font-mono text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
