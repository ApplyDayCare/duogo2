import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Home, Users, Share2, UserCircle, LogOut, Bell, Clock, MessageCircle, Sparkles, MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { useChatSummary } from "@/hooks/useChatSummary";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { deduplicateNotifications } from "@/lib/notificationDeduplication";
import { toast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/posthog";
import { FeedbackIssueDialog } from "@/components/FeedbackIssueDialog";

const DESKTOP_NAV_ITEMS = [
  { label: "Dashboard", path: "/dashboard", icon: Home },
  { label: "Matches", path: "/matches", icon: Users },
  { label: "Chats", path: "/chats", icon: MessageCircle },
  { label: "Notifications", path: "/notifications", icon: Bell },
  { label: "History", path: "/history", icon: Clock },
  { label: "Referral", path: "/referral", icon: Share2 },
  { label: "Profile", path: "/profile", icon: UserCircle },
];

const MOBILE_NAV_ITEMS = [
  { label: "Dashboard", path: "/dashboard", icon: Home },
  { label: "Matches", path: "/matches", icon: Users },
  { label: "Chats", path: "/chats", icon: MessageCircle },
  { label: "History", path: "/history", icon: Clock },
  { label: "Profile", path: "/profile", icon: UserCircle },
];

const AppLayout = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const isSingleChatRoom = pathname !== "/chats" && pathname.includes("/chat");
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);

  const { totalChatAlerts, incomingRequestsCount, totalUnreadMessages } = useChatSummary();
  usePushNotifications();

  // Live subscription for notification count
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`public:notifications:applayout:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["unread-notifications", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

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
      const { data, error } = await supabase
        .from("notifications")
        .select("id, message, link, read, created_at")
        .eq("user_id", user.id)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error || !data) return 0;
      const deduped = deduplicateNotifications(
        data.map((item) => ({
          id: String(item.id),
          message: typeof item.message === "string" ? item.message : JSON.stringify(item.message ?? ""),
          read: Boolean(item.read),
          created_at: typeof item.created_at === "string" ? item.created_at : new Date().toISOString(),
          link: typeof item.link === "string" ? item.link : null,
        }))
      );
      return deduped.filter((n) => !n.read).length;
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  const handleMatchesNav = () => {
    if (incomingRequestsCount > 0) {
      navigate("/matches?tab=received");
    } else {
      navigate("/matches");
    }
  };

  const handleGiveFeedback = () => {
    trackEvent("open_feedback_survey", { source: "header", path: pathname });
    trackEvent("give_feedback_clicked", { source: "header", path: pathname });
    trackEvent("feedback_clicked", { source: "header", path: pathname });
    setFeedbackDialogOpen(true);
  };

  if (isMobile) {
    // If in single active chat room, give full-screen native app viewport without double header or tab bar
    if (isSingleChatRoom) {
      return (
        <div className="flex h-[100dvh] w-full flex-col bg-[#FAF7F2] font-sans text-[#181513] overflow-hidden fixed inset-0">
          <main className="flex-1 h-full overflow-hidden relative">
            <Outlet />
          </main>
        </div>
      );
    }

    return (
      <div className="flex h-[100dvh] flex-col bg-[#FAF7F2] font-sans text-[#181513] overflow-hidden">
        {/* Top bar */}
        <header className="shrink-0 z-40 flex h-16 items-center justify-between border-b border-[#EBE3D5] bg-[#FAF7F2]/90 backdrop-blur-md px-3 sm:px-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1.5 font-serif text-2xl font-bold tracking-tight text-[#181513] transition-opacity hover:opacity-90"
          >
            <span>duogo</span>
            <span className="h-2 w-2 rounded-full bg-[#FF5436] inline-block" />
          </button>
          
          <div className="flex items-center gap-2">
            <button
              id="give-feedback-btn"
              data-attr="give-feedback-btn"
              onClick={handleGiveFeedback}
              className="feedback-btn give-feedback-btn flex items-center gap-1.5 rounded-full bg-white border border-[#EBE3D5] px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-[#181513] shadow-2xs transition-all active:scale-95 hover:bg-[#FFF5F2] hover:border-[#FF5436]/40 hover:text-[#FF5436]"
              title="Feedback"
            >
              <MessageSquarePlus className="h-3.5 w-3.5 text-[#FF5436]" />
              <span className="text-[11px] sm:text-xs font-medium">Feedback</span>
            </button>

            <button
              className="relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white border border-[#EBE3D5] text-[#181513] transition-all active:scale-95 shadow-2xs hover:bg-[#FDFBF8]"
              onClick={() => navigate("/notifications")}
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4 text-[#666059]" />
              {pathname !== "/notifications" && !!unreadCount && unreadCount > 0 && (
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
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>

        {/* Bottom nav */}
        <nav className="shrink-0 z-40 border-t border-[#EBE3D5] bg-[#FAF7F2]/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
          <div className="flex h-16 items-center justify-around px-2 max-w-lg mx-auto">
            {MOBILE_NAV_ITEMS.map((item) => {
              const active = pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    if (item.label === "Matches") {
                      handleMatchesNav();
                    } else {
                      navigate(item.path);
                    }
                  }}
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

        <FeedbackIssueDialog
          open={feedbackDialogOpen}
          onOpenChange={setFeedbackDialogOpen}
        />
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
            onClick={() => {
              if (profile?.quiz_completed === false) {
                navigate("/quiz");
              } else {
                handleMatchesNav();
              }
            }}
            className="w-full h-12 rounded-2xl bg-[#FF5436] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(255,84,54,0.28)] hover:bg-[#E03E22] transition-all duration-200 active:scale-98 cursor-pointer"
          >
            {profile?.quiz_completed === false ? (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Take Compatibility Quiz</span>
              </>
            ) : (
              <>
                <Users className="h-4 w-4" />
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
                onClick={() => {
                  if (item.label === "Matches") {
                    handleMatchesNav();
                  } else {
                    navigate(item.path);
                  }
                }}
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
                {item.label === "Notifications" && !!unreadCount && unreadCount > 0 && (
                  <Badge className="ml-auto h-5 min-w-5 px-1.5 text-[10px] bg-[#FF5436] text-white font-bold border-0">
                    {unreadCount}
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

      <main className={cn("flex-1 flex flex-col min-w-0 bg-[#FAF7F2]", isSingleChatRoom ? "h-screen overflow-hidden" : "h-screen overflow-hidden")}>
        {!isSingleChatRoom && (
          <header className="hidden md:flex shrink-0 z-30 h-16 items-center justify-between border-b border-[#EBE3D5] bg-[#FAF7F2]/90 backdrop-blur-md px-8">
            <div className="flex items-center gap-2">
              <span className="font-serif text-lg font-bold text-[#181513]">
                {pathname === "/dashboard"
                  ? "Dashboard"
                  : pathname === "/matches"
                  ? "Matches"
                  : pathname === "/chats"
                  ? "Messages"
                  : pathname === "/notifications"
                  ? "Notifications"
                  : pathname === "/history"
                  ? "Connection History"
                  : pathname === "/referral"
                  ? "Invite Friends"
                  : pathname === "/profile"
                  ? "My Profile"
                  : "duogo"}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                id="give-feedback-btn-desktop"
                data-attr="give-feedback-btn"
                onClick={handleGiveFeedback}
                className="feedback-btn give-feedback-btn flex items-center gap-1.5 rounded-full bg-white border border-[#EBE3D5] px-3.5 py-1.5 text-xs font-semibold text-[#181513] shadow-2xs transition-all active:scale-95 hover:bg-[#FFF5F2] hover:border-[#FF5436]/40 hover:text-[#FF5436]"
                title="Feedback"
              >
                <MessageSquarePlus className="h-4 w-4 text-[#FF5436]" />
                <span>Feedback</span>
              </button>

              <button
                className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white border border-[#EBE3D5] text-[#181513] transition-all active:scale-95 shadow-2xs hover:bg-[#FDFBF8]"
                onClick={() => navigate("/notifications")}
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4 text-[#666059]" />
                {pathname !== "/notifications" && !!unreadCount && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF5436] px-1 text-[10px] font-bold text-white shadow-xs">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          </header>
        )}

        <div className={cn("flex-1", isSingleChatRoom ? "h-full overflow-hidden" : "overflow-y-auto")}>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>

      <FeedbackIssueDialog
        open={feedbackDialogOpen}
        onOpenChange={setFeedbackDialogOpen}
      />
    </div>
  );
};

export default AppLayout;

