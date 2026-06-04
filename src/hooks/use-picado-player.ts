import { useCallback, useSyncExternalStore } from "react";
import type { StoredPlayer } from "@/types/picado";

const STORAGE_KEY = "picado_player_v2";
const LEGACY_STORAGE_KEY = "picado_player_v1";

const listeners = new Set<() => void>();

function isStoredPlayer(value: unknown): value is StoredPlayer {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoredPlayer>;
  return typeof candidate.player_id === "string" && typeof candidate.nombre === "string";
}

function readStorage(): StoredPlayer | null {
  if (typeof window === "undefined") return null;

  for (const key of [STORAGE_KEY, LEGACY_STORAGE_KEY]) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      if (isStoredPlayer(parsed)) return parsed;
    } catch {
      window.localStorage.removeItem(key);
    }
  }

  return null;
}

function emitChange() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === LEGACY_STORAGE_KEY) listener();
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }

  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function save(player: StoredPlayer) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(player));
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  emitChange();
}

function clearStoredPlayer() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  emitChange();
}

// Remembers the verified player between visits. The DNI is never stored.
export function usePicadoPlayer() {
  const stored = useSyncExternalStore(subscribe, readStorage, () => null);

  const remember = useCallback((player: StoredPlayer) => {
    save(player);
  }, []);

  const clear = useCallback(() => {
    clearStoredPlayer();
  }, []);

  return { stored, remember, clear };
}
