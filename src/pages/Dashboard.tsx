import { useEffect, useState, useCallback } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, Heart, Share2, Settings, Clock, CheckCircle, Users, Star, Pause, Play, ShieldCheck, Sparkles, MessageCircle, ArrowRight, Copy, Check, Link2, AlertCircle, RotateCw } from "lucide-react";
import SuspensionBanner from "@/components/SuspensionBanner";
import PushNotificationPrompt from "@/components/PushNotificationPrompt";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getCouplePartnerId } from "@/lib/coupleUtils";
import { getSavedQuizAnswers, ensureUserQuizResponse } from "@/lib/quizSync";
import { triggerInstantMatchCheck } from "@/lib/matchEngine";
import { useChatSummary } from "@/hooks/useChatSummary";
import { getOfflineProfile, getOfflineMatches } from "@/lib/queryPersister";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { motion, type Variants } from "framer-motion";
import { PullToRefresh } from "@/components/PullToRefresh";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.04,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const greetingCardVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

interface ProfileData {
  first_name: string | null;
  user_type: string | null;
  location_city: string | null;
  quality_score: number;
  quiz_completed: boolean;
  onboarding_completed: boolean;
  matching_paused: boolean;
  is_suspended: boolean;
}

interface CoupleInfo {
  isCouple: boolean;
  isLinked: boolean;
  partnerId: string | null;
  partnerName: string | null;
  partnerQuizDone: boolean;
  bothQuizDone: boolean;
  inviteCode: string | null;
}

interface Stats {
  activeMatches: number;
  pendingMatches: number;
  incomingRequests: number;
  successfulMeets: number;
  referrals: number;
  boostActive: boolean;
  boostDays: number;
}

interface ActiveConnection {
  matchId: string;
  score: number;
  name: string;
  avatarUrl: string | null;
  city: string | null;
}

const Dashboard = () => {
  const { user, session, refreshProfile, signOut } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [redirect, setRedirect] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [coupleInfo, setCoupleInfo] = useState<CoupleInfo | null>(null);
  const [activeConnections, setActiveConnections] = useState<ActiveConnection[]>([]);
  const [stats, setStats] = useState<Stats>({
    activeMatches: 0, pendingMatches: 0, incomingRequests: 0, successfulMeets: 0, referrals: 0,
    boostActive: false, boostDays: 0,
  });
  const [copiedCoupleCode, setCopiedCoupleCode] = useState(false);
  const [showJoinCodeInput, setShowJoinCodeInput] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [linkingPartner, setLinkingPartner] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);

  const {
    chats,
    incomingRequests,
    incomingRequestsCount,
    totalUnreadMessages,
    totalChatAlerts,
    refetch: refetchChatSummary,
  } = useChatSummary();

  const handleCopyCoupleCode = () => {
    if (!coupleInfo?.inviteCode) return;
    navigator.clipboard.writeText(coupleInfo.inviteCode);
    setCopiedCoupleCode(true);
    toast({ title: "Invite Code Copied!", description: "Share this code with your partner to link accounts." });
    setTimeout(() => setCopiedCoupleCode(false), 2500);
  };

  const handleShareCoupleLink = async () => {
    if (!coupleInfo?.inviteCode) return;
    const link = `${window.location.origin}/join/${coupleInfo.inviteCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me on duogo!",
          text: `Hey! Link our couple profile on duogo with my invite code: ${coupleInfo.inviteCode}`,
          url: link,
        });
        return;
      } catch {
        // Fallback to copy link
      }
    }
    navigator.clipboard.writeText(link);
    toast({ title: "Link Copied!", description: "Direct invite link copied to clipboard." });
  };

  const handleLinkWithPartnerCode = async () => {
    const cleanCode = joinCodeInput.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 4) {
      toast({ title: "Invalid code", description: "Please enter a valid 6-character invite code.", variant: "destructive" });
      return;
    }
    if (!user) return;

    setLinkingPartner(true);
    try {
      const { data: targetCouple, error: fetchErr } = await supabase
        .from("couples")
        .select("id, partner_a_id, partner_b_id, invite_code")
        .eq("invite_code", cleanCode)
        .maybeSingle();

      if (fetchErr || !targetCouple) {
        toast({ title: "Code not found", description: "We couldn't find a couple profile with that code. Please check with your partner.", variant: "destructive" });
        setLinkingPartner(false);
        return;
      }

      if (targetCouple.partner_a_id === user.id) {
        toast({ title: "Your own code", description: "This is your own invite code. Share it with your partner instead!", variant: "destructive" });
        setLinkingPartner(false);
        return;
      }

      if (targetCouple.partner_b_id && targetCouple.partner_b_id !== user.id) {
        toast({ title: "Code already used", description: "This couple profile is already linked to another partner.", variant: "destructive" });
        setLinkingPartner(false);
        return;
      }

      const { error: linkErr } = await supabase
        .from("couples")
        .update({ partner_b_id: user.id, both_verified: true })
        .eq("id", targetCouple.id);

      if (linkErr) {
        toast({ title: "Error linking", description: linkErr.message, variant: "destructive" });
        setLinkingPartner(false);
        return;
      }

      await supabase.from("profiles").update({ user_type: "couple" }).eq("id", user.id);

      const { data: partnerProfile } = await supabase
        .from("profiles")
        .select("first_name, quiz_completed")
        .eq("id", targetCouple.partner_a_id)
        .maybeSingle();

      setCoupleInfo({
        isCouple: true,
        isLinked: true,
        partnerId: targetCouple.partner_a_id,
        partnerName: partnerProfile?.first_name ?? null,
        partnerQuizDone: !!partnerProfile?.quiz_completed,
        bothQuizDone: !!(profile?.quiz_completed && partnerProfile?.quiz_completed),
        inviteCode: targetCouple.invite_code,
      });

      setShowJoinCodeInput(false);
      setJoinCodeInput("");
      toast({ title: "Partner Linked! 🎉", description: `You are now linked with ${partnerProfile?.first_name || "your partner"}.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to link", variant: "destructive" });
    } finally {
      setLinkingPartner(false);
    }
  };

  const fetchDashboardData = useCallback(async (isManualRefresh = false) => {
    if (!user) return;

    if (isManualRefresh) {
      setIsRefreshing(true);
    }

    try {
      // Fetch profile
      const { data: p } = await supabase
        .from("profiles")
        .select("first_name, user_type, location_city, quality_score, quiz_completed, onboarding_completed, matching_paused, is_suspended")
        .eq("id", user.id)
        .maybeSingle();

      if (p) {
        if (!p.quiz_completed) {
          const { data: qRow } = await supabase
            .from("quiz_responses")
            .select("dimension_1_social")
            .eq("user_id", user.id)
            .maybeSingle();

          const localAnswers = getSavedQuizAnswers(user.id);
          const hasQuizData = (qRow && qRow.dimension_1_social !== null) || (localAnswers && (localAnswers.personalityChoice || Object.keys(localAnswers.scaleAnswers || {}).length > 0));

          if (hasQuizData) {
            p.quiz_completed = true;
            p.onboarding_completed = true;
            await supabase.from("profiles").update({ quiz_completed: true, onboarding_completed: true }).eq("id", user.id);
            if (!qRow || qRow.dimension_1_social === null) {
              await ensureUserQuizResponse(user.id);
            }
          }
        }
      }

      if (!p?.onboarding_completed && !p?.quiz_completed) {
        setRedirect("/onboarding/user-type");
        setChecked(true);
        return;
      }

      setProfile(p as ProfileData);

      // Get couple partner for broader match query
      const partnerId = p.user_type === "couple" ? await getCouplePartnerId(user.id) : null;
      const matchFilter = partnerId
        ? `user_a_id.eq.${user.id},user_b_id.eq.${user.id},user_a_id.eq.${partnerId},user_b_id.eq.${partnerId}`
        : `user_a_id.eq.${user.id},user_b_id.eq.${user.id}`;

      // Fetch stats in parallel
      const [matchesRes, feedbackRes, referralRes, coupleRes] = await Promise.all([
        supabase.from("matches").select("id, status, user_a_id, user_b_id, user_a_action, user_b_action, compatibility_score").or(matchFilter),
        supabase.from("pulse_feedback").select("id, met_in_person").eq("user_id", user.id),
        supabase.from("referrals").select("successful_signups, priority_boost_expiry").eq("referrer_id", user.id).maybeSingle(),
        p.user_type === "couple"
          ? supabase.from("couples").select("id, partner_a_id, partner_b_id, both_verified, invite_code").or(`partner_a_id.eq.${user.id},partner_b_id.eq.${user.id}`).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      // Deduplicate matches (couple partners may overlap)
      const seenIds = new Set<string>();
      const matches = (matchesRes.data ?? []).filter((m) => {
        if (seenIds.has(m.id)) return false;
        seenIds.add(m.id);
        return true;
      });
      const mutualMatches = matches.filter((m) => m.status === "mutual");
      const activeMatches = mutualMatches.length;

      // Fetch active connection details
      if (mutualMatches.length > 0) {
        const otherIds = mutualMatches.map((m) => (m.user_a_id === user.id || (partnerId && m.user_a_id === partnerId) ? m.user_b_id : m.user_a_id));
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, first_name, avatar_url, location_city")
          .in("id", otherIds);
        const profMap = new Map((profs || []).map((prof) => [prof.id, prof]));
        const conns: ActiveConnection[] = mutualMatches.map((m) => {
          const oId = m.user_a_id === user.id || (partnerId && m.user_a_id === partnerId) ? m.user_b_id : m.user_a_id;
          const pr = profMap.get(oId);
          return {
            matchId: m.id,
            score: m.compatibility_score || 91,
            name: pr?.first_name || "Match",
            avatarUrl: pr?.avatar_url || null,
            city: pr?.location_city || null,
          };
        });
        setActiveConnections(conns);
      } else {
        setActiveConnections([]);
      }

      const pendingMatches = matches.filter((m) => {
        if (m.status !== "pending") return false;
        const isA = m.user_a_id === user.id || (partnerId && m.user_a_id === partnerId);
        return isA ? m.user_a_action === "accept" : m.user_b_action === "accept";
      }).length;
      const incomingRequests = matches.filter((m) => {
        if (m.status !== "pending") return false;
        const isA = m.user_a_id === user.id || (partnerId && m.user_a_id === partnerId);
        return isA ? m.user_b_action === "accept" : m.user_a_action === "accept";
      }).length;

      const feedback = feedbackRes.data ?? [];
      const successfulMeets = feedback.filter((f) => f.met_in_person === "yes").length;

      const referralData = referralRes.data;
      const boostActive = referralData?.priority_boost_expiry
        ? new Date(referralData.priority_boost_expiry) > new Date()
        : false;
      const boostDays = boostActive && referralData?.priority_boost_expiry
        ? Math.ceil((new Date(referralData.priority_boost_expiry).getTime() - Date.now()) / 86400000)
        : 0;

      setStats({
        activeMatches,
        pendingMatches,
        incomingRequests,
        successfulMeets,
        referrals: referralData?.successful_signups ?? 0,
        boostActive,
        boostDays,
      });

      // Couple info
      if (p.user_type === "couple") {
        let coupleRecord = coupleRes.data;
        if (!coupleRecord) {
          const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
          let code = "";
          for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
          const { data: created } = await supabase
            .from("couples")
            .insert({ invite_code: code, partner_a_id: user.id })
            .select("id, partner_a_id, partner_b_id, both_verified, invite_code")
            .maybeSingle();
          if (created) coupleRecord = created;
        }

        const partnerId = coupleRecord
          ? (coupleRecord.partner_a_id === user.id ? coupleRecord.partner_b_id : coupleRecord.partner_a_id)
          : null;

        if (partnerId) {
          const { data: partnerProfile } = await supabase
            .from("profiles")
            .select("first_name, quiz_completed")
            .eq("id", partnerId)
            .maybeSingle();

          setCoupleInfo({
            isCouple: true,
            isLinked: true,
            partnerId,
            partnerName: partnerProfile?.first_name ?? null,
            partnerQuizDone: !!partnerProfile?.quiz_completed,
            bothQuizDone: !!(p.quiz_completed && partnerProfile?.quiz_completed),
            inviteCode: coupleRecord?.invite_code ?? null,
          });
        } else {
          setCoupleInfo({
            isCouple: true,
            isLinked: false,
            partnerId: null,
            partnerName: null,
            partnerQuizDone: false,
            bothQuizDone: false,
            inviteCode: coupleRecord?.invite_code ?? null,
          });
        }
      } else {
        setCoupleInfo(null);
      }

      // If manual refresh: sync chats, invalidations & instant matches
      if (isManualRefresh) {
        await Promise.allSettled([
          refetchChatSummary(),
          queryClient.invalidateQueries({ queryKey: ["unread-notifications"] }),
          queryClient.invalidateQueries({ queryKey: ["matches"] }),
          queryClient.invalidateQueries({ queryKey: ["app-layout-profile"] }),
          refreshProfile(),
          triggerInstantMatchCheck(session),
        ]);

        setRefreshSuccess(true);
        setTimeout(() => {
          setRefreshSuccess(false);
        }, 1300);

        toast({
          title: "Matches & Alerts Updated",
          description: "Your latest community matches and notifications are up to date.",
        });
      }
    } catch (err) {
      console.error("Failed to load dashboard data, checking offline cache:", err);
      // Attempt to populate profile and stats from IndexedDB cache if offline
      try {
        const cachedProfile = await getOfflineProfile(user.id);
        if (cachedProfile) {
          setProfile({
            first_name: cachedProfile.first_name ?? null,
            user_type: cachedProfile.user_type ?? "solo",
            location_city: cachedProfile.location_city ?? null,
            quality_score: cachedProfile.quality_score ?? 100,
            quiz_completed: Boolean(cachedProfile.quiz_completed),
            onboarding_completed: Boolean(cachedProfile.onboarding_completed),
            matching_paused: Boolean(cachedProfile.matching_paused),
            is_suspended: Boolean(cachedProfile.is_suspended),
          });
        }
        const cachedMatches = await getOfflineMatches(user.id);
        if (cachedMatches) {
          setStats((prev) => ({
            ...prev,
            activeMatches: cachedMatches.matches?.length ?? 0,
            pendingMatches: cachedMatches.pending_matches?.length ?? 0,
            incomingRequests: cachedMatches.incoming_matches?.length ?? 0,
          }));
        }
      } catch (cacheErr) {
        console.warn("Offline cache load error:", cacheErr);
      }

      if (isManualRefresh) {
        toast({
          title: "Offline Mode",
          description: "Displaying your cached profile and matches.",
        });
      }
    } finally {
      setChecked(true);
      if (isManualRefresh) {
        setIsRefreshing(false);
      }
    }
  }, [user, session, queryClient, refetchChatSummary, refreshProfile]);

  useEffect(() => {
    fetchDashboardData(false);
  }, [fetchDashboardData]);

  if (!checked) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-10 space-y-7 animate-pulse">
        {/* Skeleton Greeting Card */}
        <div className="rounded-3xl p-6 border border-[#EFE8DD] bg-card/60 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-3 w-full max-w-sm">
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="h-8 w-60 rounded-xl" />
            <Skeleton className="h-4 w-44 rounded-md" />
          </div>
          <div className="flex gap-2 shrink-0">
            <Skeleton className="h-10 w-28 rounded-full" />
            <Skeleton className="h-10 w-24 rounded-full" />
          </div>
        </div>

        {/* Skeleton Action Hero Card */}
        <div className="rounded-[28px] p-7 sm:p-8 border border-[#FFD9CE] bg-gradient-to-br from-[#FFF0EB] to-white space-y-4 shadow-soft">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-2xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 w-48 rounded-lg" />
              <Skeleton className="h-4 w-72 rounded-md" />
            </div>
          </div>
          <Skeleton className="h-13 w-full rounded-2xl mt-4" />
        </div>

        {/* Skeleton Community Activity Bento Grid */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-40 rounded-md" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-4 rounded-2xl bg-card border border-[#EFE8DD] space-y-2">
                <Skeleton className="h-4 w-16 rounded-md" />
                <Skeleton className="h-7 w-12 rounded-lg" />
              </div>
            ))}
          </div>
        </div>

        {/* Skeleton Status & Health Card */}
        <div className="rounded-3xl border border-[#EFE8DD] bg-card p-6 space-y-4 shadow-soft">
          <div className="flex items-center justify-between pb-3 border-b border-[#F5EDE3]">
            <Skeleton className="h-5 w-44 rounded-md" />
            <Skeleton className="h-7 w-16 rounded-full" />
          </div>
          <div className="space-y-3 pt-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Skeleton Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-4 rounded-2xl bg-card border border-[#EFE8DD] flex flex-col items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-3 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (redirect) return <Navigate to={redirect} replace />;

  const qualityDisplay = Number(profile?.quality_score ?? 1);

  return (
    <PullToRefresh
      onRefresh={() => fetchDashboardData(true)}
      isRefreshing={isRefreshing}
      refreshSuccess={refreshSuccess}
      className="min-h-full"
    >
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="mx-auto max-w-2xl px-4 py-8 sm:py-10 space-y-7"
      >
        {/* Suspension banner & Install / Notification Prompts */}
        <motion.div variants={itemVariants} className="space-y-3">
          {profile?.is_suspended && <SuspensionBanner />}
          <PWAInstallPrompt variant="banner" />
          <PushNotificationPrompt />
        </motion.div>

        {/* Warm Personal Greeting Hero */}
        <motion.div
          variants={greetingCardVariants}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-br from-white via-[#FFF8F5] to-white rounded-3xl p-6 border border-[#EFE8DD] shadow-soft"
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF0EB] px-3 py-1 text-xs font-bold text-primary">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                <span>{profile?.location_city ? `Active in ${profile.location_city}` : "Matching Active"}</span>
              </div>

              <button
                type="button"
                onClick={() => fetchDashboardData(true)}
                disabled={isRefreshing}
                title="Click to refresh matches & notifications (or pull down)"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/90 hover:bg-[#FFF0EB] border border-[#EFE8DD] hover:border-[#FFD9CE] px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-primary transition-all active:scale-95 disabled:opacity-60 shadow-2xs"
              >
                <RotateCw className={cn("h-3 w-3 transition-transform", isRefreshing && "animate-spin text-primary")} />
                <span>{isRefreshing ? "Updating…" : "Refresh"}</span>
              </button>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <span>Welcome back, {profile?.first_name || "friend"}!</span>
              <motion.span
                className="inline-block origin-bottom-right"
                initial={{ rotate: 0 }}
                animate={{ rotate: [0, 14, -8, 14, -4, 10, 0] }}
                transition={{ duration: 1.2, delay: 0.35, ease: "easeInOut" }}
              >
                👋
              </motion.span>
            </h1>
            <p className="text-sm text-muted-foreground">
              {profile?.user_type === "couple" ? "Looking for double-date couple friends" : "Looking for great genuine friends"}
            </p>
          </div>

        {profile?.matching_paused && (
          <div className="flex items-center gap-2 rounded-2xl bg-[#FFF0EB] border border-[#FFD9CE] p-3">
            <Pause className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">Matching is paused</span>
            <Button
              size="sm"
              className="ml-auto h-8 text-xs font-bold"
              onClick={async () => {
                await supabase.from("profiles").update({ matching_paused: false }).eq("id", user!.id);
                setProfile((prev) => prev ? { ...prev, matching_paused: false } : prev);
              }}
            >
              <Play className="h-3 w-3 mr-1" /> Resume
            </Button>
          </div>
        )}
      </motion.div>

      {/* Prominent Chat Requests Alert */}
      {incomingRequestsCount > 0 && (
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-3xl bg-gradient-to-r from-[#FFF0EB] via-[#FFF8F5] to-white border-2 border-[#FF5436]/40 p-5 shadow-card"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF5436] text-white shrink-0 shadow-soft">
              <Sparkles className="h-6 w-6 fill-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm sm:text-base font-bold text-[#181513]">
                  {incomingRequestsCount === 1
                    ? "Someone wants to connect with you!"
                    : `You have ${incomingRequestsCount} new connection requests waiting!`}
                </p>
                <Badge className="bg-[#FF5436] text-white text-[10px] font-bold">New</Badge>
              </div>
              <p className="text-xs text-[#666059] mt-0.5">
                {incomingRequestsCount === 1
                  ? `${incomingRequests[0].score}% Compatibility · Review their profile and connect back to start chatting.`
                  : "Members reviewed your profile and sent connection requests."}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="rounded-full bg-[#FF5436] hover:bg-[#E03E22] text-white font-bold px-5 h-10 shadow-soft shrink-0 self-end sm:self-center gap-1.5"
            onClick={() => navigate("/matches?tab=received")}
          >
            <span>Review Requests</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </motion.div>
      )}

      {/* Incomplete Step Banner: Link Partner Account */}
      {coupleInfo?.isCouple && !coupleInfo.isLinked && (
        <motion.div
          variants={itemVariants}
          className="rounded-3xl bg-gradient-to-br from-[#FFF0EB] via-[#FFF8F5] to-white border-2 border-[#FF5436] p-5 sm:p-6 shadow-card space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF5436] text-white shrink-0 shadow-soft">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-[#FF5436] text-white text-[10.5px] font-bold uppercase tracking-wider">
                    Step Incomplete
                  </Badge>
                  <span className="text-xs font-semibold text-muted-foreground">
                    Couple Account Setup
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-[#181513] mt-1 font-serif">
                  Link your partner to start matching
                </h2>
                <p className="text-xs sm:text-sm text-[#666059] mt-0.5 max-w-lg leading-relaxed">
                  You are registered as a <strong>Couple</strong>! Because couple matches introduce both of you together as a duo to other couples, your partner needs to link accounts and complete the quiz before matching unlocks.
                </p>
              </div>
            </div>
          </div>

          {/* Code box & Share tools */}
          <div className="rounded-2xl bg-white p-4 border border-[#FFD9CE] shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                  Your Couple Invite Code
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xl sm:text-2xl font-bold tracking-widest text-[#181513] bg-[#FFF0EB] px-3 py-1 rounded-xl border border-[#FFD9CE]">
                    {coupleInfo.inviteCode || "Loading..."}
                  </span>
                  <span className="text-xs text-muted-foreground">• Share with your partner</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full font-bold border-[#FFD9CE] hover:bg-[#FFF5F1] text-xs h-9 px-3.5 gap-1.5"
                  onClick={handleCopyCoupleCode}
                >
                  {copiedCoupleCode ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-primary" />}
                  <span>{copiedCoupleCode ? "Copied!" : "Copy Code"}</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full font-bold border-[#FFD9CE] hover:bg-[#FFF5F1] text-xs h-9 px-3.5 gap-1.5"
                  onClick={handleShareCoupleLink}
                >
                  <Share2 className="h-3.5 w-3.5 text-primary" />
                  <span>Share Link</span>
                </Button>
                <Button
                  size="sm"
                  className="rounded-full bg-[#FF5436] hover:bg-[#E03E22] text-white font-bold text-xs h-9 px-4 gap-1.5"
                  onClick={() => navigate("/profile")}
                >
                  <span>Couple Settings</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Enter partner's code toggle */}
            <div className="border-t border-[#F5EDE3] pt-3">
              {!showJoinCodeInput ? (
                <button
                  type="button"
                  onClick={() => setShowJoinCodeInput(true)}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Have an invite code from your partner? Enter it here</span>
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 pt-1">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Input
                      placeholder="e.g. K9X2P4"
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                      maxLength={8}
                      className="font-mono text-sm uppercase tracking-wider rounded-xl border-[#FFD9CE] bg-white h-9 w-36"
                    />
                    <Button
                      size="sm"
                      onClick={handleLinkWithPartnerCode}
                      disabled={linkingPartner || !joinCodeInput.trim()}
                      className="rounded-full font-bold h-9 px-4 text-xs"
                    >
                      {linkingPartner ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Link"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowJoinCodeInput(false)}
                      className="rounded-full text-xs text-muted-foreground h-9"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Step Incomplete: Partner Quiz Pending */}
      {coupleInfo?.isCouple && coupleInfo.isLinked && !coupleInfo.partnerQuizDone && (
        <motion.div
          variants={itemVariants}
          className="rounded-3xl bg-[#FFFBF0] border border-[#FDE68A] p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-100 text-amber-800 text-[10px] font-bold">
                  Quiz Pending
                </Badge>
                <span className="text-xs font-semibold text-muted-foreground">
                  Partner Linked: {coupleInfo.partnerName || "Partner"}
                </span>
              </div>
              <p className="text-sm font-bold text-[#181513] mt-1">
                Waiting for {coupleInfo.partnerName || "your partner"} to take the quiz
              </p>
              <p className="text-xs text-[#666059] mt-0.5">
                Your duo profile will automatically activate for couple matches once they finish their 10-dimension vibe quiz.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full border-amber-300 hover:bg-amber-100 text-xs font-bold h-9 px-4 shrink-0 self-end sm:self-center"
            onClick={handleShareCoupleLink}
          >
            Remind Partner
          </Button>
        </motion.div>
      )}

      {/* Quiz Pending Alert Banner */}
      {!profile?.quiz_completed && (
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-3xl bg-[#FFF9F7] border-2 border-[#FF5436]/40 p-5 shadow-card"
        >
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FFF0EB] text-[#FF5436]">
              <Sparkles className="h-5 w-5 text-[#FF5436] animate-pulse" />
            </div>
            <div>
              <h4 className="font-serif font-bold text-base text-[#1A1816]">Compatibility Quiz Pending</h4>
              <p className="text-xs text-[#706A62]">Take our 10-dimension quiz to calculate authentic compatibility scores and unlock matches.</p>
            </div>
          </div>
          <Button
            size="sm"
            className="bg-[#FF5436] hover:bg-[#E84326] text-white font-bold rounded-full h-10 px-5 text-xs shrink-0 shadow-xs cursor-pointer"
            onClick={() => navigate("/quiz")}
          >
            Take Quiz Now →
          </Button>
        </motion.div>
      )}

      {/* Signature Find Matches / Take Quiz Hero Card */}
      <motion.div
        variants={itemVariants}
        className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#FF5436] via-[#FF664C] to-[#E84326] p-7 sm:p-8 text-white shadow-[0_12px_36px_-6px_rgba(255,84,54,0.38)]"
      >
        {/* Background Decorative Rings */}
        <div className="absolute -right-10 -bottom-10 h-48 w-48 rounded-full bg-white/10 blur-xl pointer-events-none" />
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-lg pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-md">
            <div className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white tracking-wide">
              {!profile?.quiz_completed ? (
                <span>✦ Quiz Required</span>
              ) : coupleInfo?.isCouple && !coupleInfo.isLinked ? (
                <span>Partner Link Required</span>
              ) : coupleInfo?.isCouple && !coupleInfo.partnerQuizDone ? (
                <span>Partner Quiz Pending</span>
              ) : (
                <span>Weekly Discovery</span>
              )}
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white leading-tight">
              {!profile?.quiz_completed
                ? "Complete Your Compatibility Quiz"
                : "Ready to meet your next real connection?"}
            </h2>
            <p className="text-sm text-white/90 leading-relaxed">
              {!profile?.quiz_completed
                ? "Take our 10-dimension compatibility quiz so we can calculate authentic scores and suggest genuine matches."
                : coupleInfo?.isCouple && !coupleInfo.isLinked
                ? "Link your partner account to unlock couple matching with local duos."
                : coupleInfo?.isCouple && !coupleInfo.partnerQuizDone
                ? "Waiting for your partner to finish their quiz before couple matches activate."
                : "We compare your shared vibes, values, and energy across 5 dimensions."}
            </p>
          </div>

          <Button
            size="lg"
            className="h-14 px-8 rounded-full bg-white text-[#191715] hover:bg-[#FAF7F2] font-bold text-base shadow-[0_4px_16px_rgba(0,0,0,0.15)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.2)] hover:scale-105 active:scale-95 transition-all shrink-0 cursor-pointer"
            disabled={profile?.is_suspended}
            onClick={() => {
              if (!profile?.quiz_completed) {
                navigate("/quiz");
              } else if (coupleInfo?.isCouple && !coupleInfo.isLinked) {
                navigate("/profile");
              } else {
                navigate("/matches");
              }
            }}
          >
            {!profile?.quiz_completed ? (
              <>
                <Sparkles className="h-5 w-5 text-[#FF5436] mr-1.5" />
                <span>Take Compatibility Quiz</span>
              </>
            ) : coupleInfo?.isCouple && !coupleInfo.isLinked ? (
              <>
                <Users className="h-5 w-5 text-primary mr-1.5" />
                <span>Link Partner to Match</span>
              </>
            ) : coupleInfo?.isCouple && !coupleInfo.partnerQuizDone ? (
              <>
                <Clock className="h-5 w-5 text-primary mr-1.5" />
                <span>Waiting for Partner Quiz</span>
              </>
            ) : (
              <>
                <Heart className="h-5 w-5 text-primary fill-primary mr-1" />
                <span>Find Matches</span>
              </>
            )}
          </Button>
        </div>
      </motion.div>

      {/* Active Connections Shortcuts or Zero State Card */}
      {chats.length > 0 || activeConnections.length > 0 ? (
        <motion.div variants={itemVariants} className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5 text-[#FF5436]" />
              Active Chats ({chats.length > 0 ? chats.length : activeConnections.length})
              {totalUnreadMessages > 0 && (
                <span className="ml-1 rounded-full bg-[#FF5436] px-1.5 py-0.5 text-[10px] font-bold text-white shadow-2xs animate-pulse">
                  {totalUnreadMessages} new
                </span>
              )}
            </h3>
            <button
              onClick={() => navigate("/chats")}
              className="text-xs font-semibold text-[#FF5436] hover:underline flex items-center gap-1 cursor-pointer"
            >
              All chats <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {chats.length > 0 ? (
              chats.slice(0, 4).map((c) => {
                const isCouple = c.otherUser.user_type === "couple" && c.partnerUser;
                const displayName = isCouple
                  ? `${c.otherUser.first_name} & ${c.partnerUser?.first_name}`
                  : c.otherUser.first_name;

                return (
                  <div
                    key={c.matchId}
                    onClick={() => navigate(`/match/${c.matchId}/chat`)}
                    className={cn(
                      "flex items-center justify-between p-3.5 rounded-2xl border shadow-soft hover:shadow-card transition-all cursor-pointer",
                      c.unreadCount > 0
                        ? "bg-[#FFF5F2] border-[#FFBFAF] hover:border-[#FF5436]"
                        : "bg-white border-[#EBE3D5] hover:border-[#FF5436]/40"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="relative shrink-0">
                        <Avatar className="h-11 w-11 border border-[#FF5436]/20">
                          {c.otherUser.avatar_url && <AvatarImage src={c.otherUser.avatar_url} />}
                          <AvatarFallback className="bg-[#FFF0EB] text-[#FF5436] font-bold font-serif">
                            {c.otherUser.first_name[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-foreground truncate">{displayName}</p>
                          <Badge variant="secondary" className="bg-[#FFF0EB] text-[#FF5436] border-0 text-[10px] font-bold px-1.5 py-0 rounded-full">
                            {c.compatibilityScore}%
                          </Badge>
                        </div>
                        <p className={cn(
                          "text-xs truncate",
                          c.unreadCount > 0 ? "font-bold text-[#181513]" : "text-muted-foreground"
                        )}>
                          {c.lastMessage ? (
                            <span>
                              {c.lastMessage.isFromMe && <span className="font-normal text-muted-foreground">You: </span>}
                              {c.lastMessage.content}
                            </span>
                          ) : (
                            c.otherUser.location_city ? `📍 ${c.otherUser.location_city}` : "Mutual match · Connected"
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {c.unreadCount > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF5436] px-1.5 text-[10px] font-bold text-white shadow-2xs">
                          {c.unreadCount}
                        </span>
                      )}
                      <Button
                        size="sm"
                        className="rounded-full h-8 px-3.5 bg-[#FF5436] hover:bg-[#E03E22] text-white font-bold text-xs shadow-2xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/match/${c.matchId}/chat`);
                        }}
                      >
                        Chat
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              activeConnections.map((conn) => (
                <div
                  key={conn.matchId}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-[#EBE3D5] shadow-soft hover:border-[#FF5436]/40 hover:shadow-card transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-11 w-11 border border-[#FF5436]/20 shrink-0">
                      {conn.avatarUrl && <AvatarImage src={conn.avatarUrl} />}
                      <AvatarFallback className="bg-[#FFF0EB] text-[#FF5436] font-bold font-serif">
                        {conn.name[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-foreground truncate">{conn.name}</p>
                        <Badge variant="secondary" className="bg-[#FFF0EB] text-[#FF5436] border-0 text-[10px] font-bold px-1.5 py-0 rounded-full">
                          {conn.score}%
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {conn.city ? `📍 ${conn.city}` : "Mutual match · Connected"}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    className="rounded-full h-8 px-3.5 bg-[#FF5436] hover:bg-[#E03E22] text-white font-bold text-xs shrink-0 ml-2 shadow-2xs"
                    onClick={() => navigate(`/match/${conn.matchId}/chat`)}
                  >
                    Chat
                  </Button>
                </div>
              ))
            )}
          </div>
        </motion.div>
      ) : (
        /* Explicit Zero Active Matches UI State */
        <motion.div
          variants={itemVariants}
          className="rounded-3xl bg-white border border-[#EFE8DD] p-6 shadow-soft text-center space-y-3 relative overflow-hidden"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF0EB] text-[#FF5436]">
            <Heart className="h-6 w-6 stroke-[2]" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h4 className="font-serif font-bold text-base sm:text-lg text-foreground">No Active Matches Yet</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {stats.incomingRequests > 0
                ? `You have ${stats.incomingRequests} incoming connection request(s) waiting for your response!`
                : stats.pendingMatches > 0
                ? `You have ${stats.pendingMatches} request(s) sent and awaiting candidate response.`
                : "You haven't connected with any local members yet. Head to Discover to swipe through compatibility profiles and build your circle."}
            </p>
          </div>
          <div className="pt-1 flex flex-wrap justify-center gap-2">
            {stats.incomingRequests > 0 ? (
              <Button
                className="rounded-full bg-[#FF5436] hover:bg-[#E03E22] text-white font-bold text-xs h-10 px-5 shadow-2xs cursor-pointer"
                onClick={() => navigate("/matches?tab=discover")}
              >
                Review Received Request(s) ({stats.incomingRequests}) →
              </Button>
            ) : (
              <Button
                className="rounded-full bg-[#FF5436] hover:bg-[#E03E22] text-white font-bold text-xs h-10 px-5 shadow-2xs cursor-pointer"
                onClick={() => navigate("/matches")}
              >
                Discover Matches Now →
              </Button>
            )}
          </div>
        </motion.div>
      )}

      {/* Activity Stats Bento Grid */}
      <motion.div variants={itemVariants} className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
          Your Community Activity
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Active Matches",
              value: stats.activeMatches,
              subtext: stats.activeMatches === 0 ? "0 connected" : `${stats.activeMatches} active`,
              icon: Heart,
              color: "text-[#FF5436]",
              bg: "bg-[#FFF0EB]",
              onClick: () => navigate("/matches?tab=connected"),
            },
            {
              label: "Pending",
              value: stats.pendingMatches + stats.incomingRequests,
              subtext: `${stats.pendingMatches} sent · ${stats.incomingRequests} incoming`,
              icon: Clock,
              color: "text-[#F59E0B]",
              bg: "bg-[#FEF3C7]",
              onClick: () => {
                if (stats.incomingRequests > 0) {
                  navigate("/matches?tab=discover");
                } else {
                  navigate("/matches?tab=pending");
                }
              },
            },
            {
              label: "Met in Person",
              value: stats.successfulMeets,
              subtext: `${stats.successfulMeets} verified meets`,
              icon: CheckCircle,
              color: "text-[#10B981]",
              bg: "bg-[#D1FAE5]",
              onClick: undefined,
            },
            {
              label: "Referrals",
              value: stats.referrals,
              subtext: `${stats.referrals} friends invited`,
              icon: Users,
              color: "text-[#8B5CF6]",
              bg: "bg-[#EDE9FE]",
              onClick: () => navigate("/referral"),
            },
          ].map((s) => (
            <div
              key={s.label}
              onClick={s.onClick}
              className={cn(
                "rounded-2xl bg-card border border-[#EFE8DD] p-4 text-center shadow-soft hover:shadow-card hover:-translate-y-0.5 transition-all",
                s.onClick ? "cursor-pointer hover:border-[#FF5436]/40" : ""
              )}
            >
              <div className={`mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${s.bg} ${s.color}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <p className="text-2xl font-bold text-foreground tracking-tight">{s.value}</p>
              <p className="text-xs font-semibold text-muted-foreground mt-0.5">{s.label}</p>
              <p className="text-[10px] text-muted-foreground/80 mt-0.5 font-medium truncate">{s.subtext}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Status & Profile Health Card */}
      <motion.div variants={itemVariants}>
        <Card className="rounded-3xl border border-[#EFE8DD] shadow-soft">
          <CardHeader className="pb-3 border-b border-[#F5EDE3]">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-foreground">Account & Match Status</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs font-semibold text-primary hover:bg-[#FFF0EB]"
                onClick={() => navigate("/profile")}
              >
                Edit <Settings className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3.5 pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground font-medium">Matching Type</span>
              <Badge variant="secondary" className="capitalize font-bold rounded-full px-3">
                {profile?.user_type || "Solo"}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground font-medium">Location</span>
              <span className="text-foreground font-semibold flex items-center gap-1.5">
                <span>📍</span> {profile?.location_city || "Nearby"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground font-medium">Compatibility Quiz</span>
              <span className="text-foreground font-semibold flex items-center gap-1.5 text-emerald-600">
                <CheckCircle className="h-4 w-4 fill-emerald-100" /> Completed
              </span>
            </div>
            {qualityDisplay > 1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">Quality Multiplier</span>
                <span className="text-foreground font-bold flex items-center gap-1.5 bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full text-xs">
                  <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> {qualityDisplay.toFixed(1)}x Priority
                </span>
              </div>
            )}
            {stats.boostActive && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">Priority Boost</span>
                <Badge className="bg-primary/10 text-primary border-0 font-bold rounded-full">
                  ⚡ {stats.boostDays}d remaining
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Action Navigation Buttons */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <button
          onClick={() => navigate("/referral")}
          className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-card border border-[#EFE8DD] shadow-soft hover:shadow-card hover:border-primary/40 hover:-translate-y-0.5 transition-all text-center group"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF0EB] text-primary group-hover:scale-110 transition-transform">
            <Share2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Share Referral</p>
            <p className="text-[11px] text-muted-foreground font-medium">Get priority boosts</p>
          </div>
        </button>

        <button
          onClick={() => navigate("/history")}
          className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-card border border-[#EFE8DD] shadow-soft hover:shadow-card hover:border-primary/40 hover:-translate-y-0.5 transition-all text-center group"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-foreground group-hover:scale-110 transition-transform">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Match History</p>
            <p className="text-[11px] text-muted-foreground font-medium">View past connections</p>
          </div>
        </button>

        <button
          onClick={() => navigate("/profile")}
          className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-card border border-[#EFE8DD] shadow-soft hover:shadow-card hover:border-primary/40 hover:-translate-y-0.5 transition-all text-center group"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-foreground group-hover:scale-110 transition-transform">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Edit Preferences</p>
            <p className="text-[11px] text-muted-foreground font-medium">Radius & bio</p>
          </div>
        </button>
      </motion.div>

      {/* Couple Account Details (If Applicable) */}
      {coupleInfo?.isCouple && (
        <motion.div variants={itemVariants}>
          <Card className="rounded-3xl border border-[#EFE8DD] shadow-soft bg-white">
            <CardHeader className="pb-2 border-b border-[#F5EDE3]">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Couple Partnership
                </CardTitle>
                <Badge
                  variant={coupleInfo.isLinked ? (coupleInfo.bothQuizDone ? "default" : "secondary") : "destructive"}
                  className="text-[10px] font-bold"
                >
                  {coupleInfo.isLinked
                    ? coupleInfo.bothQuizDone
                      ? "Ready to Match"
                      : "Quiz Pending"
                    : "Step Incomplete"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">Partner</span>
                <span className="text-foreground font-bold">
                  {coupleInfo.isLinked ? `You & ${coupleInfo.partnerName || "Partner"}` : "Not linked yet"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">Partner Quiz Status</span>
                <span className="text-foreground font-semibold flex items-center gap-1">
                  {!coupleInfo.isLinked ? (
                    <span className="text-amber-600 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" /> Link required
                    </span>
                  ) : coupleInfo.bothQuizDone ? (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4 fill-emerald-100" /> Ready to match
                    </span>
                  ) : (
                    <span className="text-amber-600 flex items-center gap-1">
                      <Clock className="h-4 w-4" /> Waiting for partner quiz
                    </span>
                  )}
                </span>
              </div>

              {!coupleInfo.isLinked && (
                <div className="pt-2 border-t border-[#F5EDE3] flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Code: <strong className="font-mono text-foreground">{coupleInfo.inviteCode}</strong></span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full text-xs font-bold border-[#FFD9CE] h-8"
                    onClick={handleCopyCoupleCode}
                  >
                    <Copy className="h-3 w-3 mr-1" /> Copy Code
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Safety & Comfort Footer */}
      <motion.div variants={itemVariants} className="pt-2 text-center">
        <button
          onClick={() => navigate("/safety")}
          className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-card border border-[#EFE8DD] shadow-2xs"
        >
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span>Safety Guidelines & Meeting Safely IRL</span>
        </button>
      </motion.div>

      {/* Sign Out (mobile only; desktop has sidebar) */}
      <motion.div variants={itemVariants} className="md:hidden pt-2">
        <Button variant="outline" className="w-full h-11 rounded-full font-bold" onClick={signOut}>
          Sign Out
        </Button>
      </motion.div>
      </motion.div>
    </PullToRefresh>
  );
};

export default Dashboard;
