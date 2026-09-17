import { ComponentType, lazy } from "react";

/**
 * Enhanced React.lazy wrapper that automatically catches Vite / Webpack dynamic import
 * chunk errors (e.g. when a new build is deployed and old hashes are invalidated on the server).
 * Automatically reloads the latest HTML bundle once to grab fresh chunk URLs.
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
        msg.includes("Failed to load module script");

      if (isDynamicImportError) {
        const key = "duogo_chunk_reload_timestamp";
        const lastReload = sessionStorage.getItem(key);
        const now = Date.now();
        // Prevent infinite reload loops: allow reload if at least 8 seconds have passed
        if (!lastReload || now - Number(lastReload) > 8000) {
          sessionStorage.setItem(key, String(now));
          console.warn("[duogo] Dynamic import chunk failed. Reloading to get latest deployed assets...");
          window.location.reload();
          // Return a hanging promise while browser executes the page reload
          return new Promise<{ default: T }>(() => {});
        }
      }
      throw error;
    }
  });
}
