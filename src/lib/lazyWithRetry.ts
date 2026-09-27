import { ComponentType, lazy } from "react";

/**
 * Enhanced React.lazy wrapper that attempts a cache-busting refresh if a dynamic
 * chunk fails to load due to a deployment hash update.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error: any) {
      const msg = error?.message || "";
      const isDynamicImportError =
        msg.includes("Failed to fetch dynamically imported module") ||
        msg.includes("dynamically imported module") ||
        msg.includes("Loading chunk") ||
        msg.includes("Failed to load module script") ||
        error?.name === "ChunkLoadError";

      if (isDynamicImportError) {
        try {
          const reloadKey = `duogo_last_chunk_retry`;
          const lastAttempt = sessionStorage.getItem(reloadKey);
          const now = Date.now();

          // Only auto-reload if not already attempted in the last 10 seconds
          if (!lastAttempt || now - parseInt(lastAttempt, 10) > 10000) {
            sessionStorage.setItem(reloadKey, now.toString());
            console.warn("[duogo] Stale dynamic chunk detected. Purging cache and reloading fresh bundle...");

            if ("caches" in window) {
              try {
                const keys = await caches.keys();
                await Promise.all(keys.map((k) => caches.delete(k)));
              } catch {}
            }

            const url = new URL(window.location.href);
            url.searchParams.set("_v", now.toString());
            window.location.replace(url.toString());
            return { default: (() => null) as unknown as T };
          }
        } catch {
          // ignore storage errors
        }
      }
      throw error;
    }
  });
}
