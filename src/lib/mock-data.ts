export type Position = "ARQ" | "DEF" | "MED" | "DEL";

export type Player = {
  id: string;
  name: string;
  nickname: string;
  position: Position;
  rating: number;
  goals: number;
  played: number;
  initials: string;
  color: string;
};

export type MatchStatus = "open" | "full" | "closed";

export type Match = {
  id: string;
  date: string; // ISO
  venue: string;
  format: "5v5" | "7v7" | "8v8";
  capacity: number;
  confirmed: string[]; // player ids
  waitlist: string[];
  status: MatchStatus;
  closesAt: string; // ISO
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

const raw: Omit<Player, "initials" | "color">[] = [
  { id: "p1", name: "Lionel Fernández", nickname: "Leo", position: "DEL", rating: 92, goals: 14, played: 12 },
  { id: "p2", name: "Diego Romero", nickname: "Dieguito", position: "MED", rating: 88, goals: 8, played: 11 },
  { id: "p3", name: "Martín Acosta", nickname: "Tincho", position: "DEF", rating: 84, goals: 1, played: 13 },
  { id: "p4", name: "Sergio Pereyra", nickname: "Checho", position: "ARQ", rating: 90, goals: 0, played: 12 },
  { id: "p5", name: "Juan Pablo Ortiz", nickname: "JP", position: "MED", rating: 86, goals: 6, played: 10 },
  { id: "p6", name: "Nicolás Vega", nickname: "Nico", position: "DEL", rating: 83, goals: 9, played: 9 },
  { id: "p7", name: "Federico Luna", nickname: "Fede", position: "DEF", rating: 80, goals: 2, played: 11 },
  { id: "p8", name: "Matías Sosa", nickname: "Matu", position: "MED", rating: 79, goals: 4, played: 8 },
  { id: "p9", name: "Tomás Ríos", nickname: "Tomi", position: "DEL", rating: 78, goals: 7, played: 9 },
  { id: "p10", name: "Ezequiel Paz", nickname: "Eze", position: "DEF", rating: 77, goals: 1, played: 10 },
  { id: "p11", name: "Lucas Méndez", nickname: "Luca", position: "MED", rating: 75, goals: 3, played: 7 },
  { id: "p12", name: "Bruno Castro", nickname: "Bruno", position: "ARQ", rating: 81, goals: 0, played: 8 },
  { id: "p13", name: "Iván Molina", nickname: "Ivancho", position: "DEL", rating: 74, goals: 5, played: 8 },
  { id: "p14", name: "Gonzalo Ayala", nickname: "Gonza", position: "DEF", rating: 73, goals: 0, played: 7 },
  { id: "p15", name: "Ramiro Suárez", nickname: "Rami", position: "MED", rating: 72, goals: 2, played: 6 },
  { id: "p16", name: "Pablo Herrera", nickname: "Pablito", position: "DEL", rating: 70, goals: 3, played: 6 },
];

export const players: Player[] = raw.map((p, i) => ({
  ...p,
  initials: p.nickname.slice(0, 2).toUpperCase(),
  color: colors[i % colors.length],
}));

function inHours(h: number) {
  return new Date(Date.now() + h * 3600 * 1000).toISOString();
}

export const matches: Match[] = [
  {
    id: "m1",
    date: inHours(28),
    venue: "Complejo La Bombonerita — Cancha 3",
    format: "7v7",
    capacity: 14,
    confirmed: ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10", "p11"],
    waitlist: ["p12"],
    status: "open",
    closesAt: inHours(20),
  },
  {
    id: "m2",
    date: inHours(76),
    venue: "Club Estrella del Sur",
    format: "5v5",
    capacity: 10,
    confirmed: ["p1", "p4", "p5", "p9", "p13", "p15"],
    waitlist: [],
    status: "open",
    closesAt: inHours(68),
  },
  {
    id: "m3",
    date: inHours(124),
    venue: "Polideportivo Norte",
    format: "8v8",
    capacity: 16,
    confirmed: ["p2", "p3", "p6", "p7", "p8", "p10", "p11", "p12", "p14", "p16"],
    waitlist: ["p13", "p15"],
    status: "open",
    closesAt: inHours(116),
  },
  {
    id: "m4",
    date: inHours(-48),
    venue: "Complejo La Bombonerita — Cancha 1",
    format: "7v7",
    capacity: 14,
    confirmed: players.slice(0, 14).map((p) => p.id),
    waitlist: [],
    status: "closed",
    closesAt: inHours(-56),
  },
];

export function playerById(id: string) {
  return players.find((p) => p.id === id);
}

export const ranking = [...players].sort((a, b) => b.rating - a.rating);
