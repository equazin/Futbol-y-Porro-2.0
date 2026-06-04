import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { AlertCircle, BadgeCheck, Loader2, ShieldCheck } from "lucide-react";
import { identificarJugador } from "@/lib/api/picado.functions";
import { usePicadoPlayer } from "@/hooks/use-picado-player";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import type { StoredPlayer } from "@/types/picado";

export function DniAuthGate({ children }: { children: ReactNode }) {
  const { stored, remember } = usePicadoPlayer();
  const [dni, setDni] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (stored) return <>{children}</>;

  const digitsOnly = dni.replace(/\D/g, "");
  const isValid = digitsOnly.length >= 7 && digitsOnly.length <= 9;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!isValid) {
      setError("El DNI debe tener entre 7 y 9 digitos.");
      return;
    }

    setLoading(true);
    try {
      const result = await identificarJugador({ data: { dni: digitsOnly } });

      if (!result.ok || !result.player_id || !result.nombre) {
        setError(result.message || "DNI no reconocido.");
        return;
      }

      const player: StoredPlayer = {
        player_id: result.player_id,
        nombre: result.nombre,
        apodo: result.apodo ?? null,
        posicion: result.posicion ?? null,
        foto_url: result.foto_url ?? null,
        elo: result.elo ?? 1000,
        admin_role: result.admin_role ?? null,
      };

      remember(player);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo verificar el DNI.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 md:px-6">
        <header className="flex items-center justify-between">
          <Logo />
          <span className="inline-flex items-center gap-1.5 rounded-md border border-lime/30 bg-lime/10 px-2.5 py-1 text-xs font-semibold text-lime">
            <ShieldCheck className="size-3.5" />
            Acceso jugadores
          </span>
        </header>

        <main className="flex flex-1 items-center justify-center py-10">
          <section className="grid w-full gap-6 md:grid-cols-[1.05fr_0.95fr] md:items-center">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-gold">
                <BadgeCheck className="size-3.5" />
                Verificacion obligatoria
              </div>
              <div>
                <h1 className="font-display text-5xl uppercase leading-none md:text-7xl">
                  Entra con tu <span className="text-lime">DNI</span>
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
                  Usamos tu DNI solo para encontrar tu ficha de jugador. No se guarda en este
                  dispositivo.
                </p>
              </div>
              <div className="grid max-w-lg grid-cols-3 gap-3">
                <GateStat value="Perfil" label="personal" />
                <GateStat value="Partidos" label="propios" />
                <GateStat value="Stats" label="temporada" />
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="rounded-3xl border border-border/60 bg-card p-5 shadow-2xl md:p-6"
            >
              <div className="mb-5">
                <h2 className="font-display text-3xl uppercase">Verificar jugador</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ingresa tu DNI sin puntos ni espacios.
                </p>
              </div>

              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                DNI
              </label>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                value={dni}
                onChange={(event) => {
                  setDni(event.target.value);
                  if (error) setError(null);
                }}
                placeholder="Ej. 35123456"
                className={cn(
                  "mt-2 w-full rounded-xl border bg-secondary px-4 py-3 text-center font-mono text-2xl font-bold tracking-widest",
                  "placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground/45",
                  "focus:outline-none focus:ring-2",
                  error
                    ? "border-destructive/60 focus:border-destructive focus:ring-destructive/20"
                    : "border-border/60 focus:border-lime/60 focus:ring-lime/20",
                )}
              />

              {error && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !isValid}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-lime px-4 py-3 text-sm font-bold text-lime-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ShieldCheck className="size-4" />
                )}
                {loading ? "Verificando..." : "Entrar"}
              </button>
            </form>
          </section>
        </main>
      </div>
    </div>
  );
}

function GateStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 px-3 py-3">
      <div className="font-display text-xl uppercase leading-none text-foreground">{value}</div>
      <div className="mt-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
