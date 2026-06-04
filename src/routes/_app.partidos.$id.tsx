import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, CalendarDays, Check, Clock, MapPin, Share2, UserMinus, UserPlus, Users } from "lucide-react";
import { matches, playerById } from "@/lib/mock-data";
import { PlayerAvatar } from "@/components/Avatar";
import { Countdown } from "@/components/Countdown";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/partidos/$id")({
  component: MatchDetail,
  loader: ({ params }) => {
    const match = matches.find((m) => m.id === params.id);
    if (!match) throw notFound();
    return { match };
  },
});

function MatchDetail() {
  const { match } = Route.useLoaderData();
  const [joined, setJoined] = useState(false);
  const pct = Math.min(100, (match.confirmed.length / match.capacity) * 100);
  const remaining = Math.max(0, match.capacity - match.confirmed.length);

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-4 md:py-8">
      <Link to="/partidos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="size-4" /> Volver
      </Link>

      <section className="rounded-3xl border border-border/60 bg-card overflow-hidden">
        <div className="relative pitch-lines px-6 py-8 border-b border-border/60">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-card/90" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs text-lime font-semibold uppercase tracking-wider">
              <CalendarDays className="size-3.5" />
              {new Date(match.date).toLocaleDateString("es-AR", { weekday: "long" })}
            </div>
            <h1 className="font-display text-5xl md:text-6xl uppercase leading-none mt-2">
              {new Date(match.date).toLocaleDateString("es-AR", { day: "2-digit", month: "long" })}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Clock className="size-3.5" />{new Date(match.date).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} hs</span>
              <span className="flex items-center gap-1.5"><MapPin className="size-3.5" />{match.venue}</span>
              <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-foreground">{match.format}</span>
            </div>
          </div>
        </div>

        <div className="p-6 grid md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Users className="size-3.5" /> Cupo</span>
              <span className="font-display text-2xl tabular-nums">
                <span className="text-lime">{match.confirmed.length}</span>
                <span className="text-muted-foreground">/{match.capacity}</span>
              </span>
            </div>
            <div className="h-3 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-gradient-to-r from-lime to-gold transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {remaining > 0 ? <>Faltan <strong className="text-foreground tabular-nums">{remaining}</strong> jugadores</> : "Cupo completo — lista de espera abierta"}
            </div>
          </div>
          <Countdown to={match.closesAt} label="Cierra inscripción en" />
        </div>

        <div className="px-6 pb-6 flex gap-2">
          <button
            onClick={() => setJoined((v) => !v)}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition",
              joined
                ? "bg-out/15 text-out border border-out/30 hover:bg-out/25"
                : "bg-lime text-lime-foreground hover:brightness-110",
            )}
          >
            {joined ? <><UserMinus className="size-4" /> Bajarme</> : <><UserPlus className="size-4" /> Anotarme</>}
          </button>
          <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:border-lime/40 transition">
            <Share2 className="size-4" /> Compartir
          </button>
        </div>
      </section>

      {/* Titulares */}
      <section className="mt-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="size-2.5 rounded-full bg-confirmed" />
          <h2 className="font-display text-2xl uppercase">Titulares</h2>
          <span className="text-xs text-muted-foreground tabular-nums">({match.confirmed.length})</span>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {match.confirmed.map((id, i) => {
            const p = playerById(id)!;
            return (
              <li key={id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5">
                <span className="font-mono text-xs text-muted-foreground tabular-nums w-5">{String(i + 1).padStart(2, "0")}</span>
                <PlayerAvatar player={p} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.nickname}</div>
                  <div className="text-[11px] text-muted-foreground">{p.position} · {p.name}</div>
                </div>
                <Check className="size-4 text-confirmed" />
              </li>
            );
          })}
        </ul>
      </section>

      {/* Lista de espera */}
      {match.waitlist.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="size-2.5 rounded-full bg-waitlist" />
            <h2 className="font-display text-2xl uppercase">Lista de espera</h2>
            <span className="text-xs text-muted-foreground tabular-nums">({match.waitlist.length})</span>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {match.waitlist.map((id) => {
              const p = playerById(id)!;
              return (
                <li key={id} className="flex items-center gap-3 rounded-xl border border-waitlist/30 bg-waitlist/5 px-3 py-2.5">
                  <PlayerAvatar player={p} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.nickname}</div>
                    <div className="text-[11px] text-muted-foreground">{p.position}</div>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-waitlist font-semibold">Espera</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
