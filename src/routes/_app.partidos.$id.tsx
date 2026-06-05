import { createFileRoute, notFound, Link, useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMatchRealtime } from "@/hooks/use-match-realtime";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock,
  MapPin,
  Share2,
  UserMinus,
  UserPlus,
  Users,
  Hourglass,
  X,
  Trophy,
  Star,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Countdown } from "@/components/Countdown";
import { cn } from "@/lib/utils";
import { shareMatch } from "@/lib/share";
import {
  getMatchDetail,
  anotarse,
  bajarse,
  registrarVoto,
  confirmarAsistencia,
} from "@/lib/api/picado.functions";
import { usePicadoPlayer } from "@/hooks/use-picado-player";
import { PlayerAvatar } from "@/components/Avatar";
import { useStore } from "@/store/match-store";
import type { MatchResult } from "@/store/match-store";
import type { MatchDetailData, SignupWithPlayer, VotoResult } from "@/types/picado";

export const Route = createFileRoute("/_app/partidos/$id")({
  component: MatchDetail,
  pendingComponent: MatchDetailPending,
  loader: async ({ params }): Promise<MatchDetailData> => {
    const data = await getMatchDetail({ data: { id: params.id } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData, params }) => {
    const m = loaderData?.match;
    const fecha = m
      ? new Date(`${m.fecha}T${m.hora}`).toLocaleDateString("es-AR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        })
      : "";
    const title = m ? `F y P FC ${m.formato} · ${fecha}` : "Futbol y Porro FC";
    const titulares = loaderData?.titulares.length ?? 0;
    const desc = m
      ? `${m.sede} · ${titulares}/${m.cupo_max} anotados. Anotate al toque.`
      : "La app del Futbol y Porro FC.";
    return {
      meta: [
        { title: `${title} — Futbol y Porro FC` },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: `/partidos/${params.id}` },
        { property: "og:image", content: "/og-image.jpg" },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "Futbol y Porro FC" },
      ],
    };
  },
});

// ── Live indicator ────────────────────────────────────────

function LiveDot() {
  return (
    <span className="ml-auto flex items-center gap-1 text-[10px] uppercase tracking-wider text-lime font-semibold">
      <span className="relative flex size-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime opacity-75" />
        <span className="relative inline-flex rounded-full size-1.5 bg-lime" />
      </span>
      en vivo
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────

function displayName(p: SignupWithPlayer["players"]) {
  return p.apodo ?? p.nombre;
}

function posLabel(pos: string | null) {
  const map: Record<string, string> = {
    arquero: "ARQ",
    defensor: "DEF",
    mediocampista: "MED",
    delantero: "DEL",
  };
  return pos ? (map[pos] ?? pos.slice(0, 3).toUpperCase()) : "—";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "error desconocido";
}

// ── DNI Dialog ────────────────────────────────────────────

function DniDialog({
  open,
  mode,
  onClose,
  onConfirm,
}: {
  open: boolean;
  mode: "anotarse" | "bajarse" | "votar" | "confirmar";
  onClose: () => void;
  onConfirm: (dni: string) => Promise<void>;
}) {
  const [dni, setDni] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (dni.replace(/\D/g, "").length < 7) return;
    setLoading(true);
    try {
      await onConfirm(dni.trim());
    } finally {
      setLoading(false);
      setDni("");
    }
  }

  if (!open) return null;

  const digitsOnly = dni.replace(/\D/g, "");
  const isValid = digitsOnly.length >= 7 && digitsOnly.length <= 9;

  const modeLabel =
    mode === "anotarse"
      ? "Anotarme"
      : mode === "bajarse"
        ? "Bajarme"
        : mode === "confirmar"
          ? "Confirmar asistencia"
          : "Identificarme para Votar";
  const modeDesc =
    mode === "anotarse"
      ? "Ingresá tu DNI para confirmar tu lugar."
      : mode === "bajarse"
        ? "Ingresá tu DNI para bajarte del partido."
        : mode === "confirmar"
          ? "Ingresá tu DNI para confirmar que vas a ir al partido."
          : "Ingresá tu DNI para identificarte y votar MVP y Gol de la Fecha.";
  const btnLabel =
    mode === "anotarse"
      ? "¡Anotarme!"
      : mode === "bajarse"
        ? "Confirmar baja"
        : mode === "confirmar"
          ? "¡Confirmo que voy!"
          : "Continuar →";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-sm rounded-3xl bg-card border border-border/60 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition"
        >
          <X className="size-4" />
        </button>

        <h2 className="font-display text-3xl uppercase mb-1">{modeLabel}</h2>
        <p className="text-sm text-muted-foreground mb-5">{modeDesc}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={inputRef}
            type="tel"
            inputMode="numeric"
            autoFocus
            autoComplete="off"
            placeholder="Ej. 35123456"
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            className={cn(
              "w-full rounded-xl border bg-secondary px-4 py-3",
              "text-center font-mono text-2xl font-bold tracking-widest",
              "placeholder:text-muted-foreground/40 placeholder:font-normal placeholder:text-sm placeholder:tracking-normal",
              "focus:outline-none focus:ring-2 transition",
              isValid || !dni
                ? "border-border/60 focus:border-lime/60 focus:ring-lime/20"
                : "border-destructive/50 focus:border-destructive focus:ring-destructive/20",
            )}
          />

          {dni && !isValid && (
            <p className="text-xs text-destructive -mt-2 text-center">
              DNI debe tener entre 7 y 9 dígitos
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !isValid}
            className={cn(
              "w-full rounded-xl px-4 py-3.5 text-sm font-semibold transition",
              mode === "anotarse"
                ? "bg-lime text-lime-foreground hover:brightness-110 disabled:opacity-40"
                : mode === "votar"
                  ? "bg-gold/90 text-black hover:bg-gold disabled:opacity-40"
                  : "bg-out/15 text-out border border-out/30 hover:bg-out/25 disabled:opacity-40",
            )}
          >
            {loading ? "Un momento…" : btnLabel}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Match Result Banner ───────────────────────────────────

function MatchResultBanner({
  result,
  participants,
}: {
  result: MatchResult | null | undefined;
  participants: SignupWithPlayer[];
}) {
  if (!result || (result.scoreA === 0 && result.scoreB === 0 && !result.teamA?.length)) return null;

  const scoreA = result.scoreA ?? 0;
  const scoreB = result.scoreB ?? 0;
  const teamA: string[] = result.teamA ?? [];
  const teamB: string[] = result.teamB ?? [];

  const aWon = scoreA > scoreB;
  const bWon = scoreB > scoreA;
  const drew = scoreA === scoreB;

  function getName(id: string) {
    const s = participants.find((p) => p.player_id === id);
    return s ? displayName(s.players) : "?";
  }

  const stats = result.stats ?? {};
  const mvpId = result.mvpResult;
  const golId = result.golResult;

  // Líneas de jugador con badges de goles/asistencias
  const renderTeam = (ids: string[]) =>
    ids.map((id) => {
      const s = stats[id];
      const goals = s?.goals ?? 0;
      const assists = s?.assists ?? 0;
      return (
        <div key={id} className="flex items-center justify-between gap-2 text-xs">
          <span className={cn("truncate", id === mvpId ? "text-gold font-semibold" : "text-muted-foreground")}>
            {getName(id)}
          </span>
          <span className="flex items-center gap-1.5 shrink-0 text-[11px] tabular-nums">
            {goals > 0 && <span title="Goles">⚽{goals > 1 ? `×${goals}` : ""}</span>}
            {assists > 0 && <span title="Asistencias" className="text-muted-foreground">🎯{assists > 1 ? `×${assists}` : ""}</span>}
          </span>
        </div>
      );
    });

  return (
    <section className="mt-6">
      <h2 className="font-display text-2xl uppercase mb-3 flex items-center gap-2">
        <Trophy className="size-5 text-gold" /> Resultado del Partido
      </h2>
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        {/* Score bar */}
        <div className="grid grid-cols-3 items-center gap-0 text-center">
          <div
            className={cn(
              "p-4 flex flex-col items-center gap-1",
              aWon ? "bg-lime/10" : "bg-secondary/30",
            )}
          >
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
              Equipo A
            </span>
            {aWon && <Trophy className="size-3 text-gold" />}
          </div>
          <div className="py-5 px-4 bg-secondary/60 flex items-center justify-center gap-3">
            <span
              className={cn(
                "font-display text-5xl tabular-nums",
                aWon ? "text-lime" : drew ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {scoreA}
            </span>
            <span className="font-display text-2xl text-muted-foreground">—</span>
            <span
              className={cn(
                "font-display text-5xl tabular-nums",
                bWon ? "text-lime" : drew ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {scoreB}
            </span>
          </div>
          <div
            className={cn(
              "p-4 flex flex-col items-center gap-1",
              bWon ? "bg-lime/10" : "bg-secondary/30",
            )}
          >
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
              Equipo B
            </span>
            {bWon && <Trophy className="size-3 text-gold" />}
          </div>
        </div>

        {drew && (
          <div className="text-center py-1.5 text-xs font-semibold text-muted-foreground bg-secondary/30 border-t border-border/40">
            ⚖️ Empate
          </div>
        )}

        {/* MVP y Gol de la Fecha */}
        {(mvpId || golId) && (
          <div className="grid grid-cols-2 divide-x divide-border/40 border-t border-border/40">
            <div className="p-3 text-center">
              <div className="text-[9px] uppercase tracking-widest font-bold text-gold mb-0.5">
                👑 MVP
              </div>
              <div className="text-sm font-semibold truncate">
                {mvpId ? getName(mvpId) : "—"}
              </div>
            </div>
            <div className="p-3 text-center">
              <div className="text-[9px] uppercase tracking-widest font-bold text-lime mb-0.5">
                ⚽ Gol de la Fecha
              </div>
              <div className="text-sm font-semibold truncate">
                {golId ? getName(golId) : "—"}
              </div>
            </div>
          </div>
        )}

        {/* Teams con goles/asistencias */}
        {(teamA.length > 0 || teamB.length > 0) && (
          <div className="grid grid-cols-2 divide-x divide-border/40 border-t border-border/40">
            <div className="p-3 space-y-1.5">{renderTeam(teamA)}</div>
            <div className="p-3 space-y-1.5">{renderTeam(teamB)}</div>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Voting Section ────────────────────────────────────────

function VotingSection({
  matchId,
  participants,
  result,
  isClosed,
}: {
  matchId: string;
  participants: SignupWithPlayer[];
  result: MatchResult | null | undefined;
  isClosed: boolean;
}) {
  const { stored, remember } = usePicadoPlayer();
  const router = useRouter();
  const { players } = useStore();
  const playerMap = Object.fromEntries(players.map((p) => [p.id, p]));

  const [step, setStep] = useState<"auth" | "vote" | "done">("auth");
  const [mvpVote, setMvpVote] = useState<string>("");
  const [golVote, setGolVote] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Check if the user already voted (voter_id in result.votes)
  const votes = result?.votes ?? [];
  const myVote = stored ? votes.find((v) => v.voter_id === stored.player_id) : null;
  const hasVoted = !!myVote;

  // Check who won (for closed matches)
  const mvpWinnerId = result?.mvpResult;
  const golWinnerId = result?.golResult;

  // Tally votes for display in voting phase
  const mvpTally: Record<string, number> = {};
  const golTally: Record<string, number> = {};
  for (const v of votes) {
    if (v.mvp_vote) mvpTally[v.mvp_vote] = (mvpTally[v.mvp_vote] || 0) + 1;
    if (v.gol_vote) golTally[v.gol_vote] = (golTally[v.gol_vote] || 0) + 1;
  }

  const topMvpEntry = Object.entries(mvpTally).sort((a, b) => b[1] - a[1])[0];
  const topGolEntry = Object.entries(golTally).sort((a, b) => b[1] - a[1])[0];
  const voterIds = new Set(votes.map((v) => v.voter_id).filter(Boolean));
  const votedParticipants = participants.filter((s) => voterIds.has(s.player_id));
  const missingParticipants = participants.filter((s) => !voterIds.has(s.player_id));

  function getName(id: string) {
    const found = participants.find((s) => s.player_id === id);
    if (found) return displayName(found.players);
    const p = playerMap[id];
    return p?.nickname ?? "Desconocido";
  }

  // Check if the current user participated
  const isParticipant = stored ? participants.some((s) => s.player_id === stored.player_id) : false;

  // If match is closed, show winners prominently
  if (isClosed) {
    return (
      <section className="mt-8 space-y-4">
        <h2 className="font-display text-3xl uppercase tracking-wider flex items-center gap-2">
          <Trophy className="size-6 text-gold" /> Ganadores del Partido
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {/* MVP Winner */}
          <div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/20 via-gold/5 to-transparent p-5 flex items-center gap-4">
            <span className="text-4xl select-none">👑</span>
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-gold mb-1">
                MVP del Partido
              </div>
              {mvpWinnerId ? (
                <div className="font-display text-2xl uppercase text-foreground">
                  {getName(mvpWinnerId)}
                </div>
              ) : (
                <div className="text-muted-foreground text-sm">Sin votos suficientes</div>
              )}
              {mvpWinnerId && (
                <div className="text-xs text-muted-foreground mt-1">
                  {topMvpEntry?.[1] ?? 0} voto{(topMvpEntry?.[1] ?? 0) !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          </div>

          {/* Gol de la Fecha Winner */}
          <div className="rounded-2xl border border-lime/40 bg-gradient-to-br from-lime/15 via-lime/5 to-transparent p-5 flex items-center gap-4">
            <span className="text-4xl select-none">⚽</span>
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-lime mb-1">
                Gol de la Fecha
              </div>
              {golWinnerId ? (
                <div className="font-display text-2xl uppercase text-foreground">
                  {getName(golWinnerId)}
                </div>
              ) : (
                <div className="text-muted-foreground text-sm">Sin votos suficientes</div>
              )}
              {golWinnerId && (
                <div className="text-xs text-muted-foreground mt-1">
                  {topGolEntry?.[1] ?? 0} voto{(topGolEntry?.[1] ?? 0) !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground text-center pt-2">
          {votes.length} jugador{votes.length !== 1 ? "es" : ""} participó en la votación
        </div>
      </section>
    );
  }

  // Voting phase (match is "jugado")
  return (
    <section className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <span className="relative flex size-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75" />
          <span className="relative inline-flex rounded-full size-2 bg-gold" />
        </span>
        <h2 className="font-display text-3xl uppercase tracking-wider">Votación en Curso</h2>
        <span className="ml-auto text-xs text-muted-foreground">
          {votes.length} voto{votes.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 via-card/50 to-card/90 p-5 space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-lime/20 bg-card/50 p-3">
            <div className="text-[9px] uppercase tracking-widest font-bold text-lime mb-2">
              Ya votaron
            </div>
            {votedParticipants.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nadie voto todavia.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {votedParticipants.map((s) => (
                  <span
                    key={s.player_id}
                    className="rounded-full bg-lime/10 px-2 py-1 text-[11px] text-lime"
                  >
                    {displayName(s.players)}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/40 bg-card/50 p-3">
            <div className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-2">
              Falta votar
            </div>
            {missingParticipants.length === 0 ? (
              <p className="text-xs text-muted-foreground">Todos votaron.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {missingParticipants.map((s) => (
                  <span
                    key={s.player_id}
                    className="rounded-full bg-secondary px-2 py-1 text-[11px] text-muted-foreground"
                  >
                    {displayName(s.players)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Auth & Vote UI */}
        {step === "auth" ? (
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              {stored && isParticipant
                ? hasVoted
                  ? `Ya votaste como ${stored.nombre}. Podés cambiar tu voto.`
                  : `Votá como ${stored.nombre}.`
                : "Identificate con tu DNI para poder votar."}
            </p>
            {stored && isParticipant ? (
              <button
                onClick={() => {
                  if (myVote) {
                    setMvpVote(myVote.mvp_vote);
                    setGolVote(myVote.gol_vote);
                  }
                  setStep("vote");
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-gold/90 text-black px-5 py-2.5 text-sm font-bold hover:bg-gold transition"
              >
                {hasVoted ? "✏️ Cambiar Voto" : "🗳️ Votar Ahora"}
              </button>
            ) : (
              <div className="rounded-xl border border-border/50 bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">
                Tu usuario verificado no figura como titular en este partido.
              </div>
            )}
          </div>
        ) : step === "vote" ? (
          <VoteForm
            participants={participants}
            mvpVote={mvpVote}
            setMvpVote={setMvpVote}
            golVote={golVote}
            setGolVote={setGolVote}
            onCancel={() => setStep("auth")}
            matchId={matchId}
            loading={loading}
            setLoading={setLoading}
            result={result}
            voterPlayerId={stored?.player_id ?? null}
            onSuccess={(res) => {
              if (res.player_id && res.nombre) {
                remember({ ...(stored ?? {}), player_id: res.player_id, nombre: res.nombre });
              }
              setStep("done");
              void router.invalidate();
            }}
          />
        ) : (
          <div className="text-center space-y-2">
            <CheckCircle2 className="size-10 text-lime mx-auto" />
            <p className="text-sm font-semibold">¡Tu voto fue registrado!</p>
            <p className="text-xs text-muted-foreground">
              MVP: {getName(mvpVote)} · Gol: {getName(golVote)}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Vote Form ─────────────────────────────────────────────

function VoteForm({
  participants,
  mvpVote,
  setMvpVote,
  golVote,
  setGolVote,
  onCancel,
  matchId,
  loading,
  setLoading,
  onSuccess,
  result,
  voterPlayerId,
}: {
  participants: SignupWithPlayer[];
  mvpVote: string;
  setMvpVote: (v: string) => void;
  golVote: string;
  setGolVote: (v: string) => void;
  onCancel: () => void;
  matchId: string;
  loading: boolean;
  setLoading: (v: boolean) => void;
  onSuccess: (res: VotoResult) => void;
  result: MatchResult | null | undefined;
  voterPlayerId: string | null;
}) {
  const [dniForVote, setDniForVote] = useState("");
  const [showDniInput, setShowDniInput] = useState(false);

  // ── Compute candidate lists ────────────────────────────
  // MVP: only from the winning team. Never self.
  const scoreA = result?.scoreA ?? 0;
  const scoreB = result?.scoreB ?? 0;
  const teamA: string[] = result?.teamA ?? [];
  const teamB: string[] = result?.teamB ?? [];
  const isDraw = scoreA === scoreB;
  const winnerTeamIds: string[] = scoreA > scoreB ? teamA : scoreB > scoreA ? teamB : [];

  const mvpCandidates = participants.filter((s) => {
    if (s.player_id === voterPlayerId) return false; // no self-vote
    return winnerTeamIds.includes(s.player_id); // only winners
  });

  const golCandidates = participants.filter(
    (s) => s.player_id !== voterPlayerId, // no self-vote
  );

  async function handleVoteSubmit() {
    if (!mvpVote || !golVote) {
      toast.error("Seleccioná tanto el MVP como el Gol de la Fecha.");
      return;
    }
    if (!dniForVote) {
      setShowDniInput(true);
      return;
    }

    setLoading(true);
    try {
      const res = await registrarVoto({
        data: {
          dni: dniForVote.trim(),
          match_id: matchId,
          mvp_vote: mvpVote,
          gol_vote: golVote,
        },
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("\u00a1Voto registrado!", { description: res.message });
      onSuccess(res);
    } catch (err) {
      toast.error("Error al votar: " + errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const posColors: Record<string, string> = {
    arquero: "text-yellow-400",
    defensor: "text-blue-400",
    mediocampista: "text-lime",
    delantero: "text-rose-400",
  };

  return (
    <div className="space-y-5">
      {/* Team filter notice */}
      {!isDraw && winnerTeamIds.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-gold/10 border border-gold/20 px-3 py-2 text-xs text-gold">
          <Trophy className="size-3.5 shrink-0" />
          <span>
            El MVP solo puede ser del <strong>equipo ganador</strong>. Para Gol de la Fecha,
            cualquier jugador.
          </span>
        </div>
      )}
      {isDraw && (
        <div className="flex items-center gap-2 rounded-xl bg-secondary/60 border border-border/40 px-3 py-2 text-xs text-muted-foreground">
          <span>⚖️</span>
          <span>El MVP se habilita cuando hay un equipo ganador cargado.</span>
        </div>
      )}

      {/* MVP Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">👑</span>
            <h3 className="text-sm font-bold uppercase tracking-wider">MVP del Partido</h3>
          </div>
          {!isDraw && (
            <span className="text-[10px] uppercase text-gold font-bold">Solo equipo ganador</span>
          )}
        </div>
        {mvpCandidates.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1">No hay candidatos disponibles.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {mvpCandidates.map((s) => (
              <button
                key={s.player_id}
                onClick={() => setMvpVote(s.player_id)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition group",
                  mvpVote === s.player_id
                    ? "border-gold bg-gold/20 text-foreground font-semibold"
                    : "border-border/50 bg-card/40 text-muted-foreground hover:border-gold/40 hover:bg-gold/5",
                )}
              >
                <span
                  className={cn(
                    "size-4 flex items-center justify-center shrink-0 text-sm",
                    posColors[s.players.posicion ?? ""] ?? "",
                  )}
                >
                  {mvpVote === s.player_id ? "👑" : "○"}
                </span>
                <span className="truncate">{displayName(s.players)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Gol de la Fecha Selection */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚽</span>
          <h3 className="text-sm font-bold uppercase tracking-wider">Gol de la Fecha</h3>
        </div>
        {golCandidates.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1">No hay candidatos disponibles.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {golCandidates.map((s) => (
              <button
                key={s.player_id}
                onClick={() => setGolVote(s.player_id)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition",
                  golVote === s.player_id
                    ? "border-lime bg-lime/20 text-foreground font-semibold"
                    : "border-border/50 bg-card/40 text-muted-foreground hover:border-lime/40 hover:bg-lime/5",
                )}
              >
                <span className="text-sm">{golVote === s.player_id ? "⚽" : "○"}</span>
                <span className="truncate">{displayName(s.players)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* DNI Confirmation step */}
      {showDniInput && (
        <div className="space-y-2 animate-fade-in">
          <p className="text-xs text-muted-foreground">
            Confirm\u00e1 tu identidad con tu DNI para registrar el voto:
          </p>
          <input
            type="tel"
            inputMode="numeric"
            autoFocus
            placeholder="Ej. 35123456"
            value={dniForVote}
            onChange={(e) => setDniForVote(e.target.value)}
            className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-center font-mono text-xl font-bold tracking-widest focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition"
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="rounded-xl border border-border px-4 py-2.5 text-xs text-muted-foreground hover:bg-secondary transition"
        >
          Cancelar
        </button>
        <button
          onClick={handleVoteSubmit}
          disabled={loading || !mvpVote || !golVote}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gold/90 text-black px-4 py-2.5 text-sm font-bold hover:bg-gold disabled:opacity-40 transition"
        >
          {loading
            ? "Registrando\u2026"
            : showDniInput
              ? "\u2713 Confirmar Voto"
              : "\uD83D\uDDF3\uFE0F Registrar Voto"}
        </button>
      </div>
    </div>
  );
}

// ── Player row ────────────────────────────────────────────

function PlayerRow({
  signup,
  index,
  isMe,
  variant,
}: {
  signup: SignupWithPlayer;
  index: number;
  isMe: boolean;
  variant: "titular" | "espera";
}) {
  const p = signup.players;
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 border transition",
        variant === "titular"
          ? isMe
            ? "border-lime/50 bg-lime/10"
            : "border-border/60 bg-card"
          : isMe
            ? "border-gold/50 bg-gold/10"
            : "border-gold/20 bg-gold/5",
      )}
    >
      <span className="font-mono text-xs text-muted-foreground tabular-nums w-5">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{displayName(p)}</span>
          {signup.confirmado && (
            <span
              className="text-[10px] shrink-0"
              title="Confirmó asistencia"
            >
              ✅
            </span>
          )}
          {isMe && (
            <span className="text-[10px] uppercase tracking-wider font-bold text-lime shrink-0">
              vos
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {posLabel(p.posicion)} · {p.nombre}
        </div>
      </div>
      {variant === "titular" ? (
        <Check className="size-4 text-confirmed shrink-0" />
      ) : (
        <Hourglass className="size-3.5 text-gold shrink-0" />
      )}
    </li>
  );
}

// ── Main component ────────────────────────────────────────

function MatchDetail() {
  const { match, titulares, espera, result } = Route.useLoaderData() as MatchDetailData;
  const router = useRouter();
  const { stored, remember } = usePicadoPlayer();

  // Suscripción Realtime: actualiza las listas en todos los dispositivos
  useMatchRealtime(match.id);

  const [dialog, setDialog] = useState<"anotarse" | "bajarse" | "confirmar" | null>(null);

  // Detectar si el usuario actual está anotado (por player_id guardado en localStorage)
  const myTitular = stored ? titulares.find((s) => s.player_id === stored.player_id) : null;
  const myEspera = stored ? espera.find((s) => s.player_id === stored.player_id) : null;
  const mySignup = myTitular ?? myEspera;
  const myConfirmado = !!mySignup?.confirmado;
  const isOpen = match.estado === "abierto";
  const isJugado = match.estado === "jugado";
  const isCerrado = match.estado === "cerrado";
  const isPlayedOrClosed = isJugado || isCerrado;

  const myEsperaPos = myEspera
    ? espera.findIndex((s) => s.player_id === stored?.player_id) + 1
    : null;

  const pct = Math.min(100, (titulares.length / match.cupo_max) * 100);
  const remaining = Math.max(0, match.cupo_max - titulares.length);
  const fechaDate = new Date(`${match.fecha}T${match.hora}`);

  // Combine all participants for voting
  const allParticipants = [...titulares];

  async function handleAnotarse(dni: string) {
    try {
      const result = await anotarse({ data: { dni, match_id: match.id } });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      // Guardar player_id + nombre en localStorage (nunca el DNI)
      if (result.player_id && result.nombre) {
        remember({ ...(stored ?? {}), player_id: result.player_id, nombre: result.nombre });
      }

      toast.success(result.message, {
        description:
          result.estado === "espera" && myEsperaPos
            ? `Posición en la lista de espera: #${myEsperaPos}`
            : undefined,
      });

      setDialog(null);
      await router.invalidate();
    } catch (err) {
      toast.error("Error al anotarse: " + errorMessage(err));
    }
  }

  async function handleBajarse(dni: string) {
    try {
      const result = await bajarse({ data: { dni, match_id: match.id } });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.info("Te bajaste del partido.");
      setDialog(null);
      await router.invalidate();
    } catch (err) {
      toast.error("Error al bajarse: " + errorMessage(err));
    }
  }

  async function handleConfirmar(dni: string) {
    try {
      const res = await confirmarAsistencia({
        data: { dni, match_id: match.id, confirmado: !myConfirmado },
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setDialog(null);
      await router.invalidate();
    } catch (err) {
      toast.error("Error al confirmar asistencia: " + errorMessage(err));
    }
  }

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 md:px-6 py-4 md:py-8">
        <Link
          to="/partidos"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="size-4" /> Volver
        </Link>

        {/* ── Header card ── */}
        <section className="rounded-3xl border border-border/60 bg-card overflow-hidden">
          <div className="relative pitch-lines px-6 py-8 border-b border-border/60">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-card/90" />
            <div className="relative">
              <div className="flex items-center gap-2 text-xs text-lime font-semibold uppercase tracking-wider">
                <CalendarDays className="size-3.5" />
                {fechaDate.toLocaleDateString("es-AR", { weekday: "long" })}
                {isJugado && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-gold/15 text-gold border border-gold/30 px-2 py-0.5 text-[10px] font-bold uppercase">
                    🗳️ Votación Abierta
                  </span>
                )}
                {isCerrado && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-gold/20 text-gold border border-gold/40 px-2 py-0.5 text-[10px] font-bold uppercase">
                    <Trophy className="size-3" /> Cerrado
                  </span>
                )}
              </div>
              <h1 className="font-display text-5xl md:text-6xl uppercase leading-none mt-2">
                {fechaDate.toLocaleDateString("es-AR", { day: "2-digit", month: "long" })}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  {fechaDate.toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  hs
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5" />
                  {match.sede}
                </span>
                <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-foreground">
                  {match.formato}
                </span>
              </div>
            </div>
          </div>

          {/* Cupo + countdown */}
          <div className="p-6 grid md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Users className="size-3.5" /> Cupo
                </span>
                <span className="font-display text-2xl tabular-nums">
                  <span className="text-lime">{titulares.length}</span>
                  <span className="text-muted-foreground">/{match.cupo_max}</span>
                </span>
              </div>
              <div className="h-3 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-lime to-gold transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {remaining > 0 ? (
                  <>
                    Faltan <strong className="text-foreground tabular-nums">{remaining}</strong>{" "}
                    jugadores
                  </>
                ) : (
                  "Cupo completo — lista de espera abierta"
                )}
              </div>

              {/* Estado del usuario */}
              {mySignup && (
                <div
                  className={cn(
                    "mt-3 rounded-xl px-3 py-2 text-sm font-medium",
                    myTitular
                      ? "bg-lime/10 text-lime border border-lime/30"
                      : "bg-gold/10 text-gold border border-gold/30",
                  )}
                >
                  {myTitular ? (
                    <>
                      <Check className="size-3.5 inline mr-1.5" />
                      Estás anotado como titular
                    </>
                  ) : (
                    <>
                      <Hourglass className="size-3.5 inline mr-1.5" />
                      Estás en la espera — sos el #{myEsperaPos}
                    </>
                  )}
                </div>
              )}
            </div>

            {match.inscripcion_cierra && (
              <Countdown to={match.inscripcion_cierra} label="Cierra inscripción en" />
            )}
          </div>

          {/* Acciones */}
          {isOpen && mySignup && (
            <div className="px-6 pt-1 pb-3">
              <button
                onClick={() => setDialog("confirmar")}
                className={cn(
                  "w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold border transition",
                  myConfirmado
                    ? "bg-lime/15 text-lime border-lime/40 hover:bg-lime/25"
                    : "bg-secondary/60 text-foreground border-border hover:border-lime/40",
                )}
              >
                {myConfirmado ? "✅ Asistencia confirmada — tocá para cancelar" : "Confirmar asistencia"}
              </button>
            </div>
          )}

          {isOpen && (
            <div className="px-6 pb-6 flex gap-2">
              {mySignup ? (
                <button
                  onClick={() => setDialog("bajarse")}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold bg-out/15 text-out border border-out/30 hover:bg-out/25 transition"
                >
                  <UserMinus className="size-4" /> Bajarme
                </button>
              ) : (
                <button
                  onClick={() => setDialog("anotarse")}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold bg-lime text-lime-foreground hover:brightness-110 transition"
                >
                  <UserPlus className="size-4" /> Anotarme
                </button>
              )}
              <button
                onClick={() =>
                  shareMatch({
                    id: match.id,
                    title: `F y P FC ${match.formato}`,
                    text: `${match.sede} · ${fechaDate.toLocaleString("es-AR")}`,
                  })
                }
                aria-label="Compartir"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:border-lime/40 transition"
              >
                <Share2 className="size-4" /> Compartir
              </button>
            </div>
          )}

          {!isOpen && (
            <div className="px-6 pb-6">
              <div className="rounded-xl bg-secondary/60 px-4 py-3 text-sm text-muted-foreground text-center">
                {match.estado === "programado" && "La inscripción aún no está abierta"}
                {match.estado === "jugado" &&
                  "Partido finalizado — votación de MVP y Gol de la Fecha abierta"}
                {match.estado === "cerrado" && "Partido cerrado — los ganadores fueron asignados"}
                {match.estado === "cancelado" && "Partido cancelado"}
              </div>
            </div>
          )}
        </section>

        {/* ── Match Result Banner (jugado/cerrado) ── */}
        {isPlayedOrClosed && result && (
          <MatchResultBanner result={result} participants={allParticipants} />
        )}

        {/* ── Voting Section (jugado or cerrado) ── */}
        {isPlayedOrClosed && (
          <VotingSection
            matchId={match.id}
            participants={allParticipants}
            result={result}
            isClosed={isCerrado}
          />
        )}

        {/* ── Titulares ── */}
        <section className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="size-2.5 rounded-full bg-confirmed" />
            <h2 className="font-display text-2xl uppercase">Titulares</h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              ({titulares.length}/{match.cupo_max})
            </span>
            {isOpen && <LiveDot />}
          </div>
          {titulares.length === 0 ? (
            <p className="text-sm text-muted-foreground px-1">Nadie anotado todavía.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {titulares.map((s, i) => (
                <PlayerRow
                  key={s.id}
                  signup={s}
                  index={i}
                  isMe={s.player_id === stored?.player_id}
                  variant="titular"
                />
              ))}
            </ul>
          )}
        </section>

        {/* ── Lista de espera ── */}
        {(espera.length > 0 || titulares.length >= match.cupo_max) && (
          <section className="mt-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="size-2.5 rounded-full bg-waitlist" />
              <h2 className="font-display text-2xl uppercase">Lista de espera</h2>
              <span className="text-xs text-muted-foreground tabular-nums">({espera.length})</span>
              {isOpen && <LiveDot />}
            </div>
            {espera.length === 0 ? (
              <p className="text-sm text-muted-foreground px-1">Nadie en espera.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {espera.map((s, i) => (
                  <PlayerRow
                    key={s.id}
                    signup={s}
                    index={i}
                    isMe={s.player_id === stored?.player_id}
                    variant="espera"
                  />
                ))}
              </ul>
            )}
          </section>
        )}

        <div className="h-16" />
      </div>

      {/* ── DNI Dialog ── */}
      <DniDialog
        open={dialog !== null}
        mode={dialog ?? "anotarse"}
        onClose={() => setDialog(null)}
        onConfirm={
          dialog === "anotarse"
            ? handleAnotarse
            : dialog === "confirmar"
              ? handleConfirmar
              : handleBajarse
        }
      />
    </>
  );
}

function MatchDetailPending() {
  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-4 md:py-8 space-y-6">
      <div className="h-6 w-20 bg-secondary/50 animate-pulse rounded" />
      <div className="rounded-3xl border border-border/60 bg-card p-6 space-y-6">
        <div className="space-y-3">
          <div className="h-4 w-32 bg-secondary/50 animate-pulse rounded" />
          <div className="h-12 w-64 bg-secondary/50 animate-pulse rounded" />
          <div className="h-4 w-48 bg-secondary/50 animate-pulse rounded" />
        </div>
        <div className="h-2 w-full bg-secondary/30 animate-pulse rounded" />
        <div className="flex gap-4">
          <div className="h-10 flex-1 bg-secondary/50 animate-pulse rounded-lg" />
          <div className="h-10 w-24 bg-secondary/50 animate-pulse rounded-lg" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-6 w-24 bg-secondary/50 animate-pulse rounded" />
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 bg-secondary/30 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
