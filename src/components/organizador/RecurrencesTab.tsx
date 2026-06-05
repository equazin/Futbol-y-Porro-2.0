import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Plus, Pencil, Trash2, Zap, X } from "lucide-react";
import { toast } from "sonner";
import {
  getRecurrences,
  saveRecurrence,
  deleteRecurrence,
  materializeRecurrences,
} from "@/lib/api/picado.functions";
import type { PicadoRecurrence } from "@/types/picado";
import { cn } from "@/lib/utils";

const SLUG = import.meta.env.VITE_GROUP_SLUG || "fyp-fc";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

type FormState = Partial<PicadoRecurrence> & { id?: string | null };

const emptyForm: FormState = {
  id: null,
  dia_semana: 3,
  hora: "20:00",
  sede: "",
  formato: "7v7",
  cupo_max: 14,
  abre_dias_antes: 7,
  cierra_horas_antes: 2,
  semanas_anticipacion: 2,
  activa: true,
};

/**
 * Gestión de reglas de partidos recurrentes. Carga sus propios datos
 * vía RPC admin (incluye reglas inactivas). Self-contained para no
 * inflar el organizador.
 */
export function RecurrencesTab() {
  const [rules, setRules] = useState<PicadoRecurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getRecurrences({ data: { slug: SLUG } });
      setRules(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar recurrencias");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (r: PicadoRecurrence) => {
    setForm({ ...r, hora: r.hora.slice(0, 5) });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sede?.trim()) {
      toast.error("Ingresá la sede.");
      return;
    }
    const promise = saveRecurrence({
      data: {
        slug: SLUG,
        recurrence: { ...form, hora: `${(form.hora || "20:00").slice(0, 5)}:00` },
      },
    }).then(load);
    toast.promise(promise, {
      loading: "Guardando regla...",
      success: "Regla guardada.",
      error: (err) => (err instanceof Error ? err.message : "Error al guardar"),
    });
    await promise.catch(() => {});
    setShowForm(false);
  };

  const handleDelete = async (r: PicadoRecurrence) => {
    if (!confirm(`¿Eliminar la regla de los ${DIAS[r.dia_semana]} en ${r.sede}?`)) return;
    const promise = deleteRecurrence({ data: { id: r.id } }).then(load);
    toast.promise(promise, {
      loading: "Eliminando...",
      success: "Regla eliminada.",
      error: "Error al eliminar",
    });
  };

  const handleMaterialize = async () => {
    const promise = materializeRecurrences();
    toast.promise(promise, {
      loading: "Generando próximos partidos...",
      success: (n) => `Listo: ${n} partido(s) generado(s).`,
      error: "Error al generar partidos",
    });
  };

  return (
    <div className="rounded-3xl border border-border/60 bg-card/40 backdrop-blur p-6 space-y-5 max-w-2xl mx-auto animate-fade-in font-sans">
      <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-5 text-lime" />
          <h2 className="font-display text-2xl uppercase">Partidos Recurrentes</h2>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-lime px-3 py-2 text-xs font-bold text-lime-foreground hover:brightness-110 shadow-glow transition"
        >
          <Plus className="size-3.5" /> Nueva regla
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Cada regla genera partidos automáticamente (ej. todos los miércoles). Tocá
        <strong> Generar ahora </strong> para crear los próximos, o esperá a la generación automática.
      </p>

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-8">Cargando reglas...</div>
      ) : rules.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-8 border border-dashed border-border/40 rounded-2xl">
          No hay reglas de recurrencia. Creá una para automatizar los partidos.
        </div>
      ) : (
        <ul className="space-y-2">
          {rules.map((r) => (
            <li
              key={r.id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3",
                r.activa ? "border-border/60" : "border-border/40 opacity-60",
              )}
            >
              <div className="min-w-0">
                <div className="font-display text-base uppercase truncate">
                  {DIAS[r.dia_semana]} · {r.hora.slice(0, 5)} hs
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {r.sede} · {r.formato} · cupo {r.cupo_max}
                  {!r.activa && " · (inactiva)"}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openEdit(r)}
                  className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                  title="Editar"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(r)}
                  className="p-2 rounded-lg hover:bg-out/15 text-muted-foreground hover:text-out transition"
                  title="Eliminar"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-end border-t border-border/40 pt-4">
        <button
          onClick={handleMaterialize}
          className="inline-flex items-center gap-2 rounded-xl border border-lime/40 bg-lime/10 px-4 py-2.5 text-xs font-bold text-lime hover:bg-lime/20 transition"
        >
          <Zap className="size-3.5" /> Generar próximos partidos ahora
        </button>
      </div>

      {showForm && (
        <RecurrenceModal
          form={form}
          setForm={setForm}
          onClose={() => setShowForm(false)}
          onSubmit={handleSave}
        />
      )}
    </div>
  );
}

function RecurrenceModal({
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
      <div className="relative w-full max-w-md rounded-3xl border border-border/60 bg-card p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition"
        >
          <X className="size-4" />
        </button>
        <h3 className="font-display text-xl uppercase text-lime">
          {form.id ? "Editar regla" : "Nueva regla recurrente"}
        </h3>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Día de la semana">
              <select
                value={form.dia_semana}
                onChange={(e) => set("dia_semana", Number(e.target.value))}
                className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:border-lime"
              >
                {DIAS.map((d, i) => (
                  <option key={i} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Hora">
              <input
                type="time"
                value={(form.hora || "20:00").slice(0, 5)}
                onChange={(e) => set("hora", e.target.value)}
                className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:border-lime"
              />
            </Field>
          </div>

          <Field label="Sede / Complejo">
            <input
              type="text"
              value={form.sede || ""}
              onChange={(e) => set("sede", e.target.value)}
              placeholder="Cancha de..."
              className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:border-lime"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Formato">
              <select
                value={form.formato}
                onChange={(e) => set("formato", e.target.value)}
                className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:border-lime"
              >
                <option value="5v5">5v5</option>
                <option value="7v7">7v7</option>
                <option value="8v8">8v8</option>
              </select>
            </Field>
            <Field label="Cupo máximo">
              <input
                type="number"
                min={2}
                value={form.cupo_max}
                onChange={(e) => set("cupo_max", Number(e.target.value) || 14)}
                className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm text-center font-mono focus:outline-none focus:border-lime"
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Abre (días antes)">
              <input
                type="number"
                min={0}
                value={form.abre_dias_antes}
                onChange={(e) => set("abre_dias_antes", Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-border bg-secondary px-2 py-2 text-sm text-center font-mono focus:outline-none focus:border-lime"
              />
            </Field>
            <Field label="Cierra (h antes)">
              <input
                type="number"
                min={0}
                value={form.cierra_horas_antes}
                onChange={(e) => set("cierra_horas_antes", Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-border bg-secondary px-2 py-2 text-sm text-center font-mono focus:outline-none focus:border-lime"
              />
            </Field>
            <Field label="Semanas adel.">
              <input
                type="number"
                min={1}
                value={form.semanas_anticipacion}
                onChange={(e) => set("semanas_anticipacion", Number(e.target.value) || 1)}
                className="w-full rounded-xl border border-border bg-secondary px-2 py-2 text-sm text-center font-mono focus:outline-none focus:border-lime"
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={!!form.activa}
              onChange={(e) => set("activa", e.target.checked)}
              className="size-4 rounded border-border bg-secondary text-lime"
            />
            Regla activa (genera partidos)
          </label>

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
              Guardar regla
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
