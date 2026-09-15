import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2, Bell } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface Notification {
  id: string;
  message: string;
  read: boolean;
  created_at: string;
  link: string | null;
}

const Notifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [notifsRes, matchesRes] = await Promise.all([
        supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("matches")
          .select("id, user_a_id, user_b_id, user_a_action, user_b_action, status, created_at, updated_at")
          .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
          .in("status", ["pending", "mutual"]),
      ]);

      const notifs: Notification[] = (notifsRes.data as Notification[]) ?? [];

      // Check matches for incoming requests and mutual matches
      for (const m of matchesRes.data ?? []) {
        const isA = m.user_a_id === user.id;
        const otherUserId = isA ? m.user_b_id : m.user_a_id;
        const hasIncoming = isA
          ? m.user_b_action === "accept" && !m.user_a_action
          : m.user_a_action === "accept" && !m.user_b_action;

        if (m.status === "pending" && hasIncoming) {
          // Check if not already in list
          const exists = notifs.some((n) => n.link?.includes("/chats") || n.message.toLowerCase().includes("wants to connect"));
          if (!exists) {
            notifs.unshift({
              id: `match-req-${m.id}`,
              message: "✨ Someone reviewed your profile and wants to connect with you!",
              read: false,
              created_at: m.created_at || new Date().toISOString(),
              link: "/matches?tab=received",
            });
          }
        } else if (m.status === "mutual") {
          const matchLink = `/match-reveal/${m.id}`;
          const exists = notifs.some((n) => n.link === matchLink || n.message.toLowerCase().includes("mutual match"));
          if (!exists) {
            notifs.unshift({
              id: `match-mutual-${m.id}`,
              message: "🎉 It's a Mutual Match! You both accepted each other.",
              read: false,
              created_at: m.updated_at || m.created_at || new Date().toISOString(),
              link: matchLink,
            });
          }
        }
      }

      setNotifications(notifs);

      // Mark unread in database
      if (notifsRes.data?.some((n) => !n.read)) {
        await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
        queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
      }
      setLoading(false);
    })();
  }, [user, queryClient]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:py-10 space-y-6">
      <div className="space-y-1">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Notifications</h1>
        <p className="text-xs text-muted-foreground">Match alerts, message reminders, and community updates</p>
      </div>

      {notifications.length === 0 ? (
        <Card className="rounded-3xl border border-[#EFE8DD] shadow-soft bg-white">
          <CardContent className="py-14 text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF0EB] text-primary">
              <Bell className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="font-serif text-lg font-bold text-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                When someone matches with you or sends a message, you'll see it here first.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((n) => (
            <Card
              key={n.id}
              className={cn(
                "rounded-2xl border border-[#EFE8DD] bg-white shadow-soft transition-all",
                n.link && "cursor-pointer hover:shadow-card hover:border-primary/40 active:scale-[0.99]"
              )}
              onClick={() => n.link && navigate(n.link)}
            >
              <CardContent className="p-4 flex items-start gap-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0EB] text-primary shrink-0 mt-0.5">
                  <Bell className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-snug">{n.message}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
                {n.link && <span className="text-primary font-bold text-xs mt-1">→</span>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Button variant="outline" className="w-full rounded-full font-bold h-11 border-[#EFE8DD] bg-white hover:bg-[#FAF7F2]" onClick={() => navigate("/dashboard")}>
        Back to Dashboard
      </Button>
    </div>
  );
};

export default Notifications;
