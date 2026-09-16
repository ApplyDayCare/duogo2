import { get, set, del } from "idb-keyval";
import { Persister, AsyncPersister } from "@tanstack/react-query-persist-client";

const IDB_KEY = "DUOGO_REACT_QUERY_OFFLINE_CACHE_V1";

/**
 * Creates an IndexedDB-backed persister for TanStack React Query.
 * This stores the query cache safely across app launches and offline sessions.
 */
export function createIDBPersister(idbKey: string = IDB_KEY): AsyncPersister {
  return {
    persistClient: async (persistClient) => {
      try {
        await set(idbKey, persistClient);
      } catch (error) {
        console.warn("[QueryPersist] Failed to save cache to IndexedDB:", error);
      }
    },
    restoreClient: async () => {
      try {
        const cached = await get(idbKey);
        return cached;
      } catch (error) {
        console.warn("[QueryPersist] Failed to restore cache from IndexedDB:", error);
        return undefined;
      }
    },
    removeClient: async () => {
      try {
        await del(idbKey);
      } catch (error) {
        console.warn("[QueryPersist] Failed to remove cache from IndexedDB:", error);
      }
    },
  };
}

export const idbPersister = createIDBPersister();

// Direct IndexedDB storage helpers for critical offline entities (profile & matches)
const PROFILE_CACHE_KEY_PREFIX = "duogo_offline_profile_";
const MATCHES_CACHE_KEY_PREFIX = "duogo_offline_matches_";

export async function saveOfflineProfile(userId: string, profile: any): Promise<void> {
  if (!userId || !profile) return;
  try {
    await set(`${PROFILE_CACHE_KEY_PREFIX}${userId}`, {
      profile,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.warn("[OfflineCache] Failed to save profile to IDB:", err);
  }
}

export async function getOfflineProfile(userId: string): Promise<any | null> {
  if (!userId) return null;
  try {
    const data = await get(`${PROFILE_CACHE_KEY_PREFIX}${userId}`);
    return data?.profile ?? null;
  } catch (err) {
    console.warn("[OfflineCache] Failed to read profile from IDB:", err);
    return null;
  }
}

export async function saveOfflineMatches(userId: string, matchesResult: any): Promise<void> {
  if (!userId || !matchesResult) return;
  try {
    await set(`${MATCHES_CACHE_KEY_PREFIX}${userId}`, {
      data: matchesResult,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.warn("[OfflineCache] Failed to save matches to IDB:", err);
  }
}

export async function getOfflineMatches(userId: string): Promise<any | null> {
  if (!userId) return null;
  try {
    const cached = await get(`${MATCHES_CACHE_KEY_PREFIX}${userId}`);
    return cached?.data ?? null;
  } catch (err) {
    console.warn("[OfflineCache] Failed to read matches from IDB:", err);
    return null;
  }
}
