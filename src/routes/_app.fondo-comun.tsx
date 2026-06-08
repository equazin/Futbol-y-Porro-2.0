import { createFileRoute } from "@tanstack/react-router";
import { Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { getFondoMovimientos } from "@/lib/api/picado.functions";
import type { FondoMovimiento } from "@/types/picado";
import { cn } from "@/lib/utils";

const SLUG = import.meta.env.VITE_GROUP_SLUG || "fyp-fc";

export const Route = createFileRoute("/_app/fondo-comun")({
  component: FondoComun,
  loader: async (): Promise<FondoMovimiento[]> => {
    try {
      return await getFondoMovimientos({ data: { slug: SLUG } });
    } catch {
      // No romper el prerender ni la carga si Supabase no responde.
      return [];
    }
  },
});

function formatMoney(n: number): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function FondoComun() {
  const movimientos = Route.useLoaderData();

  const ingresos = movimientos
    .filter((m) => m.tipo === "ingreso")
    .reduce((sum, m) => sum + m.monto, 0);
  const egresos = movimientos
    .filter((m) => m.tipo === "egreso")
    .reduce((sum, m) => sum + m.monto, 0);
  const saldo = ingresos - egresos;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 md:px-6 py-6 space-y-6">
      {/* Header / saldo */}
      <section className="relative overflow-hidden rounded-[28px] border border-lime/20 bg-card/50 backdrop-blur p-6 md:p-8">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-lime/60 to-lime/0" />
        <div className="absolute -right-16 -top-16 size-64 rounded-full bg-lime/10 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-2 text-lime">
            <Wallet className="size-5" />
            <h1 className="font-display text-2xl md:text-3xl uppercase">Fondo Común FYP</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            La caja del club — transparente para todos.
          </p>

          <div className="mt-6 text-center">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              Saldo actual
            </div>
            <div className="font-display text-6xl md:text-7xl leading-none mt-1 hero-accent tabular-nums">
              ${formatMoney(saldo)}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <Mini label="Ingresos" value={`$${formatMoney(ingresos)}`} accent="lime" />
            <Mini label="Egresos" value={`$${formatMoney(egresos)}`} accent="out" />
            <Mini label="Movimientos" value={String(movimientos.length)} accent="muted" />
          </div>
        </div>
      </section>

      {/* Movimientos */}
      <section>
        <h2 className="font-display text-xl uppercase tracking-wider flex items-center gap-3 mb-3">
          <span className="h-6 w-1.5 rounded-full bg-gradient-to-b from-lime to-lime/30" />
          Movimientos
        </h2>

        {movimientos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/40 bg-card/30 p-8 text-center text-sm text-muted-foreground">
            Todavía no hay movimientos registrados.
          </div>
        ) : (
          <ul className="rounded-2xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
            {movimientos.map((m) => {
              const esIngreso = m.tipo === "ingreso";
              return (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={cn(
                      "grid place-items-center size-9 rounded-xl border shrink-0",
                      esIngreso
                        ? "bg-lime/10 border-lime/30 text-lime"
                        : "bg-out/10 border-out/30 text-out",
                    )}
                  >
                    {esIngreso ? (
                      <ArrowUpRight className="size-4" />
                    ) : (
                      <ArrowDownRight className="size-4" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{m.concepto}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(m.fecha).toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "font-display text-base tabular-nums shrink-0",
                      esIngreso ? "text-lime" : "text-out",
                    )}
                  >
                    {esIngreso ? "+" : "−"}${formatMoney(m.monto)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Mini({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "lime" | "out" | "muted";
}) {
  const color = accent === "lime" ? "text-lime" : accent === "out" ? "text-out" : "text-foreground";
  return (
    <div className="rounded-xl border border-border/50 bg-secondary/20 px-3 py-2.5 text-center">
      <div className={cn("font-display text-lg tabular-nums leading-none", color)}>{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mt-1">
        {label}
      </div>
    </div>
  );
}
