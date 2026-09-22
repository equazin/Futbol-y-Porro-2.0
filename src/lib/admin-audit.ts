import { supabase } from "./supabase";

type AdminActor = {
  playerId: string | null;
  source: string; // "pin" | "dni" | "unknown"
};

let currentActor: AdminActor = { playerId: null, source: "unknown" };

export function setAdminActor(actor: AdminActor | null) {
  currentActor = actor ?? { playerId: null, source: "unknown" };
}

export function getAdminActor(): AdminActor {
  return currentActor;
}

export type AdminAuditLog = {
  id: string;
  admin_player_id: string | null;
  admin_nombre: string | null;
  admin_apodo: string | null;
  admin_source: string;
  accion: string;
  target_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

// Fire-and-forget: nunca lanza. Si falla se loguea en consola.
export function logAdminAction(
  accion: string,
  target_id?: string | null,
  payload?: Record<string, unknown>,
): void {
  const actor = getAdminActor();
  void supabase
    .rpc("picado_admin_log", {
      p_admin_player_id: actor.playerId,
      p_admin_source: actor.source,
      p_accion: accion,
      p_target_id: target_id ?? null,
      p_payload: payload ?? {},
    })
    .then(({ error }) => {
      if (error) console.warn("[audit] no se pudo registrar accion", accion, error.message);
    });
}

export async function listAdminLogs(limit = 200): Promise<AdminAuditLog[]> {
  const { data, error } = await supabase.rpc("picado_admin_list_logs", { p_limit: limit });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminAuditLog[];
}
