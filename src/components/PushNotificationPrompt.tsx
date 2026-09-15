import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isPushSupported, getPushPermissionState, requestPushPermission } from "@/lib/pushNotifications";
import { Button } from "@/components/ui/button";
import { Bell, BellOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const PushNotificationPrompt = () => {
  const { user } = useAuth();
  const [state, setState] = useState<NotificationPermission | "unsupported">("default");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    setState(getPushPermissionState());
  }, []);

  if (!user || !isPushSupported() || state === "granted" || state === "denied" || state === "unsupported") {
    return null;
  }

  const handleEnable = async () => {
    setRequesting(true);
    const success = await requestPushPermission();
    setRequesting(false);
    if (success) {
      setState("granted");
      toast({ title: "Push notifications enabled! 🔔" });
    } else {
      setState(getPushPermissionState());
      toast({ title: "Could not enable notifications", variant: "destructive" });
    }
  };

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-center gap-3">
      <Bell className="h-5 w-5 text-primary shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">Get notified instantly</p>
        <p className="text-xs text-muted-foreground">Enable push notifications so you never miss a match.</p>
      </div>
      <Button size="sm" onClick={handleEnable} disabled={requesting}>
        {requesting ? "Enabling…" : "Enable"}
      </Button>
    </div>
  );
};

export default PushNotificationPrompt;
