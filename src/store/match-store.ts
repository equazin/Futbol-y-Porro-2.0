import { create } from "zustand";
import { persist } from "zustand/middleware";
import { matches as seedMatches, players, type Match, type Player } from "@/lib/mock-data";

export type PlayerStats = {
  attended: boolean;
  goals: number;
  assists: number;
  mvp: boolean;
};

export type MatchResult = {
  scoreA: number;
  scoreB: number;
  teamA: string[];
  teamB: string[];
  stats: Record<string, PlayerStats>;
};

export type StoredMatch = Match & {
  result?: MatchResult;
  played?: boolean;
};

export type ScoringRules = {
  attendance: number;
  win: number;
  draw: number;
  loss: number;
  goal: number;
  assist: number;
  mvp: number;
};

export const defaultRules: ScoringRules = {
  attendance: 1,
  win: 3,
  draw: 1,
  loss: 0,
  goal: 2,
  assist: 1,
  mvp: 5,
};

type State = {
  matches: StoredMatch[];
  rules: ScoringRules;
};

type Actions = {
  setTeams: (matchId: string, teamA: string[], teamB: string[]) => void;
  balanceTeams: (matchId: string) => void;
  setStat: (matchId: string, playerId: string, patch: Partial<PlayerStats>) => void;
  setScore: (matchId: string, scoreA: number, scoreB: number) => void;
  setMvp: (matchId: string, playerId: string | null) => void;
  closeMatch: (matchId: string) => void;
  reopenMatch: (matchId: string) => void;
  updateRules: (patch: Partial<ScoringRules>) => void;
  resetRules: () => void;
};

function initialResult(m: Match): MatchResult {
  const half = Math.ceil(m.confirmed.length / 2);
  return {
    scoreA: 0,
    scoreB: 0,
    teamA: m.confirmed.slice(0, half),
    teamB: m.confirmed.slice(half),
    stats: Object.fromEntries(
      m.confirmed.map((id) => [id, { attended: true, goals: 0, assists: 0, mvp: false }]),
    ),
  };
}

function balance(ids: string[], playerMap: Record<string, Player>): [string[], string[]] {
  // Greedy partition by rating: sort desc, alternate while keeping a/b totals close.
  const sorted = [...ids].sort((a, b) => playerMap[b].rating - playerMap[a].rating);
  const a: string[] = [];
  const b: string[] = [];
  let sa = 0;
  let sb = 0;
  for (const id of sorted) {
    const r = playerMap[id].rating;
    if (sa <= sb) {
      a.push(id);
      sa += r;
    } else {
      b.push(id);
      sb += r;
    }
  }
  return [a, b];
}

export const playerMap: Record<string, Player> = Object.fromEntries(players.map((p) => [p.id, p]));

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
                  m.confirmed.map((id, i) => [
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

      setTeams: (matchId, teamA, teamB) =>
        set((s) => ({
          matches: s.matches.map((m) =>
            m.id !== matchId
              ? m
              : { ...m, result: { ...(m.result ?? initialResult(m)), teamA, teamB } },
          ),
        })),

      balanceTeams: (matchId) =>
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== matchId) return m;
            const [a, b] = balance(m.confirmed, playerMap);
            return { ...m, result: { ...(m.result ?? initialResult(m)), teamA: a, teamB: b } };
          }),
        })),

      setStat: (matchId, playerId, patch) =>
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== matchId) return m;
            const base = m.result ?? initialResult(m);
            const prev = base.stats[playerId] ?? { attended: true, goals: 0, assists: 0, mvp: false };
            return {
              ...m,
              result: {
                ...base,
                stats: { ...base.stats, [playerId]: { ...prev, ...patch } },
              },
            };
          }),
        })),

      setScore: (matchId, scoreA, scoreB) =>
        set((s) => ({
          matches: s.matches.map((m) =>
            m.id !== matchId
              ? m
              : { ...m, result: { ...(m.result ?? initialResult(m)), scoreA, scoreB } },
          ),
        })),

      setMvp: (matchId, playerId) =>
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== matchId) return m;
            const base = m.result ?? initialResult(m);
            const stats = { ...base.stats };
            for (const id of Object.keys(stats)) stats[id] = { ...stats[id], mvp: id === playerId };
            return { ...m, result: { ...base, stats } };
          }),
        })),

      closeMatch: (matchId) =>
        set((s) => ({
          matches: s.matches.map((m) =>
            m.id !== matchId ? m : { ...m, played: true, status: "closed" as const },
          ),
        })),

      reopenMatch: (matchId) =>
        set((s) => ({
          matches: s.matches.map((m) =>
            m.id !== matchId ? m : { ...m, played: false, status: "open" as const },
          ),
        })),

      updateRules: (patch) => set((s) => ({ rules: { ...s.rules, ...patch } })),
      resetRules: () => set({ rules: defaultRules }),
    }),
    { name: "picado-store-v1" },
  ),
);

export type PlayerPoints = {
  player: Player;
  attended: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  assists: number;
  mvps: number;
  points: number;
};

export function computeRanking(matches: StoredMatch[], rules: ScoringRules): PlayerPoints[] {
  const map: Record<string, PlayerPoints> = Object.fromEntries(
    players.map((p) => [
      p.id,
      { player: p, attended: 0, wins: 0, draws: 0, losses: 0, goals: 0, assists: 0, mvps: 0, points: 0 },
    ]),
  );
  for (const m of matches) {
    if (!m.played || !m.result) continue;
    const { scoreA, scoreB, teamA, teamB, stats } = m.result;
    const aWon = scoreA > scoreB;
    const bWon = scoreB > scoreA;
    const drew = scoreA === scoreB;
    for (const [pid, s] of Object.entries(stats)) {
      if (!s.attended) continue;
      const row = map[pid];
      if (!row) continue;
      row.attended += 1;
      row.goals += s.goals;
      row.assists += s.assists;
      if (s.mvp) row.mvps += 1;
      const inA = teamA.includes(pid);
      const inB = teamB.includes(pid);
      if (inA && aWon) row.wins += 1;
      else if (inB && bWon) row.wins += 1;
      else if ((inA || inB) && drew) row.draws += 1;
      else if (inA || inB) row.losses += 1;

      row.points +=
        rules.attendance +
        s.goals * rules.goal +
        s.assists * rules.assist +
        (s.mvp ? rules.mvp : 0);
    }
    // win/draw/loss points (loop again is fine)
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
  return Object.values(map).sort((a, b) => b.points - a.points || b.player.rating - a.player.rating);
}
