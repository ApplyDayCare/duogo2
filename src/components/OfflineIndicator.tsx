import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-2xl bg-[#181513] text-white px-4 py-2 text-xs font-semibold shadow-elevated border border-white/10 animate-in fade-in slide-in-from-bottom-2">
      <WifiOff className="h-4 w-4 text-[#FF5436]" />
      <span>Offline Mode — using cached app data</span>
    </div>
  );
};
