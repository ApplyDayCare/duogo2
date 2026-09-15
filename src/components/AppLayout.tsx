import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Home, Heart, Share2, UserCircle, LogOut, Bell, Clock, MessageCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { useChatSummary } from "@/hooks/useChatSummary";

const DESKTOP_NAV_ITEMS = [
  { label: "Dashboard", path: "/dashboard", icon: Home },
  { label: "Matches", path: "/matches", icon: Heart },
  { label: "Chats", path: "/chats", icon: MessageCircle },
  { label: "History", path: "/history", icon: Clock },
  { label: "Referral", path: "/referral", icon: Share2 },
  { label: "Profile", path: "/profile", icon: UserCircle },
];

const MOBILE_NAV_ITEMS = [
  { label: "Dashboard", path: "/dashboard", icon: Home },
  { label: "Matches", path: "/matches", icon: Heart },
  { label: "Chats", path: "/chats", icon: MessageCircle },
  { label: "History", path: "/history", icon: Clock },
  { label: "Profile", path: "/profile", icon: UserCircle },
];

const AppLayout = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const isMobile = useIsMobile();
  const isChatRoute = pathname.includes("/chat");

  const { totalChatAlerts, incomingRequestsCount, totalUnreadMessages } = useChatSummary();

  const { data: profile } = useQuery({
    queryKey: ["app-layout-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, avatar_url, user_type, location_city, quiz_completed")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: unreadCount } = useQuery({
    queryKey: ["unread-notifications", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const [notifRes, matchesRes] = await Promise.all([
        supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("read", false),
        supabase
          .from("matches")
          .select("id, user_a_id, user_b_id, user_a_action, user_b_action, status")
          .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
          .eq("status", "pending"),
      ]);

      const notifCount = notifRes.count ?? 0;
      const incomingCount = (matchesRes.data ?? []).filter((m) => {
        const isA = m.user_a_id === user.id;
        return isA ? m.user_b_action === "accept" && !m.user_a_action : m.user_a_action === "accept" && !m.user_b_action;
      }).length;

      return notifCount + incomingCount;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  if (isMobile) {
    // If in chat, give full-screen native app viewport without double header or tab bar
    if (isChatRoute) {
      return (
        <div className="flex h-[100dvh] w-full flex-col bg-[#FAF7F2] font-sans text-[#181513] overflow-hidden">
          <main className="flex-1 h-full overflow-hidden">
            <Outlet />
          </main>
        </div>
      );
    }

    return (
      <div className="flex h-[100dvh] flex-col bg-[#FAF7F2] font-sans text-[#181513] overflow-hidden">
        {/* Top bar */}
        <header className="shrink-0 z-40 flex h-16 items-center justify-between border-b border-[#EBE3D5] bg-[#FAF7F2]/90 backdrop-blur-md px-4 sm:px-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1.5 font-serif text-2xl font-bold tracking-tight text-[#181513] transition-opacity hover:opacity-90"
          >
            <span>duogo</span>
            <span className="h-2 w-2 rounded-full bg-[#FF5436] inline-block" />
          </button>
          
          <div className="flex items-center gap-2">
            <button
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white border border-[#EBE3D5] text-[#181513] transition-all active:scale-95 shadow-2xs hover:bg-[#FDFBF8]"
              onClick={() => navigate("/chats")}
              aria-label="Chats"
            >
              <MessageCircle className="h-4 w-4 text-[#666059]" />
              {totalChatAlerts > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF5436] px-1 text-[10px] font-bold text-white shadow-xs animate-pulse">
                  {totalChatAlerts}
                </span>
              )}
            </button>

            <button
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white border border-[#EBE3D5] text-[#181513] transition-all active:scale-95 shadow-2xs hover:bg-[#FDFBF8]"
              onClick={() => navigate("/notifications")}
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4 text-[#666059]" />
              {!!unreadCount && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF5436] px-1 text-[10px] font-bold text-white shadow-xs">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => navigate("/profile")}
              className="flex items-center gap-1.5 rounded-full bg-white border border-[#EBE3D5] pl-1 pr-2.5 py-1 text-xs font-semibold text-[#181513] shadow-2xs transition-all active:scale-95"
            >
              <Avatar className="h-7 w-7 border border-[#FF5436]/20">
                {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
                <AvatarFallback className="bg-[#FFF2EE] text-[#FF5436] text-xs font-bold">
                  {profile?.first_name?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-[80px] truncate">{profile?.first_name || "Profile"}</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto min-h-0 pb-6">
          <Outlet />
        </main>

        {/* Bottom nav */}
        <nav className="shrink-0 z-40 border-t border-[#EBE3D5] bg-[#FAF7F2]/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
          <div className="flex h-16 items-center justify-around px-2 max-w-lg mx-auto">
            {MOBILE_NAV_ITEMS.map((item) => {
              const active = pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 min-w-[56px] min-h-[44px] py-1.5 px-2 rounded-2xl transition-all active:scale-90",
                    active
                      ? "text-[#FF5436] font-bold"
                      : "text-[#888177] hover:text-[#181513] font-medium"
                  )}
                >
                  <div className={cn(
                    "relative flex h-8 w-12 items-center justify-center rounded-full transition-all duration-200",
                    active ? "bg-[#FFF2EE] text-[#FF5436] shadow-2xs" : ""
                  )}>
                    <item.icon className={cn("h-5 w-5 transition-transform", active && "scale-110 stroke-[2.2]")} />
                    {item.label === "Matches" && incomingRequestsCount > 0 && (
                      <span className="absolute top-1 right-2 h-2.5 w-2.5 rounded-full bg-[#FF5436] animate-pulse" />
                    )}
                    {item.label === "Chats" && totalChatAlerts > 0 && (
                      <span className="absolute -top-1 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF5436] px-1 text-[9px] font-bold text-white shadow-xs animate-pulse">
                        {totalChatAlerts}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] tracking-tight">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    );
  }

  // Desktop layout with modern social sidebar
  return (
    <div className="flex h-screen bg-[#FAF7F2] font-sans text-[#181513] overflow-hidden">
      <aside className="flex h-screen w-64 flex-col border-r border-[#EBE3D5] bg-[#FAF7F2] p-4 shadow-soft shrink-0">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-3 py-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1.5 font-serif text-3xl font-bold tracking-tight text-[#181513] transition-opacity hover:opacity-90"
          >
            <span>duogo</span>
            <span className="h-2 w-2 rounded-full bg-[#FF5436] inline-block" />
          </button>
        </div>

        {/* Match Finder / Quiz CTA */}
        <div className="mt-3 px-1">
          <button
            onClick={() => navigate(profile?.quiz_completed === false ? "/quiz" : "/matches")}
            className="w-full h-12 rounded-2xl bg-[#FF5436] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(255,84,54,0.28)] hover:bg-[#E03E22] transition-all duration-200 active:scale-98 cursor-pointer"
          >
            {profile?.quiz_completed === false ? (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Take Compatibility Quiz</span>
              </>
            ) : (
              <>
                <Heart className="h-4 w-4 fill-white" />
                <span>View Matches</span>
              </>
            )}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5 px-1 py-4 overflow-y-auto">
          {DESKTOP_NAV_ITEMS.map((item) => {
            const active = pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex w-full items-center gap-3.5 rounded-2xl px-3.5 py-3 text-sm font-semibold transition-all duration-200",
                  active
                    ? "bg-white text-[#FF5436] shadow-soft border border-[#EBE3D5]"
                    : "text-[#666059] hover:bg-white/70 hover:text-[#181513]"
                )}
              >
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-xl transition-colors",
                  active ? "bg-[#FFF2EE] text-[#FF5436]" : "text-[#888177]"
                )}>
                  <item.icon className="h-4 w-4" />
                </div>
                <span>{item.label}</span>
                {item.label === "Matches" && incomingRequestsCount > 0 && (
                  <Badge className="ml-auto h-5 min-w-5 px-1.5 text-[10px] bg-[#FF5436] text-white font-bold border-0 animate-pulse">
                    {incomingRequestsCount}
                  </Badge>
                )}
                {item.label === "Chats" && totalChatAlerts > 0 && (
                  <Badge className="ml-auto h-5 min-w-5 px-1.5 text-[10px] bg-[#FF5436] text-white font-bold border-0 animate-pulse">
                    {totalChatAlerts}
                  </Badge>
                )}
              </button>
            );
          })}

          <div className="pt-2 px-1">
            <PWAInstallPrompt variant="button" className="w-full justify-center" />
          </div>
        </nav>

        {/* User Profile Card & Sign Out */}
        <div className="rounded-2xl border border-[#EBE3D5] bg-white p-3 shadow-2xs space-y-2 mt-auto">
          <button
            onClick={() => navigate("/profile")}
            className="flex items-center gap-3 w-full text-left rounded-xl p-1.5 hover:bg-[#FAF7F2] transition-colors"
          >
            <Avatar className="h-9 w-9 border border-[#FF5436]/20">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
              <AvatarFallback className="bg-[#FFF2EE] text-[#FF5436] text-xs font-bold">
                {profile?.first_name?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-[#181513]">
                {profile?.first_name || "Welcome"}
              </p>
              <p className="truncate text-[11px] text-[#888177]">
                {profile?.location_city ? `${profile.location_city} • ` : ""}{profile?.user_type === "couple" ? "Couple" : "Solo"}
              </p>
            </div>
          </button>

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-xs text-[#666059] hover:text-destructive hover:bg-destructive/10 h-8 rounded-xl"
            onClick={signOut}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </Button>
        </div>
      </aside>

      <main className={cn("flex-1", isChatRoute ? "h-screen overflow-hidden" : "h-screen overflow-y-auto")}>
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;

