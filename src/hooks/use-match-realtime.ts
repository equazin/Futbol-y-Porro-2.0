import { createClient } from "@supabase/supabase-js";
import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useStore } from "@/store/match-store";

// Singleton del cliente browser para Realtime.
// Inicialización lazy — solo se instancia la primera vez que corre en el browser.
// Importar @supabase/supabase-js es seguro en el server bundle (paquete isomórfico);
// la instancia del cliente se crea solo dentro de useEffect (browser-only).
let _browserClient: ReturnType<typeof createClient> | null = null;

// Fallbacks iguales a los de src/lib/supabase.ts: si faltan las env vars
// (p. ej. secrets no configurados en el build), createClient recibiría
// `undefined` y lanzaría "supabaseUrl is required", tumbando toda la página.
const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string) || "https://placeholder.supabase.co";
const SUPABASE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || "placeholder-key";

function getBrowserClient() {
  if (!_browserClient) {
    _browserClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      realtime: { params: { eventsPerSecond: 5 } },
      auth: { persistSession: false },
    });
  }
  return _browserClient;
}

// Suscribe a cambios en picado_signups para un partido específico.
// Cuando alguien se anota o se baja, invalida el loader del router
// para que todos los dispositivos vean la lista actualizada sin recargar.
export function useMatchRealtime(matchId: string, onChange?: () => void | Promise<void>) {
  const router = useRouter();
  const loadFromDatabase = useStore((s) => s.loadFromDatabase);

  useEffect(() => {
    if (!matchId) return;

    const sb = getBrowserClient();
    const refresh = () => {
      const refreshStore = onChange ?? loadFromDatabase;
      void Promise.all([Promise.resolve(refreshStore()), router.invalidate()]);
    };

    const channel = sb
      .channel(`picado-match-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "picado_signups",
          filter: `match_id=eq.${matchId}`,
        },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "picado_matches",
          filter: `id=eq.${matchId}`,
        },
        refresh,
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [loadFromDatabase, matchId, onChange, router]);
}
