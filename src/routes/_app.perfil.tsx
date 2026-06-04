import { createFileRoute } from "@tanstack/react-router";
import { Bell, LogOut, Settings, Trophy } from "lucide-react";
import { players } from "@/lib/mock-data";
import { useStore } from "@/store/match-store";
import { PlayerAvatar } from "@/components/Avatar";

export const Route = createFileRoute("/_app/perfil")({
  component: Perfil,
});

function Perfil() {
  const { matches } = useStore();
  const me = players[0]; // mock
  const upcoming = matches.filter((m) => m.status === "open" && m.confirmed.includes(me.id));

  return (
    <div className="mx-auto max-w-2xl px-4 md:px-6 py-6">
      <section className="rounded-3xl border border-border/60 bg-card overflow-hidden">
        <div className="relative pitch-lines h-24" />
        <div className="px-5 pb-5 -mt-10 relative">
          <PlayerAvatar player={me} size="lg" className="ring-4 ring-card !size-20 !text-2xl" />
          <div className="mt-3 flex items-end justify-between flex-wrap gap-2">
            <div>
              <h1 className="font-display text-3xl uppercase leading-none">{me.nickname}</h1>
              <div className="text-sm text-muted-foreground">{me.name} · {me.position}</div>
            </div>
            <div className="flex gap-4 text-right">
              <Stat v={me.rating} l="Rating" accent />
              <Stat v={me.goals} l="Goles" />
              <Stat v={me.played} l="PJ" />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Tus próximos picados</h2>
        {upcoming.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
            No estás anotado en ningún picado todavía.
          </div>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
                <div className="text-center w-12">
                  <div className="font-display text-xl leading-none">{new Date(m.date).getDate()}</div>
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider">
                    {new Date(m.date).toLocaleDateString("es-AR", { month: "short" })}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{m.venue}</div>
                  <div className="text-xs text-muted-foreground">{m.format} · {new Date(m.date).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} hs</div>
                </div>
                <span className="rounded-full bg-confirmed/15 text-confirmed text-[10px] font-semibold uppercase tracking-wider px-2 py-1">Titular</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Cuenta</h2>
        <ul className="rounded-2xl border border-border/60 bg-card divide-y divide-border/60 overflow-hidden">
          <Row icon={<Bell className="size-4" />} label="Notificaciones" />
          <Row icon={<Trophy className="size-4" />} label="Mis estadísticas" />
          <Row icon={<Settings className="size-4" />} label="Preferencias" />
          <Row icon={<LogOut className="size-4 text-out" />} label="Cerrar sesión" danger />
        </ul>
      </section>
    </div>
  );
}

function Stat({ v, l, accent }: { v: number; l: string; accent?: boolean }) {
  return (
    <div>
      <div className={"font-display text-2xl tabular-nums leading-none " + (accent ? "text-lime" : "")}>{v}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{l}</div>
    </div>
  );
}

function Row({ icon, label, danger }: { icon: React.ReactNode; label: string; danger?: boolean }) {
  return (
    <li>
      <button className={"w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-secondary/40 transition " + (danger ? "text-out" : "")}>
        {icon}
        <span className="flex-1">{label}</span>
        <span className="text-muted-foreground">›</span>
      </button>
    </li>
  );
}
