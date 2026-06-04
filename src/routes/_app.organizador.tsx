import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState, useMemo } from "react";
import {
  Plus,
  Pencil,
  Shuffle,
  Trash2,
  CalendarDays,
  MapPin,
  Users,
  Award,
  Shield,
  Check,
  X,
  Undo,
  Trophy,
  Settings2,
  Calendar,
  Lock,
  LogOut,
  UserPlus,
  Save,
  MessageSquare
} from "lucide-react";
import { useStore, type StoredMatch, type PlayerStats, type MatchResult } from "@/store/match-store";
import { useMatchRealtime } from "@/hooks/use-match-realtime";
import { PlayerAvatar } from "@/components/Avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/organizador")({
  component: OrganizadorRoute,
});

// Helper para obtener/inicializar resultados localmente si no existen aún en DB
function getMatchResult(m?: StoredMatch): MatchResult {
  if (!m) {
    return {
      scoreA: 0,
      scoreB: 0,
      teamA: [],
      teamB: [],
      stats: {},
    };
  }
  if (m.result) return m.result;
  const confirmed = m.confirmed ?? [];
  const half = Math.ceil(confirmed.length / 2);
  return {
    scoreA: 0,
    scoreB: 0,
    teamA: confirmed.slice(0, half),
    teamB: confirmed.slice(half),
    stats: Object.fromEntries(
      confirmed.map((id) => [id, { attended: true, goals: 0, assists: 0, mvp: false }]),
    ),
  };
}

type VoteRow = {
  playerId: string;
  name: string;
  votes: number;
  locked: boolean;
};

function buildVotingSummary(match: StoredMatch | undefined, playerMap: Record<string, any>) {
  const result = getMatchResult(match);
  const votes = result.votes ?? [];
  const voterIds = Array.from(new Set(votes.map((v) => v.voter_id).filter(Boolean)));
  const participantIds = match?.confirmed ?? [];
  const missingIds = participantIds.filter((id) => !voterIds.includes(id));
  const remainingVotes = Math.max(0, participantIds.length - voterIds.length);

  const winnerTeamIds =
    result.scoreA > result.scoreB
      ? result.teamA
      : result.scoreB > result.scoreA
        ? result.teamB
        : [];

  const nameFor = (id: string) => playerMap[id]?.nickname ?? playerMap[id]?.name ?? "Desconocido";

  const rowsFor = (field: "mvp_vote" | "gol_vote", eligibleIds?: string[]) => {
    const eligible = eligibleIds ? new Set(eligibleIds) : null;
    const tally: Record<string, number> = {};
    for (const vote of votes) {
      const playerId = vote[field];
      if (!playerId) continue;
      if (eligible && !eligible.has(playerId)) continue;
      tally[playerId] = (tally[playerId] ?? 0) + 1;
    }

    const sorted = Object.entries(tally)
      .sort((a, b) => b[1] - a[1])
      .map(([playerId, count], index, arr): VoteRow => {
        const nextVotes = arr[index + 1]?.[1] ?? 0;
        return {
          playerId,
          name: nameFor(playerId),
          votes: count,
          locked: index === 0 && count > nextVotes + remainingVotes,
        };
      });

    return sorted;
  };

  return {
    votes,
    voted: voterIds.length,
    total: participantIds.length,
    missing: missingIds.map((id) => ({ id, name: nameFor(id) })),
    remainingVotes,
    mvpRows: rowsFor("mvp_vote", winnerTeamIds),
    golRows: rowsFor("gol_vote"),
    hasWinnerTeam: winnerTeamIds.length > 0,
  };
}

function OrganizadorRoute() {
  const { isAdmin, adminRole, loginAdmin } = useStore();
  const [pin, setPin] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const success = loginAdmin(pin);
    if (success) {
      const role = useStore.getState().adminRole;
      toast.success(role === "general" ? "Sesion de admin general iniciada." : "Sesion de armado de equipos iniciada.");
      setPin("");
    } else {
      toast.error("PIN incorrecto. Intentá de nuevo.");
    }
  };

  if (!isAdmin || !adminRole) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-3xl border border-border/60 bg-card/60 backdrop-blur-md p-6 shadow-2xl space-y-6 text-center pitch-lines relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-card/90" />
          
          <div className="relative space-y-4">
            <div className="mx-auto size-14 rounded-full bg-lime/10 border border-lime/30 flex items-center justify-center text-lime shadow-glow">
              <Lock className="size-6" />
            </div>
            
            <div className="space-y-1">
              <h1 className="font-display text-3xl uppercase tracking-wider">Consola Admin</h1>
              <p className="text-sm text-muted-foreground">Ingresá tu PIN para desbloquear las herramientas permitidas.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4 pt-2">
              <input
                type="password"
                placeholder="Ingresá el PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoFocus
                className="w-full rounded-xl border border-border/60 bg-secondary/50 px-4 py-3 text-center text-xl font-mono tracking-widest focus:outline-none focus:border-lime focus:ring-2 focus:ring-lime/15 transition"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-lime px-4 py-3 text-sm font-semibold text-lime-foreground hover:brightness-110 shadow-glow transition"
              >
                Ingresar
              </button>
            </form>

          </div>
        </div>
      </div>
    );
  }

  return <OrganizadorPanel />;
}

type TabKey = "partidos" | "jugadores" | "reglas";

function OrganizadorPanel() {
  const {
    matches,
    rules,
    players,
    adminRole,
    logoutAdmin,
    setTeams,
    balanceTeams,
    setStat,
    setScore,
    setMvp,
    closeMatch,
    finalizeMatch,
    reopenMatch,
    updateRules,
    resetRules,
    addPlayer,
    updatePlayer,
    deletePlayer,
    createMatch,
    deleteMatch,
    addSignupManual,
    removeSignupManual,
    loadFromDatabase,
  } = useStore();

  const isGeneralAdmin = adminRole === "general";
  const canManageTeams = adminRole === "general" || adminRole === "equipos";
  const availableTabs: TabKey[] = isGeneralAdmin ? ["partidos", "jugadores", "reglas"] : ["partidos"];

  const [activeTab, setActiveTab] = useState<TabKey>("partidos");

  // Selector del partido activo
  const defaultSelectedId = useMemo(() => {
    const openMatch = matches.find((m) => m.status === "open");
    return openMatch ? openMatch.id : matches[0]?.id;
  }, [matches]);

  const [selectedMatchId, setSelectedMatchId] = useState<string | undefined>(defaultSelectedId);

  const activeMatchId = selectedMatchId || defaultSelectedId;
  const activeMatch = matches.find((m) => m.id === activeMatchId) || matches[0];
  const refreshMatches = useCallback(() => {
    void loadFromDatabase();
  }, [loadFromDatabase]);

  useMatchRealtime(activeMatch?.id ?? "", refreshMatches);

  // Drag & drop targets states
  const [isDragOverA, setIsDragOverA] = useState(false);
  const [isDragOverB, setIsDragOverB] = useState(false);

  // States para Crear Partido
  const [showCreateMatch, setShowCreateMatch] = useState(false);
  const [newMatchFecha, setNewMatchFecha] = useState("");
  const [newMatchHora, setNewMatchHora] = useState("20:00");
  const [newMatchSede, setNewMatchSede] = useState("");
  const [newMatchFormato, setNewMatchFormato] = useState("7v7");
  const [newMatchCupoMax, setNewMatchCupoMax] = useState(14);

  // States para anotarse manualmente
  const [selectedAddPlayerId, setSelectedAddPlayerId] = useState("");
  const [selectedAddState, setSelectedAddState] = useState<"titular" | "espera">("titular");

  // States para CRUD Jugadores
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerNickname, setNewPlayerNickname] = useState("");
  const [newPlayerPos, setNewPlayerPos] = useState("MED");
  const [newPlayerRating, setNewPlayerRating] = useState(1200);
  const [newPlayerDni, setNewPlayerDni] = useState("");

  // Edición inline de jugadores
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editPlayerName, setEditPlayerName] = useState("");
  const [editPlayerNickname, setEditPlayerNickname] = useState("");
  const [editPlayerPos, setEditPlayerPos] = useState("");
  const [editPlayerRating, setEditPlayerRating] = useState(1200);
  const [editPlayerDni, setEditPlayerDni] = useState("");

  // Búsqueda de jugadores
  const [playerSearch, setPlayerSearch] = useState("");

  // Modal de crear/editar jugador
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [modalPlayerId, setModalPlayerId] = useState<string | null>(null);

  // playerMap reactivo basado en la lista de jugadores de Zustand
  const playerMap = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);

  const unassignedPlayers = useMemo(() => {
    if (!activeMatch) return [];
    const registeredIds = new Set([
      ...(activeMatch.confirmed ?? []),
      ...(activeMatch.waitlist ?? [])
    ]);
    return players.filter((p) => !registeredIds.has(p.id));
  }, [players, activeMatch]);

  const result = getMatchResult(activeMatch);
  const teamAPlayers = result.teamA.map((id) => playerMap[id]).filter(Boolean);
  const teamBPlayers = result.teamB.map((id) => playerMap[id]).filter(Boolean);
  const votingSummary = useMemo(
    () => buildVotingSummary(activeMatch, playerMap),
    [activeMatch, playerMap],
  );

  const avgA = teamAPlayers.length
    ? Math.round(teamAPlayers.reduce((sum, p) => sum + p.rating, 0) / teamAPlayers.length)
    : 0;
  const avgB = teamBPlayers.length
    ? Math.round(teamBPlayers.reduce((sum, p) => sum + p.rating, 0) / teamBPlayers.length)
    : 0;

  // Lógica Drag & Drop
  const handleDragStart = (e: React.DragEvent, playerId: string) => {
    if (!canManageTeams || !activeMatch || activeMatch.played) return;
    e.dataTransfer.setData("text/plain", playerId);
  };

  const handleDrop = (e: React.DragEvent, targetTeam: "A" | "B") => {
    if (!canManageTeams || !activeMatch || activeMatch.played) return;
    e.preventDefault();
    const playerId = e.dataTransfer.getData("text/plain");
    if (!playerId) return;

    let newA = [...result.teamA];
    let newB = [...result.teamB];

    if (targetTeam === "A") {
      if (newA.includes(playerId)) return;
      newA.push(playerId);
      newB = newB.filter((id) => id !== playerId);
    } else {
      if (newB.includes(playerId)) return;
      newB.push(playerId);
      newA = newA.filter((id) => id !== playerId);
    }

    setTeams(activeMatch.id, newA, newB);
  };

  // Balancear equipos
  const handleBalance = async () => {
    if (!canManageTeams || !activeMatch || activeMatch.played) return;
    const promise = balanceTeams(activeMatch.id);
    toast.promise(promise, {
      loading: "Balanceando equipos...",
      success: "¡Equipos balanceados de forma pareja!",
      error: "Error al balancear equipos",
    });
  };

  // Pasar partido a fase Jugado (inscripción cerrada, listo para votar)
  const handleCloseMatch = async () => {
    if (!isGeneralAdmin) return;
    if (!activeMatch) return;
    if (result.scoreA < 0 || result.scoreB < 0) {
      toast.error("El resultado final de goles no puede ser negativo.");
      return;
    }
    const promise = closeMatch(activeMatch.id);
    toast.promise(promise, {
      loading: "Pasando a fase Jugado...",
      success: "¡Partido jugado! La votación de MVP y Gol de la Fecha ya está abierta.",
      error: "Error al actualizar el partido",
    });
  };

  // Finalizar partido: cerrar votación y asignar ganadores
  const handleFinalizeMatch = async () => {
    if (!isGeneralAdmin) return;
    if (!activeMatch) return;
    const promise = finalizeMatch(activeMatch.id);
    toast.promise(promise, {
      loading: "Cerrando votación y asignando ganadores...",
      success: "¡Partido cerrado! MVP y Gol de la Fecha asignados.",
      error: "Error al finalizar el partido",
    });
  };

  const handleReopenMatch = async () => {
    if (!isGeneralAdmin) return;
    if (!activeMatch) return;
    const promise = reopenMatch(activeMatch.id);
    toast.promise(promise, {
      loading: "Reabriendo partido...",
      success: "Partido reabierto con éxito.",
      error: "Error al reabrir el partido",
    });
  };

  // Crear Partido nuevo
  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGeneralAdmin) return;
    if (!newMatchFecha || !newMatchSede) {
      toast.error("Completá todos los campos.");
      return;
    }
    const promise = createMatch(newMatchFecha, newMatchHora, newMatchSede, newMatchFormato, newMatchCupoMax);
    toast.promise(promise, {
      loading: "Creando partido en Supabase...",
      success: "¡Partido creado con éxito!",
      error: "Error al crear el partido",
    });
    setShowCreateMatch(false);
    setNewMatchSede("");
    setNewMatchFecha("");
  };

  // Eliminar Partido
  const handleDeleteMatch = async () => {
    if (!isGeneralAdmin) return;
    if (!activeMatch) return;
    if (confirm(`¿Estás seguro que querés eliminar permanentemente el partido de ${activeMatch.venue}?`)) {
      const promise = deleteMatch(activeMatch.id);
      toast.promise(promise, {
        loading: "Eliminando partido de Supabase...",
        success: "Partido eliminado con éxito.",
        error: "Error al eliminar el partido",
      });
    }
  };

  // Inscribir jugador manualmente
  const handleAddSignupManual = async () => {
    if (!isGeneralAdmin) return;
    if (!activeMatch || !selectedAddPlayerId) return;
    const p = playerMap[selectedAddPlayerId];
    const promise = addSignupManual(activeMatch.id, selectedAddPlayerId, selectedAddState);
    toast.promise(promise, {
      loading: `Anotando a ${p?.nickname}...`,
      success: `¡${p?.nickname} anotado con éxito!`,
      error: "Error al anotar al jugador",
    });
    setSelectedAddPlayerId("");
  };

  // Copiar Equipos para WhatsApp
  const handleCopyTeams = () => {
    if (!canManageTeams || !activeMatch) return;
    if (teamAPlayers.length === 0 && teamBPlayers.length === 0) {
      toast.error("Armá los equipos primero.");
      return;
    }

    const dateStr = new Date(activeMatch.date).toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

    const posEmoji: Record<string, string> = {
      ARQ: "🥅",
      DEF: "🛡️",
      MED: "⚙️",
      DEL: "⚽",
    };

    const formatTeam = (players: typeof teamAPlayers) =>
      players.map((p) => `• ${p.nickname} ${posEmoji[p.position] ?? ""}`).join("\n");

    const text = `⚽ *EQUIPOS DEL PICADO* ⚽
📍 *Sede:* ${activeMatch.venue}
🗓️ *Fecha:* ${dateStr} a las ${activeMatch.hora.slice(0, 5)} hs
👥 *Formato:* ${activeMatch.format}

🟢 *EQUIPO A* (${teamAPlayers.length} jugadores)
${formatTeam(teamAPlayers)}
_Promedio ELO: ${avgA}_

🟡 *EQUIPO B* (${teamBPlayers.length} jugadores)
${formatTeam(teamBPlayers)}
_Promedio ELO: ${avgB}_

_¡Nos vemos en la cancha!_ 🙌`;

    navigator.clipboard.writeText(text);
    toast.success("¡Equipos copiados para WhatsApp!");
  };

  // Copiar Crónica de WhatsApp
  const handleCopyChronicle = () => {
    if (!isGeneralAdmin) return;
    if (!activeMatch || !result) return;

    const scorers: string[] = [];
    const assistants: string[] = [];
    const nameFor = (pid?: string | null) => {
      if (!pid) return "Sin elegir";
      return playerMap[pid]?.nickname ?? playerMap[pid]?.name ?? "Sin elegir";
    };
    let mvpName = nameFor(result.mvpResult);
    const golFechaName = nameFor(result.golResult);

    for (const pid of activeMatch.confirmed ?? []) {
      const p = playerMap[pid];
      if (!p) continue;
      const s = result.stats[pid];
      if (s) {
        if (s.goals > 0) {
          scorers.push(`${p.nickname} (${s.goals} ⚽)`);
        }
        if (s.assists > 0) {
          assistants.push(`${p.nickname} (${s.assists} 🎯)`);
        }
        if (!result.mvpResult && s.mvp) {
          mvpName = p.nickname;
        }
      }
    }

    const dateStr = new Date(activeMatch.date).toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

    const text = `📝 *LA CRÓNICA DE FUTBOL Y PORRO FC* ⚽
-----------------------------------------
📍 *Sede:* ${activeMatch.venue}
🗓️ *Fecha:* ${dateStr}
⏰ *Hora:* ${activeMatch.hora.slice(0, 5)} hs
👥 *Formato:* ${activeMatch.format}

💥 *RESULTADO FINAL* 💥
🟢 EQUIPO A  *${result.scoreA}*  vs  *${result.scoreB}*  EQUIPO B 🟡

⚽ *Goleadores de la fecha:*
${scorers.length > 0 ? scorers.map((s) => `• ${s}`).join("\n") : "_No se registraron goles_"}

🎯 *Asistidores de la fecha:*
${assistants.length > 0 ? assistants.map((a) => `• ${a}`).join("\n") : "_No se registraron asistencias_"}

⚽ *Gol de la Fecha:*
🥅 *${golFechaName}* 🥅

👑 *MVP del Partido:*
🏆 *${mvpName}* 🏆
-----------------------------------------
_¡Gracias a todos por venir! Nos vemos el próximo picado_ 🙌`;

    navigator.clipboard.writeText(text);
    toast.success("¡Crónica de WhatsApp copiada al portapapeles!");
  };

  // Remover inscripción manualmente (Dar de baja)
  const handleRemoveSignupManual = async (pid: string) => {
    if (!isGeneralAdmin) return;
    if (!activeMatch) return;
    const p = playerMap[pid];
    if (confirm(`¿Dar de baja a ${p?.nickname || "este jugador"} del partido?`)) {
      const promise = removeSignupManual(activeMatch.id, pid);
      toast.promise(promise, {
        loading: `Dando de baja a ${p?.nickname}...`,
        success: "Baja registrada en Supabase.",
        error: "Error al dar de baja",
      });
    }
  };

  // Formato legible de fecha
  const getFormatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-AR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
  };

  // Agregar Jugador (core logic)
  const doAddPlayer = async () => {
    if (!isGeneralAdmin) return false;
    const name = modalMode === "create" ? newPlayerName : editPlayerName;
    const nickname = modalMode === "create" ? newPlayerNickname : editPlayerNickname;
    const dni = newPlayerDni.replace(/\D/g, "");
    if (!name.trim() || !nickname.trim()) {
      toast.error("Completá todos los campos.");
      return false;
    }
    if (dni.length < 7 || dni.length > 9) {
      toast.error("Ingresa un DNI valido para identificar al jugador.");
      return false;
    }
    const pos = modalMode === "create" ? newPlayerPos : editPlayerPos;
    const rating = modalMode === "create" ? newPlayerRating : editPlayerRating;
    const promise = addPlayer(name.trim(), nickname.trim(), pos, rating, null, dni);
    toast.promise(promise, {
      loading: "Agregando jugador al plantel...",
      success: "Jugador agregado al plantel con éxito.",
      error: "Error al agregar jugador",
    });
    await promise;
    setNewPlayerName("");
    setNewPlayerNickname("");
    setNewPlayerDni("");
    return true;
  };

  // Agregar Jugador (form handler legacy)
  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    await doAddPlayer();
    setShowAddForm(false);
  };

  // Guardar Edición de Jugador
  const handleSavePlayerEdit = async (id: string) => {
    if (!isGeneralAdmin) return;
    const dni = editPlayerDni.replace(/\D/g, "");
    if (!editPlayerName.trim() || !editPlayerNickname.trim()) {
      toast.error("Los campos no pueden quedar vacíos.");
      return;
    }
    if (dni && (dni.length < 7 || dni.length > 9)) {
      toast.error("Ingresa un DNI valido o deja el campo vacio.");
      return;
    }
    const promise = updatePlayer(id, {
      name: editPlayerName.trim(),
      nickname: editPlayerNickname.trim(),
      position: editPlayerPos as any,
      rating: editPlayerRating,
      ...(dni ? { dni } : {}),
    });
    toast.promise(promise, {
      loading: "Actualizando datos del jugador...",
      success: "Datos del jugador actualizados.",
      error: "Error al actualizar jugador",
    });
    setEditingPlayerId(null);
  };

  // Abrir modal de edición de jugador
  const startEditPlayer = (p: typeof players[number]) => {
    if (!isGeneralAdmin) return;
    setModalMode("edit");
    setModalPlayerId(p.id);
    setEditingPlayerId(p.id);
    setEditPlayerName(p.name);
    setEditPlayerNickname(p.nickname);
    setEditPlayerPos(p.position);
    setEditPlayerRating(p.rating);
    setEditPlayerDni("");
    setShowPlayerModal(true);
  };

  // Abrir modal de creación
  const openCreateModal = () => {
    if (!isGeneralAdmin) return;
    setModalMode("create");
    setModalPlayerId(null);
    setEditingPlayerId(null);
    setNewPlayerName("");
    setNewPlayerNickname("");
    setNewPlayerDni("");
    setNewPlayerPos("MED");
    setNewPlayerRating(1200);
    setShowPlayerModal(true);
  };

  // Cerrar modal
  const closePlayerModal = () => {
    setShowPlayerModal(false);
    setEditingPlayerId(null);
  };

  // Eliminar Jugador
  const handleDeletePlayer = async (id: string) => {
    if (!isGeneralAdmin) return;
    const p = playerMap[id];
    if (confirm(`¿Estás seguro que querés eliminar/desactivar a ${p?.nickname || "este jugador"} del plantel?`)) {
      const promise = deletePlayer(id);
      toast.promise(promise, {
        loading: "Eliminando jugador del plantel...",
        success: "Jugador removido/desactivado del plantel.",
        error: "Error al eliminar jugador",
      });
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 md:px-6 py-6 space-y-6">
      
      {/* Header Panel */}
      <header className="flex items-center justify-between flex-wrap gap-4 border-b border-border/40 pb-4">
        <div>
          <h1 className="font-display text-4xl md:text-5xl uppercase">Consola de Control</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isGeneralAdmin ? "Gestioná partidos, modificá el plantel y configurá reglas." : "Vista de partidos y armado de equipos."}
          </p>
          <span className="mt-2 inline-flex rounded-full border border-lime/30 bg-lime/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-lime">
            {isGeneralAdmin ? "Admin general" : "Admin equipos"}
          </span>
        </div>
        <button
          onClick={() => {
            logoutAdmin();
            toast.info("Sesión de administrador cerrada.");
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-card hover:bg-secondary px-4 py-2.5 text-xs font-semibold text-foreground transition"
        >
          <LogOut className="size-3.5" /> Cerrar Sesión
        </button>
      </header>

      {/* Tabs Selector */}
      <div className="flex border-b border-border/60 bg-card/30 rounded-xl p-1 gap-1 w-full max-w-md">
        {availableTabs.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={cn(
              "flex-1 text-center py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg transition",
              activeTab === t
                ? "bg-lime text-lime-foreground shadow-glow"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            )}
          >
            {t === "partidos" ? "Partidos" : t === "jugadores" ? "Plantel" : "Reglas de Ranking"}
          </button>
        ))}
      </div>

      {/* CONTENIDO TAB 1: PARTIDOS */}
      {activeTab === "partidos" && (
        <div className="grid md:grid-cols-[280px_1fr] gap-6 animate-fade-in">
          
          {/* Lado izquierdo: Selector de partidos */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Selector de Partido</h2>
              {isGeneralAdmin && (
                <button
                  onClick={() => setShowCreateMatch(true)}
                  className="inline-flex items-center gap-1 rounded bg-lime/10 border border-lime/30 text-lime px-2 py-1 text-[10px] font-bold uppercase hover:bg-lime/20 transition animate-fade-in"
                >
                  <Plus className="size-3" /> Crear
                </button>
              )}
            </div>
            <div className="rounded-2xl border border-border/60 bg-card overflow-hidden divide-y divide-border/60">
              {matches.map((m) => {
                const isSelected = m.id === activeMatch?.id;
                const date = new Date(m.date);
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMatchId(m.id)}
                    className={cn(
                      "w-full text-left flex items-center gap-3 p-4 transition-all hover:bg-secondary/40",
                      isSelected ? "bg-secondary/70 border-l-4 border-lime" : ""
                    )}
                  >
                    <div className="text-center w-10 shrink-0">
                      <div className="font-display text-xl leading-none">{date.getDate()}</div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        {date.toLocaleDateString("es-AR", { month: "short" })}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{m.venue}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>{m.format}</span>
                        <span>·</span>
                        <span>{(m.confirmed ?? []).length} anotados</span>
                      </div>
                      {m.status === "closed" ? (
                        <span className="inline-flex items-center gap-1 text-[9px] uppercase font-bold text-muted-foreground mt-1 rounded bg-secondary/80 px-1 py-0.5">
                          Jugado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] uppercase font-bold text-lime mt-1 rounded bg-lime/10 px-1 py-0.5">
                          Abierto
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Lado derecho: Gestión del partido activo */}
          <section className="space-y-6">
            {!activeMatch ? (
              <div className="rounded-3xl border border-border/60 bg-card/40 backdrop-blur p-12 text-center text-muted-foreground flex flex-col items-center justify-center space-y-4">
                <CalendarDays className="size-12 text-muted-foreground/40 animate-pulse" />
                <div className="space-y-1">
                  <h3 className="font-display text-xl uppercase text-foreground">No hay partidos creados</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">Registrá el primer partido de la temporada para empezar a armar los equipos y calcular el ranking.</p>
                </div>
                {isGeneralAdmin && (
                  <button
                    onClick={() => setShowCreateMatch(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-lime px-4 py-2.5 text-xs font-bold text-lime-foreground hover:brightness-110 shadow-glow transition mt-2"
                  >
                    <Plus className="size-4" /> Crear Primer Partido
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-3xl border border-border/60 bg-card/40 backdrop-blur p-5 md:p-6 space-y-6">
                
                {/* Header del Partido Activo */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
                  <div>
                    <span className={cn(
                      "inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full mb-1",
                      activeMatch.status === "closed" ? "bg-muted text-muted-foreground" : "bg-lime/15 text-lime"
                    )}>
                      {activeMatch.status === "closed" ? "Partido Finalizado" : "Inscripción / Planilla Abierta"}
                    </span>
                    <h2 className="font-display text-2xl md:text-3xl uppercase leading-none mt-1">
                      {activeMatch.venue}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                      <Calendar className="size-3.5" />
                      {getFormatDate(activeMatch.date)} a las {activeMatch.hora.slice(0,5)} hs
                    </p>
                  </div>

                  {/* Botones de Finalización */}
                  <div className={cn("shrink-0 flex items-center gap-2", !isGeneralAdmin && "hidden")}>
                    <button
                      onClick={handleDeleteMatch}
                      className="inline-flex items-center justify-center p-2 rounded-xl border border-out/30 bg-card hover:bg-out/10 text-out transition"
                      title="Eliminar Partido de Supabase"
                    >
                      <Trash2 className="size-4" />
                    </button>
                    {/* Phase-based control buttons */}
                    {activeMatch.dbEstado === "cerrado" ? (
                      // Phase 3: CERRADO
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 text-gold border border-gold/30 px-3 py-1 text-[10px] font-bold uppercase">
                          <Trophy className="size-3" /> Partido Cerrado
                        </span>
                        <button
                          onClick={handleCopyChronicle}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-lime px-4 py-2 text-xs font-bold text-lime-foreground hover:brightness-110 shadow-glow transition"
                        >
                          <MessageSquare className="size-3.5" /> Crónica WhatsApp
                        </button>
                        <button
                          onClick={handleReopenMatch}
                          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary transition"
                        >
                          <Undo className="size-3.5" /> Reabrir
                        </button>
                      </div>
                    ) : activeMatch.dbEstado === "jugado" ? (
                      // Phase 2: JUGADO (voting open)
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-lime/15 text-lime border border-lime/30 px-3 py-1 text-[10px] font-bold uppercase animate-pulse">
                          🗳️ Votación Abierta
                        </span>
                        <button
                          onClick={handleFinalizeMatch}
                          className="inline-flex items-center gap-2 rounded-xl bg-gold/90 text-black px-4 py-2 text-xs font-bold hover:bg-gold transition"
                        >
                          <Trophy className="size-3.5" /> Cerrar Votación y Finalizar
                        </button>
                        <button
                          onClick={handleReopenMatch}
                          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary transition"
                        >
                          <Undo className="size-3.5" /> Reabrir
                        </button>
                      </div>
                    ) : (
                      // Phase 1: ABIERTO (armado)
                      <button
                        onClick={handleCloseMatch}
                        className="inline-flex items-center gap-2 rounded-xl bg-lime px-4 py-2 text-xs font-bold text-lime-foreground hover:brightness-110 shadow-glow transition"
                      >
                        <Check className="size-3.5" /> Partido Jugado → Abrir Votación
                      </button>
                    )}
                  </div>
                </div>

                {/* SECCIÓN 1: ARMADO DE EQUIPOS (DRAG & DROP) */}
                {isGeneralAdmin && activeMatch.dbEstado === "jugado" && (
                  <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4 space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-display text-lg uppercase flex items-center gap-2">
                          <Award className="size-4 text-gold" /> Votacion en vivo
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {votingSummary.voted}/{votingSummary.total} jugadores votaron
                          {votingSummary.remainingVotes > 0 ? ` · faltan ${votingSummary.remainingVotes}` : " · votacion completa"}
                        </p>
                      </div>
                      <button
                        onClick={handleFinalizeMatch}
                        disabled={votingSummary.voted === 0}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold/90 px-4 py-2 text-xs font-bold text-black hover:bg-gold transition disabled:opacity-40"
                      >
                        <Trophy className="size-3.5" />
                        {votingSummary.mvpRows[0]?.locked ? "Cerrar: MVP definido" : "Cerrar votacion"}
                      </button>
                    </div>

                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full bg-gold transition-all"
                        style={{ width: `${votingSummary.total ? (votingSummary.voted / votingSummary.total) * 100 : 0}%` }}
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-border/50 bg-card/60 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-gold">MVP</span>
                          {!votingSummary.hasWinnerTeam && (
                            <span className="text-[10px] text-muted-foreground">Sin equipo ganador</span>
                          )}
                        </div>
                        {votingSummary.mvpRows.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Todavia no hay votos validos para MVP.</p>
                        ) : (
                          votingSummary.mvpRows.slice(0, 3).map((row) => (
                            <div key={row.playerId} className="flex items-center justify-between gap-3 text-sm">
                              <span className="truncate">{row.name}</span>
                              <span className="inline-flex items-center gap-2 text-xs font-semibold">
                                {row.locked && <span className="rounded-full bg-lime/15 px-2 py-0.5 text-[10px] text-lime">claro ganador</span>}
                                {row.votes} voto{row.votes !== 1 ? "s" : ""}
                              </span>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="rounded-xl border border-border/50 bg-card/60 p-3 space-y-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-lime">Gol de la Fecha</span>
                        {votingSummary.golRows.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Todavia no hay votos para gol de la fecha.</p>
                        ) : (
                          votingSummary.golRows.slice(0, 3).map((row) => (
                            <div key={row.playerId} className="flex items-center justify-between gap-3 text-sm">
                              <span className="truncate">{row.name}</span>
                              <span className="inline-flex items-center gap-2 text-xs font-semibold">
                                {row.locked && <span className="rounded-full bg-lime/15 px-2 py-0.5 text-[10px] text-lime">claro ganador</span>}
                                {row.votes} voto{row.votes !== 1 ? "s" : ""}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {votingSummary.missing.length > 0 && (
                      <div className="rounded-xl border border-border/40 bg-secondary/20 px-3 py-2">
                        <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">
                          Falta votar
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {votingSummary.missing.map((player) => (
                            <span key={player.id} className="rounded-full bg-card px-2 py-1 text-[11px] text-muted-foreground">
                              {player.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="font-display text-lg uppercase">Armar Equipos</h3>
                      <p className="text-xs text-muted-foreground">Arrastrá a los titulares para armar los dos equipos.</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {canManageTeams && !activeMatch.played && (
                        <button
                          onClick={handleBalance}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-lime/40 bg-lime/10 px-3 py-1.5 text-xs font-semibold text-lime hover:bg-lime/20 transition"
                        >
                          <Shuffle className="size-3.5" /> Sortear balanceados
                        </button>
                      )}
                      {canManageTeams && (teamAPlayers.length > 0 || teamBPlayers.length > 0) && (
                        <button
                          onClick={handleCopyTeams}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary transition"
                        >
                          <MessageSquare className="size-3.5" /> Compartir equipos
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    
                    {/* Equipo A */}
                    <div
                      onDragOver={(e) => { if (canManageTeams && !activeMatch.played) e.preventDefault(); }}
                      onDragEnter={() => { if (canManageTeams && !activeMatch.played) setIsDragOverA(true); }}
                      onDragLeave={() => setIsDragOverA(false)}
                      onDrop={(e) => { setIsDragOverA(false); handleDrop(e, "A"); }}
                      className={cn(
                        "rounded-2xl border bg-card p-4 transition-all duration-200 min-h-[300px]",
                        isDragOverA ? "border-lime shadow-glow bg-lime/5 scale-[1.01]" : "border-border/60",
                        activeMatch.played ? "opacity-90" : ""
                      )}
                    >
                      <div className="flex items-center justify-between mb-3 border-b border-border/40 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="size-3 rounded-full bg-lime" />
                          <span className="font-display text-lg uppercase">Equipo A</span>
                          <span className="text-xs text-muted-foreground">({teamAPlayers.length})</span>
                        </div>
                        <div className="text-right">
                          <div className="font-display text-xl leading-none text-lime">{avgA}</div>
                          <div className="text-[8px] uppercase tracking-wider text-muted-foreground">prom.</div>
                        </div>
                      </div>

                      <ul className="space-y-1.5">
                        {teamAPlayers.length === 0 ? (
                          <div className="h-48 border border-dashed border-border/40 rounded-xl flex items-center justify-center text-xs text-muted-foreground/60">
                            Arrastrá jugadores aquí
                          </div>
                        ) : (
                          teamAPlayers.map((p) => (
                            <li
                              key={p.id}
                              draggable={canManageTeams && !activeMatch.played}
                              onDragStart={(e) => handleDragStart(e, p.id)}
                              className={cn(
                                "flex items-center gap-3 rounded-xl bg-secondary/50 px-2.5 py-2",
                                activeMatch.played || !canManageTeams ? "" : "cursor-grab active:cursor-grabbing hover:bg-secondary transition"
                              )}
                            >
                              <PlayerAvatar player={p} size="sm" />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold truncate">{p.nickname}</div>
                                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{p.position}</div>
                              </div>
                              <span className="font-display text-sm tabular-nums text-muted-foreground">{p.rating}</span>
                              {isGeneralAdmin && !activeMatch.played && (
                                <button
                                  onClick={() => handleRemoveSignupManual(p.id)}
                                  className="p-1 rounded hover:bg-out/25 text-muted-foreground hover:text-out transition shrink-0"
                                  title="Dar de baja de Supabase"
                                >
                                  <X className="size-3" />
                                </button>
                              )}
                            </li>
                          ))
                        )}
                      </ul>
                    </div>

                    {/* Equipo B */}
                    <div
                      onDragOver={(e) => { if (canManageTeams && !activeMatch.played) e.preventDefault(); }}
                      onDragEnter={() => { if (canManageTeams && !activeMatch.played) setIsDragOverB(true); }}
                      onDragLeave={() => setIsDragOverB(false)}
                      onDrop={(e) => { setIsDragOverB(false); handleDrop(e, "B"); }}
                      className={cn(
                        "rounded-2xl border bg-card p-4 transition-all duration-200 min-h-[300px]",
                        isDragOverB ? "border-gold shadow-glow bg-gold/5 scale-[1.01]" : "border-border/60",
                        activeMatch.played ? "opacity-90" : ""
                      )}
                    >
                      <div className="flex items-center justify-between mb-3 border-b border-border/40 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="size-3 rounded-full bg-gold" />
                          <span className="font-display text-lg uppercase">Equipo B</span>
                          <span className="text-xs text-muted-foreground">({teamBPlayers.length})</span>
                        </div>
                        <div className="text-right">
                          <div className="font-display text-xl leading-none text-gold">{avgB}</div>
                          <div className="text-[8px] uppercase tracking-wider text-muted-foreground">prom.</div>
                        </div>
                      </div>

                      <ul className="space-y-1.5">
                        {teamBPlayers.length === 0 ? (
                          <div className="h-48 border border-dashed border-border/40 rounded-xl flex items-center justify-center text-xs text-muted-foreground/60">
                            Arrastrá jugadores aquí
                          </div>
                        ) : (
                          teamBPlayers.map((p) => (
                            <li
                              key={p.id}
                              draggable={canManageTeams && !activeMatch.played}
                              onDragStart={(e) => handleDragStart(e, p.id)}
                              className={cn(
                                "flex items-center gap-3 rounded-xl bg-secondary/50 px-2.5 py-2",
                                activeMatch.played || !canManageTeams ? "" : "cursor-grab active:cursor-grabbing hover:bg-secondary transition"
                              )}
                            >
                              <PlayerAvatar player={p} size="sm" />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold truncate">{p.nickname}</div>
                                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{p.position}</div>
                              </div>
                              <span className="font-display text-sm tabular-nums text-muted-foreground">{p.rating}</span>
                              {isGeneralAdmin && !activeMatch.played && (
                                <button
                                  onClick={() => handleRemoveSignupManual(p.id)}
                                  className="p-1 rounded hover:bg-out/25 text-muted-foreground hover:text-out transition shrink-0"
                                  title="Dar de baja de Supabase"
                                >
                                  <X className="size-3" />
                                </button>
                              )}
                            </li>
                          ))
                        )}
                      </ul>
                    </div>

                  </div>

                  {/* Inscripción Manual */}
                  {isGeneralAdmin && !activeMatch.played && (
                    <div className="rounded-2xl border border-border/50 bg-secondary/15 p-4 space-y-3 font-sans">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs uppercase font-bold text-muted-foreground">Inscripción Manual (Admin)</h4>
                        <span className="text-[10px] text-muted-foreground">Anotar sin DNI directo en Supabase</span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <select
                          value={selectedAddPlayerId}
                          onChange={(e) => setSelectedAddPlayerId(e.target.value)}
                          className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:border-lime select"
                        >
                          <option value="">-- Seleccionar jugador del plantel --</option>
                          {unassignedPlayers.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nickname} ({p.name}) - {p.position} [ELO: {p.rating}]
                            </option>
                          ))}
                        </select>
                        <select
                          value={selectedAddState}
                          onChange={(e) => setSelectedAddState(e.target.value as "titular" | "espera")}
                          className="w-full sm:w-32 rounded-xl border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:border-lime select"
                        >
                          <option value="titular">Titular</option>
                          <option value="espera">Espera</option>
                        </select>
                        <button
                          type="button"
                          onClick={handleAddSignupManual}
                          disabled={!selectedAddPlayerId}
                          className="rounded-xl bg-lime px-4 py-2 text-xs font-bold text-lime-foreground hover:brightness-110 shadow-glow transition disabled:opacity-40"
                        >
                          Anotar Jugador
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* SECCIÓN 2: RESULTADOS Y ESTADÍSTICAS */}
                {isGeneralAdmin && (
                <div className="space-y-4 pt-2 border-t border-border/40">
                  <div>
                    <h3 className="font-display text-lg uppercase">Resultado y Planilla</h3>
                    <p className="text-xs text-muted-foreground">Cargá los goles de cada equipo y el desempeño de los pibes.</p>
                  </div>

                  {/* Score Editor */}
                  <div className="flex items-center justify-center gap-6 rounded-2xl bg-secondary/30 border border-border/50 py-4 px-6 max-w-md mx-auto">
                    <div className="text-center space-y-1">
                      <div className="text-[10px] uppercase font-bold text-lime">Equipo A</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => !activeMatch.played && setScore(activeMatch.id, Math.max(0, result.scoreA - 1), result.scoreB)}
                          disabled={activeMatch.played}
                          className="size-8 rounded bg-secondary flex items-center justify-center text-sm font-bold hover:bg-border transition disabled:opacity-40"
                        >
                          -
                        </button>
                        <span className="font-display text-3xl px-2 tabular-nums">{result.scoreA}</span>
                        <button
                          onClick={() => !activeMatch.played && setScore(activeMatch.id, result.scoreA + 1, result.scoreB)}
                          disabled={activeMatch.played}
                          className="size-8 rounded bg-secondary flex items-center justify-center text-sm font-bold hover:bg-border transition disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="font-display text-2xl text-muted-foreground/60">vs</div>

                    <div className="text-center space-y-1">
                      <div className="text-[10px] uppercase font-bold text-gold">Equipo B</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => !activeMatch.played && setScore(activeMatch.id, result.scoreA, Math.max(0, result.scoreB - 1))}
                          disabled={activeMatch.played}
                          className="size-8 rounded bg-secondary flex items-center justify-center text-sm font-bold hover:bg-border transition disabled:opacity-40"
                        >
                          -
                        </button>
                        <span className="font-display text-3xl px-2 tabular-nums">{result.scoreB}</span>
                        <button
                          onClick={() => !activeMatch.played && setScore(activeMatch.id, result.scoreA, result.scoreB + 1)}
                          disabled={activeMatch.played}
                          className="size-8 rounded bg-secondary flex items-center justify-center text-sm font-bold hover:bg-border transition disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Stats Table */}
                  <div className="rounded-2xl border border-border/50 overflow-hidden bg-card/60">
                    <div className="grid grid-cols-[1fr_repeat(4,3.8rem)] md:grid-cols-[1fr_repeat(4,5rem)] px-4 py-2.5 text-[9px] uppercase tracking-wider text-muted-foreground border-b border-border/50 bg-secondary/40 font-semibold">
                      <span>Jugador</span>
                      <span className="text-center">Asistió</span>
                      <span className="text-center">Goles</span>
                      <span className="text-center">Asist.</span>
                      <span className="text-center">MVP</span>
                    </div>

                    <ul className="divide-y divide-border/40 font-sans">
                      {(activeMatch.confirmed ?? []).map((pid) => {
                        const player = playerMap[pid];
                        if (!player) return null;

                        const playerStats = result.stats[pid] ?? {
                          attended: true,
                          goals: 0,
                          assists: 0,
                          mvp: false,
                        };
                        const isTeamA = result.teamA.includes(pid);

                        const updatePlayerStat = (field: keyof PlayerStats, val: any) => {
                          if (activeMatch.played) return;
                          setStat(activeMatch.id, pid, { [field]: val });
                        };

                        return (
                          <li
                            key={pid}
                            className={cn(
                              "grid grid-cols-[1fr_repeat(4,3.8rem)] md:grid-cols-[1fr_repeat(4,5rem)] items-center px-4 py-2.5",
                              playerStats.attended ? "" : "opacity-50 bg-secondary/10"
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <PlayerAvatar player={player} size="sm" />
                              <div className="min-w-0">
                                <div className="text-xs font-semibold truncate flex items-center gap-1">
                                  {player.nickname}
                                  <span className={cn(
                                    "size-1.5 rounded-full inline-block shrink-0",
                                    isTeamA ? "bg-lime" : "bg-gold"
                                  )} />
                                </div>
                                <span className="text-[9px] text-muted-foreground uppercase">{player.position}</span>
                              </div>
                            </div>

                            {/* Checkbox Asistencia */}
                            <div className="flex justify-center">
                              <input
                                type="checkbox"
                                checked={playerStats.attended}
                                disabled={activeMatch.played}
                                onChange={(e) => updatePlayerStat("attended", e.target.checked)}
                                className="size-4 rounded border-border bg-secondary text-lime focus:ring-lime focus:ring-offset-background cursor-pointer"
                              />
                            </div>

                            {/* Contador Goles */}
                            <div className="flex items-center justify-center gap-1 font-mono text-xs">
                              <button
                                onClick={() => updatePlayerStat("goals", Math.max(0, playerStats.goals - 1))}
                                disabled={activeMatch.played || !playerStats.attended}
                                className="size-5 rounded bg-secondary hover:bg-border text-[9px] flex items-center justify-center font-bold"
                              >
                                -
                              </button>
                              <span className="w-4 text-center tabular-nums">{playerStats.goals}</span>
                              <button
                                onClick={() => updatePlayerStat("goals", playerStats.goals + 1)}
                                disabled={activeMatch.played || !playerStats.attended}
                                className="size-5 rounded bg-secondary hover:bg-border text-[9px] flex items-center justify-center font-bold"
                              >
                                +
                              </button>
                            </div>

                            {/* Contador Asistencias */}
                            <div className="flex items-center justify-center gap-1 font-mono text-xs">
                              <button
                                onClick={() => updatePlayerStat("assists", Math.max(0, playerStats.assists - 1))}
                                disabled={activeMatch.played || !playerStats.attended}
                                className="size-5 rounded bg-secondary hover:bg-border text-[9px] flex items-center justify-center font-bold"
                              >
                                -
                              </button>
                              <span className="w-4 text-center tabular-nums">{playerStats.assists}</span>
                              <button
                                onClick={() => updatePlayerStat("assists", playerStats.assists + 1)}
                                disabled={activeMatch.played || !playerStats.attended}
                                className="size-5 rounded bg-secondary hover:bg-border text-[9px] flex items-center justify-center font-bold"
                              >
                                +
                              </button>
                            </div>

                            {/* MVP */}
                            <div className="flex justify-center">
                              <button
                                onClick={() => !activeMatch.played && playerStats.attended && setMvp(activeMatch.id, playerStats.mvp ? null : pid)}
                                disabled={activeMatch.played || !playerStats.attended}
                                className={cn(
                                  "p-1 rounded-full border transition",
                                  playerStats.mvp
                                    ? "bg-gold/20 border-gold/50 text-gold"
                                    : "border-border/40 text-muted-foreground/30 hover:border-border hover:text-muted-foreground"
                                )}
                              >
                                <Award className="size-4" />
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
                )}

              </div>
            )}
          </section>

        </div>
      )}

      {/* CONTENIDO TAB 2: JUGADORES (CRUD) */}
      {isGeneralAdmin && activeTab === "jugadores" && (
        <div className="space-y-5 animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-display text-2xl uppercase">Plantel de Jugadores</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{players.length} jugadores en la base de datos</p>
            </div>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-xl bg-lime px-4 py-2.5 text-xs font-bold text-lime-foreground hover:brightness-110 shadow-glow transition"
            >
              <UserPlus className="size-4" /> Nuevo Jugador
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Buscar jugador por nombre o apodo..."
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
              className="w-full rounded-xl border border-border/60 bg-card pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-lime/50 focus:ring-1 focus:ring-lime/20 transition"
            />
            {playerSearch && (
              <button onClick={() => setPlayerSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Player grid */}
          {(() => {
            const filtered = players.filter((p) => {
              const q = playerSearch.toLowerCase();
              return !q || p.name.toLowerCase().includes(q) || p.nickname.toLowerCase().includes(q) || p.position.toLowerCase().includes(q);
            });

            if (filtered.length === 0) {
              return (
                <div className="text-center py-16 text-muted-foreground">
                  <Users className="size-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No se encontraron jugadores</p>
                  <p className="text-xs mt-1">Probá con otro nombre o apodo</p>
                </div>
              );
            }

            const posColors: Record<string, string> = {
              ARQ: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
              DEF: "text-blue-400 bg-blue-400/10 border-blue-400/30",
              MED: "text-lime bg-lime/10 border-lime/30",
              DEL: "text-rose-400 bg-rose-400/10 border-rose-400/30",
            };

            return (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map((p) => (
                  <div
                    key={p.id}
                    className="group relative rounded-2xl border border-border/60 bg-card hover:border-lime/40 hover:shadow-md transition-all p-4 flex items-center gap-3.5"
                  >
                    {/* Avatar */}
                    <PlayerAvatar player={p} size="md" />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{p.nickname}</div>
                      <div className="text-xs text-muted-foreground truncate">{p.name}</div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
                          posColors[p.position] ?? "text-muted-foreground bg-secondary border-border",
                        )}>
                          {p.position}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">ELO {p.rating}</span>
                      </div>
                    </div>

                    {/* Actions (show on hover) */}
                    <div className="flex flex-col gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEditPlayer(p)}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                        title="Editar jugador"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeletePlayer(p.id)}
                        className="p-1.5 rounded-lg hover:bg-out/15 text-muted-foreground hover:text-out transition"
                        title="Eliminar jugador"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* CONTENIDO TAB 3: REGLAS */}
      {isGeneralAdmin && activeTab === "reglas" && (
        <div className="rounded-3xl border border-border/60 bg-card/40 backdrop-blur p-6 space-y-6 max-w-2xl mx-auto animate-fade-in font-sans">
          <div className="flex items-center gap-2 border-b border-border/40 pb-3">
            <Settings2 className="size-5 text-lime shadow-glow" />
            <h2 className="font-display text-2xl uppercase">Configuración de Reglas de Puntuación</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Los puntos definidos abajo ponderan el peso de cada estadística individual. Afecta instantáneamente los totales de puntos en la pantalla de **Ranking**.
          </p>

          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 pt-2">
            
            {/* Asistencia */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Puntos por asistir</label>
              <input
                type="number"
                value={rules.attendance}
                onChange={(e) => updateRules({ attendance: parseInt(e.target.value) || 0 })}
                className="w-full rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm text-center font-mono focus:outline-none focus:border-lime"
              />
            </div>

            {/* Victoria */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Puntos por Victoria</label>
              <input
                type="number"
                value={rules.win}
                onChange={(e) => updateRules({ win: parseInt(e.target.value) || 0 })}
                className="w-full rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm text-center font-mono focus:outline-none focus:border-lime"
              />
            </div>

            {/* Empate */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Puntos por Empate</label>
              <input
                type="number"
                value={rules.draw}
                onChange={(e) => updateRules({ draw: parseInt(e.target.value) || 0 })}
                className="w-full rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm text-center font-mono focus:outline-none focus:border-lime"
              />
            </div>

            {/* MVP */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Puntos por MVP 👑</label>
              <input
                type="number"
                value={rules.mvp}
                onChange={(e) => updateRules({ mvp: parseInt(e.target.value) || 0 })}
                className="w-full rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm text-center font-mono focus:outline-none focus:border-lime"
              />
            </div>

            {/* Gol de la Fecha */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Puntos Gol de la Fecha ⚽</label>
              <input
                type="number"
                value={rules.goalOfTheDay}
                onChange={(e) => updateRules({ goalOfTheDay: parseInt(e.target.value) || 0 })}
                className="w-full rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm text-center font-mono focus:outline-none focus:border-lime"
              />
            </div>

            <div className="col-span-full pt-4 flex justify-end">
              <button
                onClick={resetRules}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                Restablecer valores por defecto
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Modal Crear / Editar Jugador ── */}
      {isGeneralAdmin && showPlayerModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closePlayerModal} />
          <div className="relative w-full max-w-md rounded-3xl bg-card border border-border/60 p-6 shadow-2xl animate-fade-in font-sans">
            <button
              onClick={closePlayerModal}
              className="absolute top-4 right-4 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition"
            >
              <X className="size-4" />
            </button>

            <div className="mb-5">
              <h2 className={`font-display text-2xl uppercase mb-1 ${modalMode === "create" ? "text-lime" : "text-foreground"}`}>
                {modalMode === "create" ? "➕ Nuevo Jugador" : "✏️ Editar Jugador"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {modalMode === "create" ? "Completá los datos para agregar al plantel." : "Modificá los datos del jugador."}
              </p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (modalMode === "create") {
                  const ok = await doAddPlayer();
                  if (ok) closePlayerModal();
                } else if (modalPlayerId) {
                  await handleSavePlayerEdit(modalPlayerId);
                  closePlayerModal();
                }
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Ej. Juan Román Riquelme"
                    value={modalMode === "create" ? newPlayerName : editPlayerName}
                    onChange={(e) => modalMode === "create" ? setNewPlayerName(e.target.value) : setEditPlayerName(e.target.value)}
                    className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime/20 transition"
                  />
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Apodo / Nickname *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Romi"
                    value={modalMode === "create" ? newPlayerNickname : editPlayerNickname}
                    onChange={(e) => modalMode === "create" ? setNewPlayerNickname(e.target.value) : setEditPlayerNickname(e.target.value)}
                    className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime/20 transition"
                  />
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">
                    DNI {modalMode === "create" ? "*" : "(opcional)"}
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    required={modalMode === "create"}
                    placeholder={modalMode === "create" ? "Ej. 35123456" : "Completar solo para cargar o cambiar"}
                    value={modalMode === "create" ? newPlayerDni : editPlayerDni}
                    onChange={(e) => modalMode === "create" ? setNewPlayerDni(e.target.value) : setEditPlayerDni(e.target.value)}
                    className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime/20 transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Posición</label>
                  <select
                    value={modalMode === "create" ? newPlayerPos : editPlayerPos}
                    onChange={(e) => modalMode === "create" ? setNewPlayerPos(e.target.value) : setEditPlayerPos(e.target.value)}
                    className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:border-lime transition"
                  >
                    <option value="ARQ">🥅 Arquero</option>
                    <option value="DEF">🛡️ Defensor</option>
                    <option value="MED">⚙️ Mediocampista</option>
                    <option value="DEL">⚽ Delantero</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">ELO / Rating</label>
                  <input
                    type="number"
                    min="1"
                    max="3000"
                    required
                    value={modalMode === "create" ? newPlayerRating : editPlayerRating}
                    onChange={(e) => {
                      const v = parseInt(e.target.value) || 1200;
                      modalMode === "create" ? setNewPlayerRating(v) : setEditPlayerRating(v);
                    }}
                    className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-center font-mono focus:outline-none focus:border-lime transition"
                  />
                </div>
              </div>

              {/* ELO helper */}
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-secondary/50 rounded-xl px-3 py-2">
                <span>💡</span>
                <span>ELO base sugerido: <strong>1200</strong>. Rango: 800 (principiante) — 1800 (experto).</span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closePlayerModal}
                  className="flex-1 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-secondary transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-lime px-4 py-2.5 text-xs font-bold text-lime-foreground hover:brightness-110 shadow-glow transition"
                >
                  {modalMode === "create" ? "Agregar al Plantel" : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Crear Partido ── */}
      {isGeneralAdmin && showCreateMatch && (

        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateMatch(false)} />
          <div className="relative w-full max-w-sm rounded-3xl bg-card border border-border/60 p-6 shadow-2xl animate-fade-in font-sans">
            <button
              onClick={() => setShowCreateMatch(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition"
            >
              <X className="size-4" />
            </button>
            <h2 className="font-display text-2xl uppercase mb-1 text-lime">Crear Nuevo Partido</h2>
            <p className="text-xs text-muted-foreground mb-4">Ingresá los datos del picado en Supabase.</p>
            <form onSubmit={handleCreateMatch} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Sede / Complejo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Club Estrella del Sur"
                  value={newMatchSede}
                  onChange={(e) => setNewMatchSede(e.target.value)}
                  className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:border-lime"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Fecha</label>
                  <input
                    type="date"
                    required
                    value={newMatchFecha}
                    onChange={(e) => setNewMatchFecha(e.target.value)}
                    className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:border-lime"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Hora</label>
                  <input
                    type="time"
                    required
                    value={newMatchHora}
                    onChange={(e) => setNewMatchHora(e.target.value)}
                    className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:border-lime"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Formato</label>
                  <select
                    value={newMatchFormato}
                    onChange={(e) => setNewMatchFormato(e.target.value)}
                    className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:border-lime"
                  >
                    <option value="5v5">5v5</option>
                    <option value="7v7">7v7</option>
                    <option value="8v8">8v8</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Cupo Máximo</label>
                  <input
                    type="number"
                    min="2"
                    max="50"
                    required
                    value={newMatchCupoMax}
                    onChange={(e) => setNewMatchCupoMax(parseInt(e.target.value) || 14)}
                    className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm text-center focus:outline-none focus:border-lime"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-lime px-4 py-3 text-sm font-semibold text-lime-foreground hover:brightness-110 shadow-glow transition mt-2"
              >
                Crear Partido
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
