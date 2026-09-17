import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Automatically catch stale chunks when a new deployment is pushed to production
window.addEventListener("vite:preloadError", (event) => {
  console.warn("[Vite] Stale chunk detected after deployment, reloading latest version...", event);
  const key = "duogo_vite_preload_timestamp";
  const lastReload = sessionStorage.getItem(key);
  const now = Date.now();
  if (!lastReload || now - Number(lastReload) > 8000) {
    sessionStorage.setItem(key, String(now));
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
