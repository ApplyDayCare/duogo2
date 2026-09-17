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
      const module = await factory();
      // On success, clear any previous retry flags for this path
      try {
        sessionStorage.removeItem(`duogo_reloaded_${window.location.pathname}`);
      } catch {
        // ignore storage errors
      }
      return module;
    } catch (error: any) {
      const msg = error?.message || "";
      const isDynamicImportError =
        msg.includes("Failed to fetch dynamically imported module") ||
        msg.includes("dynamically imported module") ||
        msg.includes("Loading chunk") ||
        msg.includes("Failed to load module script");

      if (isDynamicImportError) {
        const storageKey = `duogo_reloaded_${window.location.pathname}`;
        const alreadyAttempted = sessionStorage.getItem(storageKey);
        if (!alreadyAttempted) {
          sessionStorage.setItem(storageKey, "true");
          console.warn("[duogo] Dynamic import chunk failed. Reloading with cache-busting to get latest deployed assets...");
          const url = new URL(window.location.href);
          url.searchParams.set("_v", String(Date.now()));
          window.location.replace(url.toString());
          // Return a hanging promise while browser executes the page reload
          return new Promise<{ default: T }>(() => {});
        }
      }
      throw error;
    }
  });
}
