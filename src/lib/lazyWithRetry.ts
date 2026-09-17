import { ComponentType, lazy } from "react";

/**
 * Enhanced React.lazy wrapper that attempts a single auto-refresh if a dynamic
 * chunk fails to load due to a deployment hash change.
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
        try {
          const reloadKey = `duogo_reload_${window.location.pathname}`;
          const alreadyAttempted = sessionStorage.getItem(reloadKey);
          if (!alreadyAttempted) {
            sessionStorage.setItem(reloadKey, "true");
            console.warn("[duogo] Dynamic chunk failed, refreshing page once...");
            window.location.reload();
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
