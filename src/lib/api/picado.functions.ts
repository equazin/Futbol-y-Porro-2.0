import { supabase } from "../supabase";
import type {
  MatchDetailData,
  PicadoMatch,
  AnotarseResult,
  VotoResult,
  IdentificarJugadorResult,
} from "@/types/picado";

const slug = () => import.meta.env.VITE_GROUP_SLUG || "fyp-fc";

// ── Jugador para la página Plantel ────────────────────────
export type JugadorRow = {
  id: string;
  nombre: string;
  apodo: string | null;
  posicion: string | null;
  foto_url: string | null;
  elo: number;
  tipo: string;
  partidos_jugados: number;
  goles: number;
};

// ── Fetch: lista de jugadores activos con stats ───────────
export const getJugadores = async (): Promise<JugadorRow[]> => {
  const { data, error } = await supabase
    .from("players")
    .select(
      "id, nombre, apodo, posicion, elo, foto_url, tipo, match_players(goles, presente, matches(estado))",
    )
    .eq("activo", true)
    .order("elo", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((p) => {
    const mps = (p.match_players ?? []) as Array<{
      goles: number;
      presente: boolean;
      matches: { estado: string } | null;
    }>;
    const cerrados = mps.filter((mp) => mp.matches?.estado === "cerrado");
    return {
      id: p.id,
      nombre: p.nombre,
      apodo: p.apodo,
      posicion: p.posicion,
      elo: p.elo ?? 1000,
      foto_url: p.foto_url,
      tipo: p.tipo ?? "titular",
      partidos_jugados: cerrados.filter((mp) => mp.presente).length,
      goles: cerrados.reduce((sum, mp) => sum + (mp.goles ?? 0), 0),
    };
  });
};

// ── Fetch: detalle de partido con inscripciones ───────────
export const getMatchDetail = async ({
  data,
}: {
  data: { id: string };
}): Promise<MatchDetailData | null> => {
  const { data: match, error: matchError } = await supabase
    .from("picado_matches")
    .select("*")
    .eq("id", data.id)
    .single();

  if (matchError || !match) return null;

  const { data: signups, error: signupsError } = await supabase
    .from("picado_signups")
    .select("*, players(id, nombre, apodo, posicion)")
    .eq("match_id", data.id)
    .in("estado", ["titular", "espera"])
    .order("orden", { ascending: true });

  if (signupsError) throw new Error(signupsError.message);

  const all = (signups ?? []) as unknown as MatchDetailData["titulares"];

  let result = null;
  if (match.notas) {
    try {
      result = JSON.parse(match.notas);
    } catch {
      // Non-JSON notes, ignore
    }
  }

  return {
    match: match as PicadoMatch,
    titulares: all.filter((s) => s.estado === "titular"),
    espera: all.filter((s) => s.estado === "espera"),
    result,
  };
};

// ── Mutation: anotarse via DNI ────────────────────────────
export const anotarse = async ({
  data,
}: {
  data: { dni: string; match_id: string };
}): Promise<AnotarseResult> => {
  const { data: result, error } = await supabase.rpc("anotarse", {
    p_dni: data.dni.trim(),
    p_match_id: data.match_id,
  });
  if (error) throw new Error(error.message);
  return result as AnotarseResult;
};

// ── Mutation: bajarse via DNI ─────────────────────────────
export const bajarse = async ({
  data,
}: {
  data: { dni: string; match_id: string };
}): Promise<AnotarseResult> => {
  const { data: result, error } = await supabase.rpc("bajarse", {
    p_dni: data.dni.trim(),
    p_match_id: data.match_id,
  });
  if (error) throw new Error(error.message);
  return result as AnotarseResult;
};

// ── Mutation: votar MVP y Gol de la Fecha via DNI ─────────
export const identificarJugador = async ({
  data,
}: {
  data: { dni: string };
}): Promise<IdentificarJugadorResult> => {
  const { data: result, error } = await supabase.rpc("picado_identificar_jugador", {
    p_dni: data.dni.trim(),
  });
  if (error) throw new Error(error.message);
  return result as IdentificarJugadorResult;
};

export const registrarVoto = async ({
  data,
}: {
  data: { dni: string; match_id: string; mvp_vote: string; gol_vote: string };
}): Promise<VotoResult> => {
  const { data: result, error } = await supabase.rpc("registrar_voto", {
    p_match_id: data.match_id,
    p_dni: data.dni.trim(),
    p_mvp_vote: data.mvp_vote,
    p_gol_vote: data.gol_vote,
  });
  if (error) throw new Error(error.message);
  return result as VotoResult;
};

// ── Admin Mutation: crear partido ────────────────────────
export const adminCreateMatch = async ({
  data,
}: {
  data: {
    fecha: string;
    hora: string;
    sede: string;
    formato: string;
    cupo_max: number;
    estado: string;
  };
}) => {
  const { data: group } = await supabase
    .from("picado_groups")
    .select("id")
    .eq("slug", slug())
    .single();

  if (!group) throw new Error("Grupo no encontrado");

  const { data: match, error } = await supabase
    .from("picado_matches")
    .insert({
      group_id: group.id,
      fecha: data.fecha,
      hora: data.hora,
      sede: data.sede,
      formato: data.formato,
      cupo_max: data.cupo_max,
      estado: data.estado,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return match;
};

// ── Admin Mutation: actualizar partido ────────────────────
export const adminUpdateMatch = async ({
  data,
}: {
  data: {
    id: string;
    patch: {
      fecha?: string;
      hora?: string;
      sede?: string;
      formato?: string;
      cupo_max?: number;
      estado?: string;
      notas?: string | null;
    };
  };
}) => {
  const { data: match, error } = await supabase
    .from("picado_matches")
    .update(data.patch)
    .eq("id", data.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return match;
};

// ── Admin Mutation: eliminar partido ──────────────────────
export const adminDeleteMatch = async ({ data }: { data: { id: string } }) => {
  const { error } = await supabase.from("picado_matches").delete().eq("id", data.id);

  if (error) throw new Error(error.message);
  return { ok: true };
};

// ── Admin Mutation: inscribir jugador manualmente ─────────
export const adminAddSignup = async ({
  data,
}: {
  data: { match_id: string; player_id: string; estado: "titular" | "espera" };
}) => {
  const { data: signups } = await supabase
    .from("picado_signups")
    .select("orden")
    .eq("match_id", data.match_id);
  const nextOrden = Math.max(...(signups ?? []).map((s) => s.orden), 0) + 1;

  const { data: signup, error } = await supabase
    .from("picado_signups")
    .insert({
      match_id: data.match_id,
      player_id: data.player_id,
      estado: data.estado,
      orden: nextOrden,
    })
    .select("*, players(id, nombre, apodo, posicion)")
    .single();

  if (error) throw new Error(error.message);
  return signup;
};

// ── Admin Mutation: remover inscripción manualmente ───────
export const adminRemoveSignup = async ({
  data,
}: {
  data: { match_id: string; player_id: string };
}) => {
  const { error } = await supabase
    .from("picado_signups")
    .delete()
    .eq("match_id", data.match_id)
    .eq("player_id", data.player_id);

  if (error) throw new Error(error.message);
  return { ok: true };
};

// ── Admin Mutation: crear jugador en el plantel ───────────
export const adminCreatePlayer = async ({
  data,
}: {
  data: {
    nombre: string;
    apodo: string | null;
    posicion: string | null;
    elo: number;
    foto_url: string | null;
    dni?: string | null;
  };
}) => {
  const { data: player, error } = await supabase.rpc("picado_admin_create_player", {
    p_nombre: data.nombre,
    p_apodo: data.apodo,
    p_posicion: data.posicion,
    p_elo: data.elo,
    p_foto_url: data.foto_url,
    p_dni: data.dni ?? null,
  });

  if (error) throw new Error(error.message);
  return player;
};

// ── Admin Mutation: actualizar jugador ────────────────────
export const adminUpdatePlayer = async ({
  data,
}: {
  data: {
    id: string;
    patch: {
      nombre?: string;
      apodo?: string | null;
      posicion?: string | null;
      elo?: number;
      foto_url?: string | null;
      dni?: string | null;
    };
  };
}) => {
  const { data: player, error } = await supabase.rpc("picado_admin_update_player", {
    p_id: data.id,
    p_nombre: data.patch.nombre ?? null,
    p_apodo: data.patch.apodo ?? null,
    p_posicion: data.patch.posicion ?? null,
    p_elo: data.patch.elo ?? null,
    p_foto_url: data.patch.foto_url ?? null,
    p_dni: data.patch.dni ?? null,
    p_update_dni: data.patch.dni !== undefined,
  });

  if (error) throw new Error(error.message);
  return player;
};

// ── Admin Mutation: eliminar/desactivar jugador ───────────
export const adminDeletePlayer = async ({ data }: { data: { id: string } }) => {
  const { data: player, error } = await supabase.rpc("picado_admin_delete_player", {
    p_id: data.id,
  });

  if (error) throw new Error(error.message);
  return player;
};

// ── Fetch: todos los partidos con sus inscripciones y resultados ──
export const getMatchesWithSignups = async ({ data }: { data: { slug: string } }) => {
  const { data: group } = await supabase
    .from("picado_groups")
    .select("id")
    .eq("slug", data.slug)
    .single();

  if (!group) return [];

  const { data: matches, error: matchesError } = await supabase
    .from("picado_matches")
    .select("*")
    .eq("group_id", group.id)
    .order("fecha", { ascending: false });

  if (matchesError) throw new Error(matchesError.message);

  const matchIds = (matches ?? []).map((m) => m.id);
  if (matchIds.length === 0) return [];

  const { data: signups, error: signupsError } = await supabase
    .from("picado_signups")
    .select("match_id, player_id, estado, orden")
    .in("match_id", matchIds)
    .in("estado", ["titular", "espera"])
    .order("orden", { ascending: true });

  if (signupsError) throw new Error(signupsError.message);

  return (matches ?? []).map((m) => {
    const matchSignups = (signups ?? []).filter((s) => s.match_id === m.id);
    const confirmed = matchSignups.filter((s) => s.estado === "titular").map((s) => s.player_id);
    const waitlist = matchSignups.filter((s) => s.estado === "espera").map((s) => s.player_id);

    let result: unknown = undefined;
    if (m.notes || m.notas) {
      try {
        result = JSON.parse(m.notas || m.notes || "");
      } catch {
        // Si no es JSON válido, es texto común
      }
    }

    const played = m.estado === "jugado" || m.estado === "cerrado";

    return {
      id: m.id,
      date: `${m.fecha}T${m.hora}`,
      venue: m.sede,
      format: m.formato,
      capacity: m.cupo_max,
      confirmed,
      waitlist,
      status:
        m.estado === "programado"
          ? "closed"
          : m.estado === "cerrado" || m.estado === "jugado"
            ? "closed"
            : "open",
      closesAt: m.inscripcion_cierra || `${m.fecha}T${m.hora}`,
      result,
      played,
      hora: m.hora,
      fecha: m.fecha,
      dbEstado: m.estado,
    };
  });
};
