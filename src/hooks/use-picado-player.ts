import { useState, useCallback } from "react";
import type { StoredPlayer } from "@/types/picado";

const STORAGE_KEY = "picado_player_v1";

function load(): StoredPlayer | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredPlayer) : null;
  } catch {
    return null;
  }
}

function save(p: StoredPlayer) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

// Recuerda qué jugador soy entre visitas (player_id + nombre).
// El DNI NUNCA se almacena — solo el player_id resultado de la autenticación.
export function usePicadoPlayer() {
  const [stored, setStored] = useState<StoredPlayer | null>(() => load());

  const remember = useCallback((player: StoredPlayer) => {
    save(player);
    setStored(player);
  }, []);

  return { stored, remember };
}
