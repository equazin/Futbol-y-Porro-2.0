import { useCallback, useEffect, useState } from "react";
import { Wallet, Plus, Pencil, Trash2, ArrowUpRight, ArrowDownRight, X } from "lucide-react";
import { toast } from "sonner";
import {
  getFondoMovimientos,
  saveFondoMovimiento,
  deleteFondoMovimiento,
} from "@/lib/api/picado.functions";
import type { FondoMovimiento } from "@/types/picado";
import { cn } from "@/lib/utils";

const SLUG = import.meta.env.VITE_GROUP_SLUG || "fyp-fc";

type FormState = Partial<FondoMovimiento> & { id?: string | null };

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const emptyForm: FormState = {
  id: null,
  tipo: "ingreso",
  concepto: "",
  monto: 0,
  fecha: todayISO(),
};

function formatMoney(n: number): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

/**
 * Gestión del fondo común (libro de caja). Carga sus propios datos.
 * Calcado de RecurrencesTab para mantener consistencia.
 */
export function FondoTab() {
  const [movimientos, setMovimientos] = useState<FondoMovimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMovimientos(await getFondoMovimientos({ data: { slug: SLUG } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar el fondo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ingresos = movimientos
    .filter((m) => m.tipo === "ingreso")
    .reduce((s, m) => s + m.monto, 0);
  const egresos = movimientos.filter((m) => m.tipo === "egreso").reduce((s, m) => s + m.monto, 0);
  const saldo = ingresos - egresos;

  const openCreate = () => {
    setForm({ ...emptyForm, fecha: todayISO() });
    setShowForm(true);
  };

  const openEdit = (m: FondoMovimiento) => {
    setForm({ ...m, fecha: m.fecha.slice(0, 10) });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.concepto?.trim()) {
      toast.error("Ingresá un concepto.");
      return;
    }
    if (!form.monto || form.monto <= 0) {
      toast.error("Ingresá un monto válido.");
      return;
    }
    const promise = saveFondoMovimiento({
      data: { slug: SLUG, movimiento: form },
    }).then(load);
    toast.promise(promise, {
      loading: "Guardando movimiento...",
      success: "Movimiento guardado.",
      error: (err) => (err instanceof Error ? err.message : "Error al guardar"),
    });
    await promise.catch(() => {});
    setShowForm(false);
  };

  const handleDelete = async (m: FondoMovimiento) => {
    if (!confirm(`¿Eliminar "${m.concepto}" ($${formatMoney(m.monto)})?`)) return;
    const promise = deleteFondoMovimiento({ data: { id: m.id } }).then(load);
    toast.promise(promise, {
      loading: "Eliminando...",
      success: "Movimiento eliminado.",
      error: "Error al eliminar",
    });
  };

  return (
    <div className="rounded-3xl border border-border/60 bg-card/40 backdrop-blur p-6 space-y-5 max-w-2xl mx-auto animate-fade-in font-sans">
      <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="size-5 text-lime" />
            <h2 className="font-display text-2xl uppercase">Fondo Común</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Saldo actual:{" "}
            <span className="font-display text-lime tabular-nums">${formatMoney(saldo)}</span>
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-lime px-3 py-2 text-xs font-bold text-lime-foreground hover:brightness-110 shadow-glow transition"
        >
          <Plus className="size-3.5" /> Nuevo movimiento
        </button>
      </div>

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-8">Cargando movimientos...</div>
      ) : movimientos.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-8 border border-dashed border-border/40 rounded-2xl">
          No hay movimientos. Agregá el primero (cuotas, gastos, multas...).
        </div>
      ) : (
        <ul className="space-y-2">
          {movimientos.map((m) => {
            const esIngreso = m.tipo === "ingreso";
            return (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-3 py-2.5"
              >
                <span
                  className={cn(
                    "grid place-items-center size-8 rounded-lg border shrink-0",
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
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{m.concepto}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(m.fecha).toLocaleDateString("es-AR", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </div>
                </div>
                <span
                  className={cn(
                    "font-display text-sm tabular-nums shrink-0",
                    esIngreso ? "text-lime" : "text-out",
                  )}
                >
                  {esIngreso ? "+" : "−"}${formatMoney(m.monto)}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(m)}
                    className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                    title="Editar"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(m)}
                    className="p-2 rounded-lg hover:bg-out/15 text-muted-foreground hover:text-out transition"
                    title="Eliminar"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showForm && (
        <MovimientoModal
          form={form}
          setForm={setForm}
          onClose={() => setShowForm(false)}
          onSubmit={handleSave}
        />
      )}
    </div>
  );
}

function MovimientoModal({
  form,
  setForm,
  onClose,
  onSubmit,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl border border-border/60 bg-card p-6 shadow-2xl space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition"
        >
          <X className="size-4" />
        </button>
        <h3 className="font-display text-xl uppercase text-lime">
          {form.id ? "Editar movimiento" : "Nuevo movimiento"}
        </h3>

        <form onSubmit={onSubmit} className="space-y-3">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-2">
            {(["ingreso", "egreso"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set("tipo", t)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-sm font-semibold uppercase tracking-wider transition",
                  form.tipo === t
                    ? t === "ingreso"
                      ? "bg-lime/15 border-lime/50 text-lime"
                      : "bg-out/15 border-out/50 text-out"
                    : "border-border bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "ingreso" ? "↑ Ingreso" : "↓ Egreso"}
              </button>
            ))}
          </div>

          <Field label="Concepto">
            <input
              type="text"
              value={form.concepto || ""}
              onChange={(e) => set("concepto", e.target.value)}
              placeholder="Ej. Cuotas junio, pelota nueva..."
              className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:border-lime"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Monto ($)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.monto ?? ""}
                onChange={(e) => set("monto", Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm text-center font-mono focus:outline-none focus:border-lime"
              />
            </Field>
            <Field label="Fecha">
              <input
                type="date"
                value={(form.fecha || todayISO()).slice(0, 10)}
                onChange={(e) => set("fecha", e.target.value)}
                className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:border-lime"
              />
            </Field>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-secondary transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-lime px-4 py-2.5 text-xs font-bold text-lime-foreground hover:brightness-110 shadow-glow transition"
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase font-bold text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
