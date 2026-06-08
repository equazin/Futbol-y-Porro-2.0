export type PicadoEstado = "programado" | "abierto" | "cerrado" | "jugado" | "cancelado";
export type SignupEstado = "titular" | "espera" | "baja";
export type PicadoAdminRole = "general" | "equipos" | "fondo";
export type PicadoMatchType = "oficial" | "fecha_fifa";

export type PicadoGroup = {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
};

// Movimiento del fondo común (libro de caja).
export type FondoMovimiento = {
  id: string;
  group_id?: string;
  tipo: "ingreso" | "egreso";
  concepto: string;
  monto: number; // siempre positivo; el signo lo da `tipo`
  fecha: string; // ISO date "2026-06-07"
  created_at?: string;
};

// Regla de recurrencia: genera partidos automáticamente cada semana.
export type PicadoRecurrence = {
  id: string;
  group_id: string;
  dia_semana: number; // 0=domingo ... 6=sábado
  hora: string; // "20:00:00"
  sede: string;
  formato: string;
  match_type: PicadoMatchType;
  cupo_max: number;
  abre_dias_antes: number;
  cierra_horas_antes: number;
  semanas_anticipacion: number;
  activa: boolean;
  created_at?: string;
};

// Player from the shared 'players' table (same as the main app)
export type ExistingPlayer = {
  id: string;
  nombre: string;
  apodo: string | null;
  posicion: "arquero" | "defensor" | "mediocampista" | "delantero" | null;
  foto_url: string | null;
  activo: boolean;
  elo: number;
  tipo: string;
};

export type PicadoMatch = {
  id: string;
  group_id: string;
  fecha: string;
  hora: string;
  sede: string;
  formato: string;
  match_type?: PicadoMatchType | null;
  cupo_max: number;
  estado: PicadoEstado;
  inscripcion_abre: string | null;
  inscripcion_cierra: string | null;
  created_at: string;
  notas?: string | null;
};

export type PicadoSignup = {
  id: string;
  match_id: string;
  player_id: string;
  estado: SignupEstado;
  orden: number;
  created_at: string;
};

// Signup with player data joined from 'players' table
export type SignupWithPlayer = PicadoSignup & {
  players: Pick<ExistingPlayer, "id" | "nombre" | "apodo" | "posicion">;
};

// ── Voting ─────────────────────────────────────────────────

export type MatchVote = {
  voter_id: string;
  mvp_vote: string; // player_id
  gol_vote: string; // player_id
};

export type VoteResult = {
  player_id: string;
  nombre: string;
  votos: number;
};

export type MatchVotesSummary = {
  votes: MatchVote[];
  mvpWinner?: VoteResult; // computed from votes, set on close
  golWinner?: VoteResult; // computed from votes, set on close
  mvpResult?: string; // player_id of confirmed winner
  golResult?: string; // player_id of confirmed winner
};

// ── Match Detail ────────────────────────────────────────────

export type MatchDetailData = {
  match: PicadoMatch;
  titulares: SignupWithPlayer[];
  espera: SignupWithPlayer[];
  result?: import("../store/match-store").MatchResult | null;
};

export type AnotarseResult = {
  ok: boolean;
  message: string;
  estado?: SignupEstado;
  orden?: number;
  player_id?: string;
  nombre?: string;
};

export type VotoResult = {
  ok: boolean;
  message: string;
  player_id?: string;
  nombre?: string;
};

export type IdentificarJugadorResult = {
  ok: boolean;
  message: string;
  player_id?: string;
  nombre?: string;
  apodo?: string | null;
  posicion?: ExistingPlayer["posicion"];
  foto_url?: string | null;
  elo?: number;
  admin_role?: PicadoAdminRole | null;
};

// Stored in localStorage — only player_id and name, NEVER the DNI
export type StoredPlayer = {
  player_id: string;
  nombre: string;
  apodo?: string | null;
  posicion?: ExistingPlayer["posicion"];
  foto_url?: string | null;
  elo?: number;
  admin_role?: PicadoAdminRole | null;
};
