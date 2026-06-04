import { createClient } from "@supabase/supabase-js";
import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

// Singleton del cliente browser para Realtime.
// Inicialización lazy — solo se instancia la primera vez que corre en el browser.
// Importar @supabase/supabase-js es seguro en el server bundle (paquete isomórfico);
// la instancia del cliente se crea solo dentro de useEffect (browser-only).
let _browserClient: ReturnType<typeof createClient> | null = null;

function getBrowserClient() {
  if (!_browserClient) {
    _browserClient = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      {
        realtime: { params: { eventsPerSecond: 5 } },
        auth: { persistSession: false },
      },
    );
  }
  return _browserClient;
}

// Suscribe a cambios en picado_signups para un partido específico.
// Cuando alguien se anota o se baja, invalida el loader del router
// para que todos los dispositivos vean la lista actualizada sin recargar.
export function useMatchRealtime(matchId: string, onChange?: () => void) {
  const router = useRouter();

  useEffect(() => {
    if (!matchId) return;

    const sb = getBrowserClient();
    const refresh = () => {
      onChange?.();
      void router.invalidate();
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
  }, [matchId, onChange, router]);
}
