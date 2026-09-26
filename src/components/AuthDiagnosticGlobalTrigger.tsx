import { useState, useEffect } from "react";
import { AuthDiagnosticDialog } from "./AuthDiagnosticDialog";

export const AuthDiagnosticGlobalTrigger = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // 1. Check URL query param ?debug_auth=true
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("debug_auth") === "true") {
        setOpen(true);
      }

      // 2. Keyboard shortcut: Cmd/Ctrl + Shift + D
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "D" || e.key === "d")) {
          e.preventDefault();
          setOpen((prev) => !prev);
        }
      };

      // 3. Custom Event listener
      const handleCustomEvent = () => setOpen(true);

      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("duogo:open-auth-diagnostics", handleCustomEvent);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("duogo:open-auth-diagnostics", handleCustomEvent);
      };
    }
  }, []);

  return <AuthDiagnosticDialog open={open} onOpenChange={setOpen} />;
};
