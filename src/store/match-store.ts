import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  matches as seedMatches,
  players as seedPlayers,
  type Match,
  type Player,
} from "@/lib/mock-data";
import {
  adminCreateMatch,
  adminUpdateMatch,
  adminDeleteMatch,
  adminAddSignup,
  adminRemoveSignup,
  adminCreatePlayer,
  adminUpdatePlayer,
  adminDeletePlayer,
  getMatchesWithSignups,
  getJugadores,
  getScoringRules,
  saveScoringRules,
} from "@/lib/api/picado.functions";
import type { PicadoAdminRole, PicadoMatchType } from "@/types/picado";

export type PlayerStats = {
  attended: boolean;
  goals: number;
  assists: number;
  mvp: boolean;
  golVote?: boolean; // true if this player is the Gol de la Fecha winner
};

export type MatchResult = {
  scoreA: number;
  scoreB: number;
  teamA: string[];
  teamB: string[];
  stats: Record<string, PlayerStats>;
  votes?: MatchVote[];
  mvpResult?: string; // player_id of confirmed MVP winner
  golResult?: string; // player_id of confirmed Gol de la Fecha winner
};

type MatchVote = {
  voter_id: string;
  mvp_vote: string;
  gol_vote: string;
};

type GuestParticipant = {
  id: string;
  name: string;
  estado: "titular" | "espera";
  invitedBy?: string | null;
};

export type StoredMatch = Match & {
  result?: MatchResult;
  played?: boolean;
  dbEstado?: string;
  guestPlayers?: Player[];
  guestSignups?: GuestParticipant[];
};

export type ScoringRules = {
  attendance: number;
  win: number;
  draw: number;
  loss: number;
  goal: number;
  assist: number;
  mvp: number;
  goalOfTheDay: number;
};

export const defaultRules: ScoringRules = {
  attendance: 1,
  win: 3,
  draw: 1,
  loss: 0,
  goal: 0,
  assist: 0,
  mvp: 5,
  goalOfTheDay: 3,
};

export type AdminRole = "general" | "equipos" | "fondo";
export type AdminSource = "pin" | "dni";
export type PicadoPlayer = Player & { adminRole?: PicadoAdminRole | null };

const ADMIN_ACCESS_CODES: Array<{ pin: string; role: AdminRole }> = [
  { pin: "1984", role: "general" },
  { pin: import.meta.env.VITE_EQUIPOS_ADMIN_PIN || "2468", role: "equipos" },
];

type State = {
  matches: StoredMatch[];
  rules: ScoringRules;
  players: PicadoPlayer[];
  isAdmin: boolean;
  adminRole: AdminRole | null;
  adminSource: AdminSource | null;
  adminPlayerId: string | null;
};

type Actions = {
  setTeams: (matchId: string, teamA: string[], teamB: string[]) => Promise<void>;
  balanceTeams: (matchId: string) => Promise<void>;
  setStat: (matchId: string, playerId: string, patch: Partial<PlayerStats>) => Promise<void>;
  setScore: (matchId: string, scoreA: number, scoreB: number) => Promise<void>;
  setMvp: (matchId: string, playerId: string | null) => Promise<void>;
  closeMatch: (matchId: string) => Promise<void>;
  finalizeMatch: (matchId: string) => Promise<void>;
  reopenMatch: (matchId: string) => Promise<void>;
  updateRules: (patch: Partial<ScoringRules>) => void;
  resetRules: () => void;
  saveRules: () => Promise<void>;
  // Admin and Player CRUD Actions
  loginAdmin: (pin: string) => boolean;
  loginAdminByPlayer: (role: AdminRole, playerId: string) => void;
  logoutAdmin: () => void;
  addPlayer: (
    name: string,
    nickname: string,
    position: string,
    rating: number,
    foto_url?: string | null,
    dni?: string | null,
    adminRole?: PicadoAdminRole | null,
  ) => Promise<void>;
  updatePlayer: (
    id: string,
    patch: Partial<PicadoPlayer> & { dni?: string | null; adminRole?: PicadoAdminRole | null },
  ) => Promise<void>;
  deletePlayer: (id: string) => Promise<void>;
  createMatch: (
    fecha: string,
    hora: string,
    sede: string,
    formato: string,
    cupo_max: number,
    matchType?: PicadoMatchType,
  ) => Promise<void>;
  updateMatch: (
    id: string,
    patch: {
      fecha?: string;
      hora?: string;
      sede?: string;
      formato?: string;
      cupo_max?: number;
      matchType?: PicadoMatchType;
    },
  ) => Promise<void>;
  deleteMatch: (id: string) => Promise<void>;
  addSignupManual: (
    matchId: string,
    playerId: string,
    estado: "titular" | "espera",
  ) => Promise<void>;
  removeSignupManual: (matchId: string, playerId: string) => Promise<void>;
  loadFromDatabase: () => Promise<void>;
};

function initialResult(m: Match): MatchResult {
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

function balance(ids: string[], playerMap: Record<string, Player>): [string[], string[]] {
  const a: string[] = [];
  const b: string[] = [];

  // Separamos por posiciones
  const playersByPosition: Record<string, string[]> = {
    ARQ: [],
    DEF: [],
    MED: [],
    DEL: [],
  };

  for (const id of ids) {
    const p = playerMap[id];
    const pos = p?.position || "MED";
    if (playersByPosition[pos]) {
      playersByPosition[pos].push(id);
    } else {
      playersByPosition["MED"].push(id);
    }
  }

  // Repartimos cada posición en cantidades parejas entre A y B.
  // Mezclamos al azar dentro de cada posición para que el sorteo varíe.
  const positionsOrder = ["ARQ", "DEF", "DEL", "MED"];
  for (const pos of positionsOrder) {
    const group = [...playersByPosition[pos]].sort(() => Math.random() - 0.5);

    for (const id of group) {
      const countA = a.filter((x) => playerMap[x]?.position === pos).length;
      const countB = b.filter((x) => playerMap[x]?.position === pos).length;

      // Mandamos al equipo con menos jugadores de esta posición;
      // si están igualados, al que tenga menos jugadores en total.
      if (countA < countB) {
        a.push(id);
      } else if (countB < countA) {
        b.push(id);
      } else if (a.length <= b.length) {
        a.push(id);
      } else {
        b.push(id);
      }
    }
  }
  return [a, b];
}

function getWinnerTeam(result: MatchResult): string[] {
  if (result.scoreA > result.scoreB) return result.teamA;
  if (result.scoreB > result.scoreA) return result.teamB;
  return [];
}

function getTeamScore(team: string[], stats: Record<string, PlayerStats>) {
  return team.reduce((sum, playerId) => {
    const row = stats[playerId];
    if (!row || row.attended === false) return sum;
    return sum + Math.max(0, row.goals || 0);
  }, 0);
}

function withDerivedScore(result: MatchResult): MatchResult {
  return {
    ...result,
    scoreA: getTeamScore(result.teamA, result.stats),
    scoreB: getTeamScore(result.teamB, result.stats),
  };
}

function withConfirmedParticipants(result: MatchResult, confirmed: string[]): MatchResult {
  const teamA = [...(result.teamA ?? [])];
  const teamB = [...(result.teamB ?? [])];
  const stats = { ...(result.stats ?? {}) };
  const assigned = new Set([...teamA, ...teamB]);
  let changed = false;

  for (const playerId of confirmed) {
    if (!stats[playerId]) {
      stats[playerId] = { attended: true, goals: 0, assists: 0, mvp: false };
      changed = true;
    }
    if (!assigned.has(playerId)) {
      if (teamA.length <= teamB.length) teamA.push(playerId);
      else teamB.push(playerId);
      assigned.add(playerId);
      changed = true;
    }
  }

  if (!changed) return result;
  return withDerivedScore({ ...result, teamA, teamB, stats });
}

function topVote(
  votes: MatchVote[],
  field: "mvp_vote" | "gol_vote",
  options: {
    eligibleIds: Set<string>;
    rejectSelfVote?: boolean;
  },
) {
  const tally: Record<string, number> = {};
  for (const vote of votes) {
    const playerId = vote[field];
    if (!playerId || !options.eligibleIds.has(playerId)) continue;
    if (options.rejectSelfVote && playerId === vote.voter_id) continue;
    tally[playerId] = (tally[playerId] ?? 0) + 1;
  }
  return Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
}

export const useStore = create<State & Actions>()(
  persist(
    (set) => ({
      matches: seedMatches.map((m) =>
        m.status === "closed"
          ? {
              ...m,
              played: true,
              result: {
                ...initialResult(m),
                scoreA: 4,
                scoreB: 3,
                stats: Object.fromEntries(
                  (m.confirmed ?? []).map((id, i) => [
                    id,
                    {
                      attended: true,
                      goals: i < 3 ? 2 : i < 7 ? 1 : 0,
                      assists: i % 3 === 0 ? 1 : 0,
                      mvp: i === 0,
                    },
                  ]),
                ),
              },
            }
          : m,
      ),
      rules: defaultRules,
      players: seedPlayers,
      isAdmin: false,
      adminRole: null,
      adminSource: null,
      adminPlayerId: null,

      setTeams: async (matchId, teamA, teamB) => {
        let updatedResult: MatchResult | undefined;
        set((s) => {
          const matches = s.matches.map((m) => {
            if (m.id !== matchId) return m;
            updatedResult = withDerivedScore({
              ...(m.result ?? initialResult(m)),
              teamA,
              teamB,
            });
            return { ...m, result: updatedResult };
          });
          return { matches };
        });
        if (updatedResult) {
          await adminUpdateMatch({
            data: {
              id: matchId,
              patch: { notas: JSON.stringify(updatedResult) },
            },
          });
        }
      },

      balanceTeams: async (matchId) => {
        let updatedResult: MatchResult | undefined;
        set((s) => {
          const currentMap = Object.fromEntries(s.players.map((p) => [p.id, p]));
          const matches = s.matches.map((m) => {
            if (m.id !== matchId) return m;
            const [a, b] = balance(m.confirmed ?? [], currentMap);
            updatedResult = withDerivedScore({
              ...(m.result ?? initialResult(m)),
              teamA: a,
              teamB: b,
            });
            return { ...m, result: updatedResult };
          });
          return { matches };
        });
        if (updatedResult) {
          await adminUpdateMatch({
            data: {
              id: matchId,
              patch: { notas: JSON.stringify(updatedResult) },
            },
          });
        }
      },

      setStat: async (matchId, playerId, patch) => {
        let updatedResult: MatchResult | undefined;
        set((s) => {
          const matches = s.matches.map((m) => {
            if (m.id !== matchId) return m;
            const base = m.result ?? initialResult(m);
            const prev = base.stats[playerId] ?? {
              attended: true,
              goals: 0,
              assists: 0,
              mvp: false,
            };
            updatedResult = {
              ...base,
              stats: { ...base.stats, [playerId]: { ...prev, ...patch } },
            };
            updatedResult = withDerivedScore(updatedResult);
            return { ...m, result: updatedResult };
          });
          return { matches };
        });
        if (updatedResult) {
          await adminUpdateMatch({
            data: {
              id: matchId,
              patch: { notas: JSON.stringify(updatedResult) },
            },
          });
        }
      },

      setScore: async (matchId, scoreA, scoreB) => {
        let updatedResult: MatchResult | undefined;
        set((s) => {
          const matches = s.matches.map((m) => {
            if (m.id !== matchId) return m;
            updatedResult = { ...(m.result ?? initialResult(m)), scoreA, scoreB };
            return { ...m, result: updatedResult };
          });
          return { matches };
        });
        if (updatedResult) {
          await adminUpdateMatch({
            data: {
              id: matchId,
              patch: { notas: JSON.stringify(updatedResult) },
            },
          });
        }
      },

      setMvp: async (matchId, playerId) => {
        let updatedResult: MatchResult | undefined;
        set((s) => {
          const matches = s.matches.map((m) => {
            if (m.id !== matchId) return m;
            const base = m.result ?? initialResult(m);
            const stats = { ...base.stats };
            for (const id of Object.keys(stats)) {
              stats[id] = { ...stats[id], mvp: id === playerId };
            }
            updatedResult = { ...base, stats };
            return { ...m, result: updatedResult };
          });
          return { matches };
        });
        if (updatedResult) {
          await adminUpdateMatch({
            data: {
              id: matchId,
              patch: { notas: JSON.stringify(updatedResult) },
            },
          });
        }
      },

      closeMatch: async (matchId) => {
        // Transition to 'jugado' state (voting phase)
        await adminUpdateMatch({
          data: {
            id: matchId,
            patch: { estado: "jugado" },
          },
        });
        set((s) => ({
          matches: s.matches.map((m) =>
            m.id !== matchId
              ? m
              : { ...m, played: true, status: "closed" as const, dbEstado: "jugado" },
          ),
        }));
      },

      finalizeMatch: async (matchId) => {
        const store = useStore.getState();
        const slug = import.meta.env.VITE_GROUP_SLUG || "fyp-fc";
        const freshMatches = await getMatchesWithSignups({ data: { slug } });
        const freshMatch = (freshMatches as StoredMatch[]).find((m) => m.id === matchId);
        const localMatch = store.matches.find((m) => m.id === matchId);
        const match = freshMatch ?? localMatch;

        if (!match) throw new Error("Partido no encontrado");

        const baseResult = match.result ?? initialResult(match);
        const notasJson: MatchResult = {
          ...baseResult,
          stats: { ...(baseResult.stats ?? {}) },
          votes: baseResult.votes ?? [],
        };

        for (const pid of match.confirmed ?? []) {
          notasJson.stats[pid] = {
            attended: true,
            goals: 0,
            assists: 0,
            mvp: false,
            ...(notasJson.stats[pid] ?? {}),
            golVote: false,
          };
        }

        const votes: MatchVote[] = notasJson.votes ?? [];
        const winnerIds = new Set(getWinnerTeam(notasJson));
        const goalScorerIds = new Set(
          (match.confirmed ?? []).filter((pid) => (notasJson.stats?.[pid]?.goals ?? 0) > 0),
        );
        const topMvp = topVote(votes, "mvp_vote", {
          eligibleIds: winnerIds,
          rejectSelfVote: true,
        });
        const topGol = topVote(votes, "gol_vote", {
          eligibleIds: goalScorerIds,
          rejectSelfVote: true,
        });

        notasJson.mvpResult = topMvp?.[0];
        notasJson.golResult = topGol?.[0];

        for (const pid of Object.keys(notasJson.stats)) {
          notasJson.stats[pid] = {
            ...notasJson.stats[pid],
            mvp: pid === notasJson.mvpResult,
            golVote: pid === notasJson.golResult,
          };
        }

        if (!topMvp && votes.length > 0) {
          console.warn("No valid MVP winner could be calculated for match", matchId);
        }
        if (!topGol && votes.length > 0) {
          console.warn("No valid Gol de la Fecha winner could be calculated for match", matchId);
        }

        await adminUpdateMatch({
          data: {
            id: matchId,
            patch: { estado: "cerrado", notas: JSON.stringify(notasJson) },
          },
        });
        await store.loadFromDatabase();
        set((s) => {
          const updated = s.matches.find((m) => m.id === matchId);
          if (updated?.dbEstado === "cerrado") return s;
          return {
            matches: s.matches.map((m) =>
              m.id !== matchId
                ? m
                : {
                    ...m,
                    played: true,
                    status: "closed" as const,
                    dbEstado: "cerrado",
                    result: notasJson,
                  },
            ),
          };
        });
      },

      reopenMatch: async (matchId) => {
        await adminUpdateMatch({
          data: {
            id: matchId,
            patch: { estado: "abierto" },
          },
        });
        set((s) => ({
          matches: s.matches.map((m) =>
            m.id !== matchId
              ? m
              : { ...m, played: false, status: "open" as const, dbEstado: "abierto" },
          ),
        }));
      },

      updateRules: (patch) => set((s) => ({ rules: { ...s.rules, ...patch } })),
      resetRules: () => set({ rules: defaultRules }),
      saveRules: async () => {
        const slug = import.meta.env.VITE_GROUP_SLUG || "fyp-fc";
        const rules = useStore.getState().rules;
        await saveScoringRules({ data: { slug, rules } });
      },

      loginAdmin: (pin) => {
        const access = ADMIN_ACCESS_CODES.find((entry) => pin.trim() === entry.pin);
        if (access) {
          set({ isAdmin: true, adminRole: access.role, adminSource: "pin", adminPlayerId: null });
          return true;
        }
        return false;
      },
      loginAdminByPlayer: (role, playerId) => {
        set({ isAdmin: true, adminRole: role, adminSource: "dni", adminPlayerId: playerId });
      },
      logoutAdmin: () =>
        set({ isAdmin: false, adminRole: null, adminSource: null, adminPlayerId: null }),

      addPlayer: async (
        name,
        nickname,
        position,
        rating,
        foto_url = null,
        dni = null,
        adminRole = null,
      ) => {
        const SPANISH_POS_MAP: Record<string, string> = {
          ARQ: "arquero",
          DEF: "defensor",
          MED: "mediocampista",
          DEL: "delantero",
        };
        const spanishPos = SPANISH_POS_MAP[position] || "mediocampista";

        await adminCreatePlayer({
          data: {
            nombre: name,
            apodo: nickname || null,
            posicion: spanishPos,
            elo: rating,
            foto_url: foto_url || null,
            dni: dni || null,
            admin_role: adminRole,
          },
        });
        const store = useStore.getState();
        await store.loadFromDatabase();
      },

      updatePlayer: async (id, patch) => {
        const patchData: {
          nombre?: string;
          apodo?: string | null;
          posicion?: string | null;
          elo?: number;
          foto_url?: string | null;
          dni?: string | null;
          admin_role?: PicadoAdminRole | null;
        } = {};
        if (patch.name !== undefined) patchData.nombre = patch.name;
        if (patch.nickname !== undefined) patchData.apodo = patch.nickname || null;
        if (patch.position !== undefined) {
          const SPANISH_POS_MAP: Record<string, string> = {
            ARQ: "arquero",
            DEF: "defensor",
            MED: "mediocampista",
            DEL: "delantero",
          };
          patchData.posicion = SPANISH_POS_MAP[patch.position] || "mediocampista";
        }
        if (patch.rating !== undefined) patchData.elo = patch.rating;
        if (patch.foto_url !== undefined) patchData.foto_url = patch.foto_url || null;
        if (patch.dni !== undefined) patchData.dni = patch.dni || null;
        if (patch.adminRole !== undefined) patchData.admin_role = patch.adminRole;

        await adminUpdatePlayer({
          data: {
            id,
            patch: patchData,
          },
        });
        const store = useStore.getState();
        await store.loadFromDatabase();
      },

      deletePlayer: async (id) => {
        await adminDeletePlayer({
          data: { id },
        });
        const store = useStore.getState();
        await store.loadFromDatabase();
      },

      createMatch: async (fecha, hora, sede, formato, cupo_max, matchType = "oficial") => {
        await adminCreateMatch({
          data: {
            fecha,
            hora: `${hora}:00`,
            sede,
            formato,
            cupo_max,
            estado: "abierto",
            match_type: matchType,
          },
        });
        const store = useStore.getState();
        await store.loadFromDatabase();
      },

      updateMatch: async (id, patch) => {
        const patchData: Parameters<typeof adminUpdateMatch>[0]["data"]["patch"] = {};
        if (patch.fecha !== undefined) patchData.fecha = patch.fecha;
        if (patch.hora !== undefined) patchData.hora = `${patch.hora.slice(0, 5)}:00`;
        if (patch.sede !== undefined) patchData.sede = patch.sede;
        if (patch.formato !== undefined) patchData.formato = patch.formato;
        if (patch.cupo_max !== undefined) patchData.cupo_max = patch.cupo_max;
        if (patch.matchType !== undefined) patchData.match_type = patch.matchType;

        await adminUpdateMatch({
          data: {
            id,
            patch: patchData,
          },
        });
        const store = useStore.getState();
        await store.loadFromDatabase();
      },

      deleteMatch: async (id) => {
        await adminDeleteMatch({
          data: { id },
        });
        const store = useStore.getState();
        await store.loadFromDatabase();
      },

      addSignupManual: async (matchId, playerId, estado) => {
        await adminAddSignup({
          data: {
            match_id: matchId,
            player_id: playerId,
            estado,
          },
        });
        const store = useStore.getState();
        await store.loadFromDatabase();
      },

      removeSignupManual: async (matchId, playerId) => {
        await adminRemoveSignup({
          data: {
            match_id: matchId,
            player_id: playerId,
          },
        });
        const store = useStore.getState();
        await store.loadFromDatabase();
      },

      loadFromDatabase: async () => {
        const slug = import.meta.env.VITE_GROUP_SLUG || "fyp-fc";
        const dbMatches = (await getMatchesWithSignups({ data: { slug } })) as StoredMatch[];
        const dbPlayers = await getJugadores();
        const dbRules = await getScoringRules({ data: { slug } });

        const POS_MAP: Record<string, string> = {
          arquero: "ARQ",
          defensor: "DEF",
          mediocampista: "MED",
          delantero: "DEL",
          polifuncional: "MED",
        };
        const colors = [
          "oklch(0.78 0.18 145)",
          "oklch(0.82 0.15 80)",
          "oklch(0.7 0.18 250)",
          "oklch(0.7 0.2 20)",
          "oklch(0.75 0.18 300)",
          "oklch(0.8 0.18 200)",
          "oklch(0.75 0.18 50)",
          "oklch(0.72 0.2 340)",
        ];
        const initialsFor = (name: string) =>
          name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0] ?? "")
            .join("")
            .toUpperCase() || "I";

        const mappedPlayers: PicadoPlayer[] = dbPlayers.map((p, i) => {
          const nickname = p.apodo || p.nombre;
          return {
            id: p.id,
            name: p.nombre,
            nickname: nickname,
            position: (POS_MAP[p.posicion || ""] || "MED") as Player["position"],
            rating: p.elo ?? 1000,
            goals: p.goles ?? 0,
            played: p.partidos_jugados ?? 0,
            initials: nickname.slice(0, 2).toUpperCase(),
            color: colors[i % colors.length],
            foto_url: p.foto_url || null,
            adminRole: p.picado_admin_role ?? null,
          };
        });
        const matchesWithGuests = dbMatches.map((match, matchIndex) => {
          const withGuests = {
            ...match,
            guestPlayers: (match.guestSignups ?? []).map((guest, guestIndex) => ({
              id: guest.id,
              name: guest.name,
              nickname: guest.name,
              position: "MED" as Player["position"],
              rating: 1000,
              goals: 0,
              played: 0,
              initials: initialsFor(guest.name),
              color: colors[(mappedPlayers.length + matchIndex + guestIndex) % colors.length],
              foto_url: null,
            })),
          };
          return withGuests.result
            ? {
                ...withGuests,
                result: withConfirmedParticipants(withGuests.result, withGuests.confirmed ?? []),
              }
            : withGuests;
        });

        set({
          matches: matchesWithGuests,
          players: mappedPlayers,
          // Si el grupo tiene reglas guardadas en Supabase, las usamos
          // (mezcladas con los defaults por si falta algún campo).
          ...(dbRules ? { rules: { ...defaultRules, ...dbRules } } : {}),
        });
      },
    }),
    {
      name: "picado-store-v3", // Bumped store name to prevent local cache conflicts
      // Solo persistimos la sesión de admin. matches/players/rules son datos
      // del servidor: deben venir siempre frescos de Supabase vía
      // loadFromDatabase(), nunca del localStorage de cada navegador (eso
      // mostraba datos viejos como si los cambios no se hubieran hecho).
      partialize: (state) => ({
        isAdmin: state.isAdmin,
        adminRole: state.adminRole,
        adminSource: state.adminSource,
        adminPlayerId: state.adminPlayerId,
      }),
    },
  ),
);

export type BadgeType = "racha" | "muralla" | "asistidor" | "asistencia" | "mvp" | "roto";

export type PlayerBadge = {
  type: BadgeType;
  label: string;
  icon: string;
  tooltip: string;
};

export type PlayerPoints = {
  player: Player;
  attended: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  assists: number;
  mvps: number;
  goalsOfTheDay: number;
  points: number;
  badges: PlayerBadge[];
  absences?: number;
  bestPartner?: { player: Player; winRate: number; matches: number };
  nemesis?: { player: Player; winRate: number; matches: number };
};

export function computeRanking(
  matches: StoredMatch[],
  rules: ScoringRules,
  storePlayers: Player[],
): PlayerPoints[] {
  const map: Record<string, PlayerPoints & { absences: number; streak: number }> =
    Object.fromEntries(
      storePlayers.map((p) => [
        p.id,
        {
          player: p,
          attended: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goals: 0,
          assists: 0,
          mvps: 0,
          goalsOfTheDay: 0,
          points: 0,
          absences: 0,
          streak: 0,
          badges: [],
        },
      ]),
    );

  // 1. Calcular estadísticas básicas y ausencias
  for (const m of matches) {
    if (!m.played || !m.result) continue;
    if (m.matchType === "fecha_fifa") continue;
    const { scoreA, scoreB, teamA, teamB, stats } = m.result;
    const aWon = scoreA > scoreB;
    const bWon = scoreB > scoreA;
    const drew = scoreA === scoreB;

    // Verificar quién se anotó pero no asistió
    const registeredIds = new Set([...(m.confirmed ?? []), ...(m.waitlist ?? [])]);
    for (const pid of registeredIds) {
      const s = stats[pid];
      if (s && !s.attended) {
        const row = map[pid];
        if (row) row.absences += 1;
      }
    }

    for (const [pid, s] of Object.entries(stats)) {
      if (!s.attended) continue;
      const inA = teamA.includes(pid);
      const inB = teamB.includes(pid);
      // Solo cuenta como que jugó si está en alguno de los dos equipos.
      // Evita contar stats residuales de jugadores que quedaron en el JSON
      // sin estar realmente en la planilla del partido.
      if (!inA && !inB) continue;
      const row = map[pid];
      if (!row) continue;
      row.attended += 1;
      row.goals += s.goals;
      row.assists += s.assists;
      if (s.mvp) row.mvps += 1;
      if (s.golVote) row.goalsOfTheDay += 1;
      if (inA && aWon) row.wins += 1;
      else if (inB && bWon) row.wins += 1;
      else if (drew) row.draws += 1;
      else row.losses += 1;

      row.points +=
        rules.attendance + (s.mvp ? rules.mvp : 0) + (s.golVote ? rules.goalOfTheDay : 0);
    }
    // win/draw/loss points
    for (const pid of teamA) {
      const row = map[pid];
      if (!row || !stats[pid]?.attended) continue;
      row.points += aWon ? rules.win : drew ? rules.draw : rules.loss;
    }
    for (const pid of teamB) {
      const row = map[pid];
      if (!row || !stats[pid]?.attended) continue;
      row.points += bWon ? rules.win : drew ? rules.draw : rules.loss;
    }
  }

  // 2. Calcular rachas goleadoras consecutivas
  const sortedMatches = [...matches]
    .filter((m) => m.played && m.result && m.matchType !== "fecha_fifa")
    .sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime());

  for (const p of storePlayers) {
    let currentStreak = 0;
    for (const m of sortedMatches) {
      const s = m.result?.stats[p.id];
      if (s && s.attended) {
        if (s.goals > 0) {
          currentStreak += 1;
        } else {
          currentStreak = 0;
        }
      }
    }
    const row = map[p.id];
    if (row) row.streak = currentStreak;
  }

  const rows = Object.values(map);

  // 3. Obtener máximos para otorgar insignias
  const activeRows = rows.filter((r) => r.attended > 0);
  const maxAssists = activeRows.length ? Math.max(...activeRows.map((r) => r.assists)) : 0;
  const maxMvps = activeRows.length ? Math.max(...activeRows.map((r) => r.mvps)) : 0;
  const maxAttended = activeRows.length ? Math.max(...activeRows.map((r) => r.attended)) : 0;
  const maxAbsences = rows.length ? Math.max(...rows.map((r) => r.absences)) : 0;

  // Muralla defensiva (GK / DEF con al menos 3 PJ y mejor win rate)
  const defenders = activeRows.filter(
    (r) => (r.player.position === "ARQ" || r.player.position === "DEF") && r.attended >= 3,
  );
  const maxWinRate = defenders.length ? Math.max(...defenders.map((r) => r.wins / r.attended)) : 0;

  // 4. Asignar insignias
  for (const r of rows) {
    const badges: PlayerBadge[] = [];

    // Streak
    if (r.streak >= 2) {
      badges.push({
        type: "racha",
        label: "En Racha",
        icon: "🔥",
        tooltip: `Goleador en racha: ha marcado goles en sus últimos ${r.streak} partidos jugados consecutivos.`,
      });
    }

    // Muralla
    if (
      (r.player.position === "ARQ" || r.player.position === "DEF") &&
      r.attended >= 3 &&
      r.wins / r.attended === maxWinRate &&
      maxWinRate > 0
    ) {
      badges.push({
        type: "muralla",
        label: "La Muralla",
        icon: "🛡️",
        tooltip: `La Muralla: Defensor/Arquero con mejor tasa de victorias de la liga (${Math.round((r.wins / r.attended) * 100)}%).`,
      });
    }

    // Asistidor
    if (r.assists === maxAssists && maxAssists > 0) {
      badges.push({
        type: "asistidor",
        label: "Asistidor de Oro",
        icon: "🎯",
        tooltip: `Asistidor de Oro: Máximo asistidor de la temporada con ${r.assists} asistencias.`,
      });
    }

    // MVP
    if (r.mvps === maxMvps && maxMvps > 0) {
      badges.push({
        type: "mvp",
        label: "Rey del MVP",
        icon: "👑",
        tooltip: `Rey del MVP: Jugador con más premios MVP acumulados (${r.mvps} MVPs).`,
      });
    }

    // Asistencia Perfecta
    if (r.attended === maxAttended && maxAttended > 0) {
      badges.push({
        type: "asistencia",
        label: "Asistencia Perfecta",
        icon: "🚌",
        tooltip: `Asistencia Perfecta: Mayor cantidad de partidos jugados de la temporada (${r.attended} partidos).`,
      });
    }

    // El Roto (Faltazo)
    if (r.absences === maxAbsences && maxAbsences > 0) {
      badges.push({
        type: "roto",
        label: "Faltazo",
        icon: "🩹",
        tooltip: `El Roto: Mayor cantidad de ausencias sin dar de baja en el plantel (${r.absences} faltazos).`,
      });
    }

    r.badges = badges;
  }

  // 5. Calcular Química de Duplas (Best Partner y Nemesis)
  const teammateStats: Record<string, Record<string, { played: number; won: number }>> = {};
  const opponentStats: Record<string, Record<string, { played: number; won: number }>> = {};
  for (const p1 of storePlayers) {
    teammateStats[p1.id] = {};
    opponentStats[p1.id] = {};
    for (const p2 of storePlayers) {
      if (p1.id !== p2.id) {
        teammateStats[p1.id][p2.id] = { played: 0, won: 0 };
        opponentStats[p1.id][p2.id] = { played: 0, won: 0 };
      }
    }
  }

  for (const m of sortedMatches) {
    if (!m.result) continue;
    const { teamA, teamB, scoreA, scoreB, stats } = m.result;
    const aWon = scoreA > scoreB;
    const bWon = scoreB > scoreA;

    const activeA = teamA.filter((pid) => stats[pid]?.attended);
    const activeB = teamB.filter((pid) => stats[pid]?.attended);

    for (const p1 of activeA) {
      for (const p2 of activeA) {
        if (p1 !== p2 && teammateStats[p1]?.[p2]) {
          teammateStats[p1][p2].played += 1;
          if (aWon) teammateStats[p1][p2].won += 1;
        }
      }
    }

    for (const p1 of activeB) {
      for (const p2 of activeB) {
        if (p1 !== p2 && teammateStats[p1]?.[p2]) {
          teammateStats[p1][p2].played += 1;
          if (bWon) teammateStats[p1][p2].won += 1;
        }
      }
    }

    for (const p1 of activeA) {
      for (const rival of activeB) {
        if (opponentStats[p1]?.[rival]) {
          opponentStats[p1][rival].played += 1;
          if (aWon) opponentStats[p1][rival].won += 1;
        }
        if (opponentStats[rival]?.[p1]) {
          opponentStats[rival][p1].played += 1;
          if (bWon) opponentStats[rival][p1].won += 1;
        }
      }
    }
  }

  for (const p of storePlayers) {
    const teammateRows = teammateStats[p.id];
    const opponentRows = opponentStats[p.id];
    if (!teammateRows || !opponentRows) continue;

    let bestP: Player | undefined = undefined;
    let bestWR = -1;
    let bestMatches = 0;

    let nemesisP: Player | undefined = undefined;
    let nemesisWR = 2;
    let nemesisMatches = 0;

    // Primer pasada: mínimo 2 partidos juntos
    for (const [qId, s] of Object.entries(teammateRows)) {
      if (s.played >= 2) {
        const wr = s.won / s.played;
        if (wr > bestWR || (wr === bestWR && s.played > bestMatches)) {
          bestWR = wr;
          bestMatches = s.played;
          bestP = storePlayers.find((pl) => pl.id === qId);
        }
      }
    }

    for (const [qId, s] of Object.entries(opponentRows)) {
      if (s.played >= 2) {
        const wr = s.won / s.played;
        if (wr < nemesisWR || (wr === nemesisWR && s.played > nemesisMatches)) {
          nemesisWR = wr;
          nemesisMatches = s.played;
          nemesisP = storePlayers.find((pl) => pl.id === qId);
        }
      }
    }

    // Segunda pasada: si no se encontró compañero con >= 2 partidos, fallback a >= 1
    if (!bestP) {
      for (const [qId, s] of Object.entries(teammateRows)) {
        if (s.played === 1) {
          const wr = s.won / s.played;
          if (!bestP && (wr > bestWR || (wr === bestWR && s.played > bestMatches))) {
            bestWR = wr;
            bestMatches = s.played;
            bestP = storePlayers.find((pl) => pl.id === qId);
          }
        }
      }
    }

    if (!nemesisP) {
      for (const [qId, s] of Object.entries(opponentRows)) {
        if (s.played === 1) {
          const wr = s.won / s.played;
          if (wr < nemesisWR || (wr === nemesisWR && s.played > nemesisMatches)) {
            nemesisWR = wr;
            nemesisMatches = s.played;
            nemesisP = storePlayers.find((pl) => pl.id === qId);
          }
        }
      }
    }

    const row = map[p.id];
    if (row) {
      if (bestP && bestMatches > 0) {
        row.bestPartner = {
          player: bestP,
          winRate: Math.round(bestWR * 100),
          matches: bestMatches,
        };
      }
      if (nemesisP && nemesisMatches > 0 && nemesisWR < 1) {
        row.nemesis = {
          player: nemesisP,
          winRate: Math.round(nemesisWR * 100),
          matches: nemesisMatches,
        };
      }
    }
  }

  return Object.values(map).sort(
    (a, b) => b.points - a.points || b.goals - a.goals,
  );
}
