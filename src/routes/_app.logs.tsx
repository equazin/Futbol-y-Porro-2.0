import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Shield, RefreshCw, Search } from "lucide-react";
import { useStore } from "@/store/match-store";
import { listAdminLogs, type AdminAuditLog } from "@/lib/admin-audit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/logs")({
  component: LogsPage,
});

const ACCION_LABEL: Record<string, string> = {
  "match.create": "Crear partido",
  "match.update": "Editar partido",
  "match.delete": "Eliminar partido",
  "signup.add": "Anotar jugador",
  "signup.remove": "Baja de jugador",
  "player.create": "Crear jugador",
  "player.update": "Editar jugador",
  "player.delete": "Baja de jugador (plantel)",
  "rules.save": "Guardar reglas de puntaje",
  "recurrence.create": "Crear recurrencia",
  "recurrence.update": "Editar recurrencia",
  "recurrence.delete": "Eliminar recurrencia",
  "recurrence.materialize": "Materializar recurrencias",
  "fondo.create": "Alta movimiento fondo",
  "fondo.update": "Editar movimiento fondo",
  "fondo.delete": "Eliminar movimiento fondo",
};

function LogsPage() {
  const { isAdmin, players } = useStore();
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [adminFilter, setAdminFilter] = useState<string>("");
  const [accionFilter, setAccionFilter] = useState<string>("");

  const playerNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of players) map[p.id] = p.nickname || p.name;
    return map;
  }, [players]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const rows = await listAdminLogs(500);
      setLogs(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin]);

  const adminOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of logs) {
      if (!row.admin_player_id) continue;
      const label = row.admin_apodo || row.admin_nombre || row.admin_player_id.slice(0, 8);
      seen.set(row.admin_player_id, label);
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [logs]);

  const accionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of logs) set.add(row.accion);
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((row) => {
      if (adminFilter && row.admin_player_id !== adminFilter) return false;
      if (accionFilter && row.accion !== accionFilter) return false;
      if (!q) return true;
      const hay = [
        row.accion,
        row.admin_apodo ?? "",
        row.admin_nombre ?? "",
        row.target_id ?? "",
        JSON.stringify(row.payload ?? {}),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [logs, query, adminFilter, accionFilter]);

  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 md:px-6 py-16 text-center">
        <Shield className="mx-auto size-10 text-muted-foreground/60" />
        <h1 className="mt-4 font-display text-3xl uppercase">Acceso restringido</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este historial es solo para administradores. Ingresá primero desde el panel del
          organizador.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 md:px-6 py-8 space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-lime/30 bg-lime/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-lime">
            <Shield className="size-3" /> Registros de admin
          </div>
          <h1 className="mt-2 font-display text-4xl uppercase leading-none">Historial</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todas las acciones de administración registradas.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold uppercase text-muted-foreground hover:text-foreground hover:border-lime/40 transition disabled:opacity-40"
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          {loading ? "Actualizando" : "Refrescar"}
        </button>
      </header>

      <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en accion, jugador, payload…"
            className="w-full rounded-xl border border-border bg-card pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-lime/50 focus:ring-1 focus:ring-lime/20 transition"
          />
        </label>
        <select
          value={adminFilter}
          onChange={(e) => setAdminFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:border-lime/50"
        >
          <option value="">Todos los admins</option>
          {adminOptions.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={accionFilter}
          onChange={(e) => setAccionFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:border-lime/50"
        >
          <option value="">Todas las acciones</option>
          {accionOptions.map((a) => (
            <option key={a} value={a}>
              {ACCION_LABEL[a] ?? a}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/30 text-[10px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Fecha</th>
              <th className="text-left px-4 py-3">Admin</th>
              <th className="text-left px-4 py-3">Acción</th>
              <th className="text-left px-4 py-3">Objetivo</th>
              <th className="text-left px-4 py-3">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  {loading ? "Cargando…" : "Sin registros para mostrar."}
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="border-t border-border/40 align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                    {new Date(row.created_at).toLocaleString("es-AR")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground">
                      {row.admin_apodo || row.admin_nombre || "—"}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
                      {row.admin_source}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-lime/10 border border-lime/25 text-lime px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      {ACCION_LABEL[row.accion] ?? row.accion}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {row.target_id ? (
                      <span className="font-mono">
                        {playerNameMap[row.target_id] ?? row.target_id}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <PayloadCell payload={row.payload} playerNameMap={playerNameMap} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-muted-foreground/60 text-center">
        Mostrando {filtered.length} de {logs.length} registros.
      </p>
    </div>
  );
}

function PayloadCell({
  payload,
  playerNameMap,
}: {
  payload: Record<string, unknown>;
  playerNameMap: Record<string, string>;
}) {
  const entries = Object.entries(payload ?? {});
  if (entries.length === 0) {
    return <span className="text-muted-foreground/60 text-xs">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([k, v]) => {
        const raw = typeof v === "string" ? v : JSON.stringify(v);
        const display = typeof v === "string" && playerNameMap[v] ? playerNameMap[v] : raw;
        return (
          <span
            key={k}
            className="rounded-md bg-secondary/40 border border-border/40 px-2 py-0.5 text-[10px] font-mono"
          >
            <span className="text-muted-foreground/70">{k}:</span> {display}
          </span>
        );
      })}
    </div>
  );
}
