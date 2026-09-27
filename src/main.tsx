// KILL SWITCH: Force mobile browser to clear old service workers and purge caches
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  const killedFlag = "duogo_sw_purge_v101";
  if (!localStorage.getItem(killedFlag)) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      for (const registration of registrations) {
        registration.unregister();
        console.log("Old Service Worker unregistered:", registration);
      }
    });
    if ("caches" in window) {
      caches.keys().then((keys) => {
        for (const k of keys) {
          caches.delete(k);
        }
      });
    }
    // Clear any stale cached VAPID tokens
    try {
      localStorage.removeItem("duogo_cached_vapid_key");
      sessionStorage.clear();
    } catch {}
    localStorage.setItem(killedFlag, "true");
  }
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Automatically catch stale chunks when a new deployment is pushed to production
window.addEventListener("vite:preloadError", (event) => {
  console.warn("[Vite] Stale chunk detected after deployment, reloading latest version...", event);
  try {
    const key = "duogo_vite_preload_timestamp";
    const lastReload = sessionStorage.getItem(key);
    const now = Date.now();
    if (!lastReload || now - Number(lastReload) > 12000) {
      sessionStorage.setItem(key, String(now));
      window.location.reload();
    }
  } catch {
    // If storage is restricted, avoid unhandled errors
  }
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
