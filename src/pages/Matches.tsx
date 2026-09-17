import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  X,
  Check,
  MapPin,
  Navigation,
  Users,
  User,
  Loader2,
  Share2,
  Sparkles,
  Heart,
  Copy,
  Clock,
  Lock,
  Unlock,
  CheckCircle2,
  ShieldCheck,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  WifiOff,
} from "lucide-react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer,
} from "recharts";
import { DIMENSION_LABELS, getTopSharedVibes, getCandidateDisplayName } from "@/lib/matchUtils";
import { calculateDistanceKm } from "@/lib/postalCodeUtils";
import { AnimatePresence } from "framer-motion";
import { getCouplePartnerId } from "@/lib/coupleUtils";
import { MatchSynergyCard } from "@/components/MatchSynergyCard";
import { MatchCard, MatchCardItem } from "@/components/MatchCard";
import { CompatibilityScoreMeter } from "@/components/CompatibilityScoreMeter";
import { MatchesSkeleton } from "@/components/MatchesSkeleton";
import { cn } from "@/lib/utils";
import {
  fetchMatchesWithFallback,
  executeMatchAction,
  resetSwipedMatches,
  MatchData,
  MatchesResult,
} from "@/lib/matchEngine";
import { useChatSummary } from "@/hooks/useChatSummary";

const Matches = () => {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [acting, setActing] = useState(false);
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") as "discover" | "received" | "pending" | "connected" | null;
  const [activeTab, setActiveTab] = useState<"discover" | "received" | "pending" | "connected">(
    initialTab && ["discover", "received", "pending", "connected"].includes(initialTab) ? initialTab : "discover"
  );
  const hasAutoDefaultedTabRef = useRef(false);

  // Optimistic queue removal state for instant, dynamic transitions
  const [optimisticallyRemovedIds, setOptimisticallyRemovedIds] = useState<Set<string>>(new Set());
  const [optimisticPendingMatches, setOptimisticPendingMatches] = useState<MatchData[]>([]);
  const [optimisticConnectedMatches, setOptimisticConnectedMatches] = useState<MatchCardItem[]>([]);

  // Keep activeTab in sync whenever the URL tab query param changes (e.g. clicking Review Requests from Dashboard)
  useEffect(() => {
    const tabParam = searchParams.get("tab") as "discover" | "received" | "pending" | "connected" | null;
    if (tabParam && ["discover", "received", "pending", "connected"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Hook into useChatSummary to guarantee 100% synchronization with the sidebar badge and dashboard alert banner
  const { incomingRequests } = useChatSummary();

  // Fetch current user profile to compare location/postal code
  const { data: myProfile } = useQuery({
    queryKey: ["my-profile-location", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, user_type, location_city, travel_radius_km, quiz_completed")
        .eq("id", user?.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  // If current user is a couple, fetch their partner's name for joint display
  const { data: myCouplePartner } = useQuery({
    queryKey: ["my-couple-partner", user?.id, myProfile?.user_type],
    queryFn: async () => {
      if (!user || myProfile?.user_type !== "couple") return null;
      const partnerId = await getCouplePartnerId(user.id);
      if (!partnerId) return null;
      const { data: p } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", partnerId)
        .maybeSingle();
      return p;
    },
    enabled: !!user && myProfile?.user_type === "couple",
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading, error } = useQuery<MatchesResult>({
    queryKey: ["matches", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not signed in");
      return await fetchMatchesWithFallback(user.id, session);
    },
    enabled: !!user,
    staleTime: 10 * 1000,
    refetchInterval: (query) => {
      const res = query.state.data as MatchesResult | undefined;
      // Fast polling (4s) if a connection request is pending, otherwise periodic (15s) background poll
      return res?.pending_match ? 4000 : 15000;
    },
    refetchIntervalInBackground: false,
  });

  // Unified incoming connection requests (merges matchEngine data + useChatSummary to prevent any dropped requests)
  const incomingMatches = useMemo(() => {
    const map = new Map<string, MatchData>();

    // 1. From matchEngine's incoming_matches list
    (data?.incoming_matches || []).forEach((m) => {
      const key = m.pending_match_id || m.user_id;
      if (!optimisticallyRemovedIds.has(m.user_id) && !optimisticallyRemovedIds.has(key)) {
        map.set(key, m);
      }
    });

    // 2. From data?.matches where has_incoming_request flag is true
    (data?.matches || []).filter((m) => m.has_incoming_request).forEach((m) => {
      const key = m.pending_match_id || m.user_id;
      if (!map.has(key) && !optimisticallyRemovedIds.has(m.user_id) && !optimisticallyRemovedIds.has(key)) {
        map.set(key, m);
      }
    });

    // 3. From useChatSummary incomingRequests (guarantees parity with sidebar badge and dashboard alert banner)
    (incomingRequests || []).forEach((req) => {
      const key = req.matchId || req.otherUser.id;
      if (
        !map.has(key) &&
        !map.has(req.otherUser.id) &&
        !optimisticallyRemovedIds.has(req.otherUser.id) &&
        !optimisticallyRemovedIds.has(key)
      ) {
        const myDims = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3];
        const matchObj: MatchData = {
          user_id: req.otherUser.id,
          first_name: req.otherUser.first_name || "Community Member",
          user_type: (req.otherUser.user_type as any) || myProfile?.user_type || "solo",
          location_city: req.otherUser.location_city || myProfile?.location_city || null,
          travel_radius_km: 15,
          score: req.score || 91,
          dimensions: myDims,
          my_dimensions: myDims,
          has_incoming_request: true,
          pending_match_id: req.matchId,
        };
        map.set(key, matchObj);
      }
    });

    return Array.from(map.values());
  }, [data?.incoming_matches, data?.matches, incomingRequests, myProfile, optimisticallyRemovedIds]);

  // Track the currently viewed request when viewing the Received tab (one at a time)
  const [receivedIndex, setReceivedIndex] = useState(0);
  const currentReceivedMatch = useMemo(() => {
    if (incomingMatches.length === 0) return null;
    const safeIdx = Math.min(Math.max(0, receivedIndex), incomingMatches.length - 1);
    return incomingMatches[safeIdx];
  }, [incomingMatches, receivedIndex]);

  const receivedVibes = useMemo(() => {
    return currentReceivedMatch ? getTopSharedVibes(currentReceivedMatch.my_dimensions, currentReceivedMatch.dimensions) : [];
  }, [currentReceivedMatch]);

  // Auto-route to Received tab when there are incoming connection requests waiting,
  // unless the user explicitly specified a tab parameter in the URL.
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (!tabParam && !hasAutoDefaultedTabRef.current && incomingMatches.length > 0) {
      setActiveTab("received");
      hasAutoDefaultedTabRef.current = true;
    }
  }, [incomingMatches.length, searchParams]);

  // Fetch established mutual connections to demonstrate explicit first names once connected
  const { data: mutualMatches = [] } = useQuery<MatchCardItem[]>({
    queryKey: ["mutual-matches-list", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const partnerId = myProfile?.user_type === "couple" ? await getCouplePartnerId(user.id) : null;
      const filter = partnerId
        ? `user_a_id.eq.${user.id},user_b_id.eq.${user.id},user_a_id.eq.${partnerId},user_b_id.eq.${partnerId}`
        : `user_a_id.eq.${user.id},user_b_id.eq.${user.id}`;

      const { data: mList } = await supabase
        .from("matches")
        .select("id, status, user_a_id, user_b_id, compatibility_score, created_at")
        .eq("status", "mutual")
        .or(filter)
        .order("created_at", { ascending: false });

      if (!mList || mList.length === 0) return [];

      const otherIds = mList.map((m) => (m.user_a_id === user.id || (partnerId && m.user_a_id === partnerId) ? m.user_b_id : m.user_a_id));
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, first_name, avatar_url, location_city, user_type")
        .in("id", otherIds);

      const profMap = new Map((profs || []).map((p) => [p.id, p]));

      // For couples, fetch their partner's first name
      const coupleIds = (profs || []).filter((p) => p.user_type === "couple").map((p) => p.id);
      const couplePartnerMap = new Map<string, string>();
      if (coupleIds.length > 0) {
        const { data: couples } = await supabase
          .from("couples")
          .select("partner_a_id, partner_b_id")
          .or(coupleIds.map((id) => `partner_a_id.eq.${id},partner_b_id.eq.${id}`).join(","));

        if (couples && couples.length > 0) {
          const partnerUserIds = couples
            .map((c) => (coupleIds.includes(c.partner_a_id) ? c.partner_b_id : c.partner_a_id))
            .filter(Boolean);
          if (partnerUserIds.length > 0) {
            const { data: partnerProfs } = await supabase
              .from("profiles")
              .select("id, first_name")
              .in("id", partnerUserIds);
            const pMap = new Map((partnerProfs || []).map((p) => [p.id, p.first_name]));
            couples.forEach((c) => {
              const candidateId = coupleIds.includes(c.partner_a_id) ? c.partner_a_id : c.partner_b_id;
              const otherPartnerId = c.partner_a_id === candidateId ? c.partner_b_id : c.partner_a_id;
              const name = pMap.get(otherPartnerId);
              if (name) couplePartnerMap.set(candidateId, name);
            });
          }
        }
      }

      return mList.map((m) => {
        const otherId = m.user_a_id === user.id || (partnerId && m.user_a_id === partnerId) ? m.user_b_id : m.user_a_id;
        const pr = profMap.get(otherId);
        const partnerName = couplePartnerMap.get(otherId) || null;
        return {
          match_id: m.id,
          user_id: otherId,
          first_name: pr?.first_name || "Match",
          partner_first_name: partnerName,
          user_type: (pr?.user_type as "solo" | "couple") || "solo",
          location_city: pr?.location_city || null,
          avatar_url: pr?.avatar_url || null,
          score: m.compatibility_score || 91,
          status: "mutual",
        };
      });
    },
    enabled: !!user,
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });

  const handleAction = useCallback((match: MatchData, action: "accept" | "pass") => {
    if (!user) return;

    const isIncoming = Boolean(match.has_incoming_request || match.pending_match_id);

    // 1. Immediately remove candidate from discovery queue and update respective list optimistically
    setOptimisticallyRemovedIds((prev) => {
      const next = new Set(prev);
      next.add(match.user_id);
      if (match.pending_match_id) next.add(match.pending_match_id);
      return next;
    });

    if (action === "accept" && !isIncoming) {
      setOptimisticPendingMatches((prev) => {
        if (prev.some((p) => p.user_id === match.user_id)) return prev;
        return [match, ...prev];
      });
      toast({
        title: "Connection Request Sent! ✨",
        description: "Names and profiles remain completely blind until they connect back too.",
      });
    } else if (action === "accept" && isIncoming) {
      setOptimisticConnectedMatches((prev) => {
        const item: MatchCardItem = {
          match_id: match.pending_match_id || `optimistic_${Date.now()}`,
          user_id: match.user_id,
          first_name: match.first_name || "Match",
          partner_first_name: null,
          user_type: (match.user_type as "solo" | "couple") || "solo",
          location_city: match.location_city || null,
          avatar_url: null,
          score: match.score || 90,
          status: "mutual",
        };
        if (prev.some((p) => p.user_id === match.user_id)) return prev;
        return [item, ...prev];
      });
    }

    // 2. Perform backend persistence silently in background without blocking UI thread
    executeMatchAction(
      match.user_id,
      action,
      session,
      match.score,
      match.pending_match_id,
      isIncoming
    )
      .then(({ match_id, status }) => {
        const resolvedMatchId = match_id || match.pending_match_id;

        if (status === "mutual" || (action === "accept" && isIncoming)) {
          toast({
            title: "It's a Mutual Match! 🎉",
            description: "You both connected! Unlocking your match reveal and chat...",
          });
          queryClient.invalidateQueries({ queryKey: ["matches"] });
          queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
          queryClient.invalidateQueries({ queryKey: ["mutual-matches-list"] });
          queryClient.invalidateQueries({ queryKey: ["chat-summary"] });
          if (resolvedMatchId) {
            navigate(`/match-reveal/${resolvedMatchId}`);
          } else {
            setActiveTab("connected");
          }
        } else {
          // Quiet background cache sync
          queryClient.invalidateQueries({ queryKey: ["matches"] });
          queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
          queryClient.invalidateQueries({ queryKey: ["mutual-matches-list"] });
          queryClient.invalidateQueries({ queryKey: ["chat-summary"] });
        }
      })
      .catch((err: any) => {
        // Revert optimistic state only on error
        setOptimisticallyRemovedIds((prev) => {
          const next = new Set(prev);
          next.delete(match.user_id);
          if (match.pending_match_id) next.delete(match.pending_match_id);
          return next;
        });
        setOptimisticPendingMatches((prev) => prev.filter((p) => p.user_id !== match.user_id));
        setOptimisticConnectedMatches((prev) => prev.filter((p) => p.user_id !== match.user_id));
        toast({ title: "Error", description: err.message || "Failed to update match", variant: "destructive" });
      });
  }, [user, session, queryClient, navigate]);

  // Real-time listener: detects backend status transitions (e.g. pending -> mutual)
  // and updates the UI immediately showing the match's profile details and name
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`matches-live-updates-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
        },
        async (payload) => {
          const newRow = payload.new as any;
          if (!newRow) return;

          const isUserMatch =
            newRow.user_a_id === user.id ||
            newRow.user_b_id === user.id ||
            (myCouplePartner?.id &&
              (newRow.user_a_id === myCouplePartner.id || newRow.user_b_id === myCouplePartner.id));

          if (isUserMatch) {
            // Trigger automatic UI refresh across all match-related queries
            queryClient.invalidateQueries({ queryKey: ["matches"] });
            queryClient.invalidateQueries({ queryKey: ["mutual-matches-list"] });
            queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });

            // If the state transitioned from pending to mutual, inform user and highlight unlocked details
            if (newRow.status === "mutual") {
              const otherUserId = newRow.user_a_id === user.id ? newRow.user_b_id : newRow.user_a_id;
              const { data: otherProfile } = await supabase
                .from("profiles")
                .select("first_name")
                .eq("id", otherUserId)
                .maybeSingle();

              const otherName = otherProfile?.first_name || "Your match";
              toast({
                title: "It's a Mutual Match! 🎉",
                description: `${otherName} accepted your connection! First name and profile details are now unlocked.`,
              });

              // Automatically switch to connected tab to immediately display the match's profile details & name
              setActiveTab("connected");
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, myCouplePartner, queryClient]);

  const pendingMatches = useMemo(() => {
    const fromServer = data?.pending_matches || [];
    const fromServerIds = new Set(fromServer.map((m) => m.user_id));
    const extra = optimisticPendingMatches.filter(
      (m) => !fromServerIds.has(m.user_id) && !optimisticallyRemovedIds.has(m.user_id)
    );
    return [...extra, ...fromServer];
  }, [data?.pending_matches, optimisticPendingMatches, optimisticallyRemovedIds]);

  const effectiveMutualMatches = useMemo(() => {
    const serverIds = new Set((mutualMatches || []).map((m) => m.user_id));
    const extra = optimisticConnectedMatches.filter((m) => !serverIds.has(m.user_id));
    return [...extra, ...(mutualMatches || [])];
  }, [mutualMatches, optimisticConnectedMatches]);

  // Strictly for discovering new people who haven't connected or requested yet
  const matchesList = useMemo(() => {
    const queueMap = new Map<string, MatchData>();

    const incomingUserIds = new Set(incomingMatches.map((m) => m.user_id));
    const pendingUserIds = new Set(pendingMatches.map((m) => m.user_id));
    const mutualUserIds = new Set(effectiveMutualMatches.map((m) => m.user_id));

    if (data?.matches && data.matches.length > 0) {
      // Exclude any candidates with incoming requests, pending requests, or existing mutual connections
      const candidates = data.matches.filter((m) => {
        if (optimisticallyRemovedIds.has(m.user_id)) return false;
        if (m.pending_match_id && optimisticallyRemovedIds.has(m.pending_match_id)) return false;
        if (m.has_incoming_request || m.pending_match_id) return false;
        if (incomingUserIds.has(m.user_id)) return false;
        if (pendingUserIds.has(m.user_id)) return false;
        if (mutualUserIds.has(m.user_id)) return false;

        // Couple vs solo filtering
        if (myProfile?.user_type === "couple") {
          return m.user_type === "couple";
        }
        if (myProfile?.user_type === "solo") {
          return m.user_type === "solo" || !m.user_type;
        }
        return true;
      });

      candidates.forEach((cand) => {
        if (!queueMap.has(cand.user_id)) {
          queueMap.set(cand.user_id, cand);
        }
      });
    }

    const allCandidates = Array.from(queueMap.values());
    if (allCandidates.length === 0) return [];

    return allCandidates.sort((a, b) => {
      if (!myProfile?.location_city) return b.score - a.score;

      const distA = calculateDistanceKm(myProfile.location_city, a.location_city);
      const distB = calculateDistanceKm(myProfile.location_city, b.location_city);
      const aNear = distA !== null && distA <= 5.0;
      const bNear = distB !== null && distB <= 5.0;

      // 5 km neighborhood matches prioritized at the front
      if (aNear && !bNear) return -1;
      if (!aNear && bNear) return 1;

      // If both are nearby or both are far, closer distance first
      if (aNear && bNear && distA !== null && distB !== null) {
        return distA - distB;
      }

      return b.score - a.score;
    });
  }, [incomingMatches, pendingMatches, effectiveMutualMatches, data?.matches, myProfile?.location_city, myProfile?.user_type, optimisticallyRemovedIds]);

  const currentMatch = matchesList[0];

  // If the candidate is also a couple, fetch their partner profile
  const { data: candidatePartnerProfile } = useQuery({
    queryKey: ["candidate-partner", currentMatch?.user_id, currentMatch?.user_type],
    queryFn: async () => {
      if (!currentMatch || currentMatch.user_type !== "couple") return null;

      // Try RPC first for security-definer access
      const { data: rpcPartner } = await supabase
        .rpc("get_candidate_couple_partner", { _user_id: currentMatch.user_id })
        .maybeSingle();

      if (rpcPartner && (rpcPartner as any).first_name) {
        return rpcPartner as { id: string; first_name: string; avatar_url?: string };
      }

      const { data: couple } = await supabase
        .from("couples")
        .select("partner_a_id, partner_b_id")
        .or(`partner_a_id.eq.${currentMatch.user_id},partner_b_id.eq.${currentMatch.user_id}`)
        .maybeSingle();

      if (!couple || !couple.partner_b_id) return null;
      const pId = couple.partner_a_id === currentMatch.user_id ? couple.partner_b_id : couple.partner_a_id;
      if (!pId) return null;

      const { data: p } = await supabase
        .from("profiles")
        .select("id, first_name, avatar_url")
        .eq("id", pId)
        .maybeSingle();
      return p;
    },
    enabled: !!currentMatch && currentMatch.user_type === "couple",
    staleTime: 5 * 60 * 1000,
  });

  const matchDisplayName = useMemo(() => {
    if (!currentMatch) return "";
    if (currentMatch.user_type === "couple" && candidatePartnerProfile?.first_name) {
      return `${currentMatch.first_name} & ${candidatePartnerProfile.first_name}`;
    }
    return currentMatch.first_name;
  }, [currentMatch, candidatePartnerProfile]);

  const myDisplayName = useMemo(() => {
    if (myProfile?.user_type === "couple" && myCouplePartner?.first_name) {
      return `${myProfile.first_name} & ${myCouplePartner.first_name}`;
    }
    return myProfile?.first_name || "You";
  }, [myProfile, myCouplePartner]);

  const vibes = useMemo(() => {
    return currentMatch ? getTopSharedVibes(currentMatch.my_dimensions, currentMatch.dimensions) : [];
  }, [currentMatch]);

  const radarData = useMemo(() => {
    return currentMatch
      ? DIMENSION_LABELS.map((label, i) => ({
          dimension: label,
          You: currentMatch.my_dimensions[i],
          Match: currentMatch.dimensions[i],
        }))
      : [];
  }, [currentMatch]);

  // Track previous match IDs to subtly notify the user when background polling detects new matches
  const previousMatchIdsRef = useRef<string[]>([]);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (!data?.matches) return;
    const currentIds = matchesList.map((m) => m.user_id);

    if (isInitialLoadRef.current) {
      previousMatchIdsRef.current = currentIds;
      isInitialLoadRef.current = false;
      return;
    }

    const previousIds = previousMatchIdsRef.current;
    const newMatches = currentIds.filter((id) => !previousIds.includes(id));
    if (newMatches.length > 0) {
      toast({
        title: "✨ New Match Discovered!",
        description: `${newMatches.length} new compatible candidate${newMatches.length > 1 ? "s" : ""} added to your queue.`,
      });
    }

    previousMatchIdsRef.current = currentIds;
  }, [matchesList, data?.matches]);

  // Desktop keyboard shortcuts: C or Right Arrow to Connect, P or Left Arrow or Esc to Pass
  useEffect(() => {
    if (!currentMatch || acting) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      if (e.key === "c" || e.key === "C" || e.key === "ArrowRight") {
        e.preventDefault();
        handleAction(currentMatch, "accept");
      } else if (e.key === "p" || e.key === "P" || e.key === "ArrowLeft" || e.key === "Escape") {
        e.preventDefault();
        handleAction(currentMatch, "pass");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentMatch, acting, handleAction]);

  const isOffline = typeof navigator !== "undefined" ? !navigator.onLine : false;

  if (isLoading) {
    return <MatchesSkeleton />;
  }

  if (error && !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center bg-background px-4 text-center">
        <div className="h-12 w-12 rounded-2xl bg-[#FFEFEA] flex items-center justify-center text-[#FF5436] mb-3">
          <WifiOff className="h-6 w-6" />
        </div>
        <h3 className="font-serif text-lg font-bold text-[#1A1816]">Unable to reach matchmaking</h3>
        <p className="text-xs text-[#706A62] mt-1 max-w-sm mb-4">
          {isOffline
            ? "Your device appears to be offline. Reconnect to sync fresh community members or view your cached profile."
            : "We encountered a temporary connection issue. Please check your connection and retry."}
        </p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["matches"] })}>
          Retry
        </Button>
      </div>
    );
  }

  if (data?.quiz_needed && myProfile?.quiz_completed === false) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md rounded-3xl border border-[#EFE8DD] shadow-card bg-white overflow-hidden text-center p-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF0EB] text-primary shadow-xs mb-3 mx-auto">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-foreground mb-2">
            Complete Your Compatibility Quiz
          </h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Take our 10-dimension compatibility quiz so we can calculate authentic compatibility scores and suggest genuine matches.
          </p>
          <Button
            className="rounded-full h-12 w-full font-bold"
            onClick={() => navigate("/quiz")}
          >
            Take the Quiz
          </Button>
        </Card>
      </div>
    );
  }

  if (data?.waiting_for_partner || (myProfile?.user_type === "couple" && !myCouplePartner)) {
    const isPartnerNeeded = data?.partner_needed || (myProfile?.user_type === "couple" && !myCouplePartner);
    const inviteCode = data?.invite_code;

    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md rounded-3xl border border-[#EFE8DD] shadow-card bg-white overflow-hidden">
          <div className="bg-gradient-to-b from-[#FFF5F1] to-white p-8 text-center border-b border-[#F5EDE3]">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF0EB] text-primary shadow-xs mb-3">
              {data?.partner_quiz_pending ? (
                <Clock className="h-8 w-8 text-[#F59E0B]" />
              ) : (
                <Users className="h-8 w-8 text-primary" />
              )}
            </div>
            <h2 className="font-serif text-2xl font-bold text-foreground">
              {isPartnerNeeded
                ? "Invite Your Partner to Match"
                : data?.partner_quiz_pending
                ? "Waiting for Partner's Quiz"
                : "Waiting for Your Partner"}
            </h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto leading-relaxed">
              {isPartnerNeeded
                ? "You're registered as a Couple! Both partners need to link accounts and complete the quiz before couple matches can begin."
                : data?.partner_quiz_pending
                ? "Your partner has joined! As soon as they complete their 10-dimension compatibility quiz, your couple matches will activate."
                : "Both partners need to complete their compatibility quiz before we can find couple matches for you."}
            </p>
          </div>

          <CardContent className="space-y-4 p-6 text-center">
            {inviteCode && (
              <div className="rounded-2xl bg-[#FFF8F5] border border-[#FFD9CE] p-4 text-left space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Couple Invite Code
                  </span>
                  <span className="text-[11px] text-primary font-semibold">Share with partner</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-xl bg-white border border-[#FFD9CE] px-3 py-2 font-mono text-base font-bold tracking-wider text-center text-[#1A1816]">
                    {inviteCode}
                  </div>
                  <Button
                    size="sm"
                    className="rounded-xl px-4 font-bold"
                    onClick={() => {
                      navigator.clipboard.writeText(inviteCode);
                      toast({ title: "Copied!", description: "Invite code copied to clipboard." });
                    }}
                  >
                    <Copy className="h-4 w-4 mr-1.5" /> Copy
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2.5 pt-1">
              {isPartnerNeeded && (
                <Button
                  className="rounded-full h-12 w-full font-bold"
                  onClick={() => navigate("/onboarding/couple-setup")}
                >
                  <Users className="h-4 w-4 mr-2" /> Go to Couple Setup
                </Button>
              )}
              <Button
                variant="outline"
                className="rounded-full h-12 w-full font-semibold"
                onClick={() => navigate("/dashboard")}
              >
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col bg-[#FAF7F2] dark:bg-background px-4 sm:px-6 lg:px-8 py-5 lg:py-6 min-h-full">
      <div className="w-full max-w-6xl mx-auto flex flex-col space-y-5">
        {/* Top Header Bar with View Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1816] tracking-tight">Matches</h1>
            <p className="text-xs text-[#706A62] mt-0.5">
              Curated friendship recommendations based on lifestyle rhythms and quiz traits
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* View Switcher: Discover vs Received vs Sent vs Connected */}
            <div className="flex items-center p-1 bg-[#EFE8DD]/70 rounded-full border border-[#E5DDD0]">
              <button
                type="button"
                onClick={() => setActiveTab("discover")}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5",
                  activeTab === "discover"
                    ? "bg-white text-foreground shadow-2xs"
                    : "text-[#706A62] hover:text-foreground"
                )}
              >
                <span>Discover</span>
                {matchesList.length > 0 && (
                  <span className="h-4 min-w-4 px-1 rounded-full bg-[#FF5436] text-white text-[10px] font-bold inline-flex items-center justify-center">
                    {matchesList.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("received")}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 relative",
                  activeTab === "received"
                    ? "bg-white text-foreground shadow-2xs"
                    : "text-[#706A62] hover:text-foreground"
                )}
              >
                <span>Received</span>
                {incomingMatches.length > 0 && (
                  <span className="h-4 min-w-4 px-1.5 rounded-full bg-primary text-white text-[10px] font-bold inline-flex items-center justify-center animate-pulse">
                    {incomingMatches.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("pending")}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5",
                  activeTab === "pending"
                    ? "bg-white text-foreground shadow-2xs"
                    : "text-[#706A62] hover:text-foreground"
                )}
              >
                <span>Sent</span>
                {pendingMatches.length > 0 && (
                  <span className="h-4 min-w-4 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold inline-flex items-center justify-center">
                    {pendingMatches.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("connected")}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5",
                  activeTab === "connected"
                    ? "bg-white text-foreground shadow-2xs"
                    : "text-[#706A62] hover:text-foreground"
                )}
              >
                <span>Connected</span>
                {effectiveMutualMatches.length > 0 && (
                  <span className="h-4 min-w-4 px-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold inline-flex items-center justify-center">
                    {effectiveMutualMatches.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* TAB 1: CONNECTED MATCHES - Explicitly display first names once connection is established */}
        {activeTab === "connected" && (
          <div className="flex-1 overflow-y-auto pt-2">
            {effectiveMutualMatches.length === 0 ? (
              <Card className="rounded-3xl border border-[#EFE8DD] shadow-card bg-white p-8 text-center max-w-md mx-auto my-8">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ECFDF5] text-emerald-600 mb-3 mx-auto">
                  <Lock className="h-7 w-7" />
                </div>
                <h2 className="font-serif text-xl font-bold text-foreground mb-1.5">No Connected Matches Yet</h2>
                <p className="text-xs text-muted-foreground leading-relaxed mb-5">
                  When you and another member accept each other, the connection is established and their real first name, profile, and chat will unlock right here!
                </p>
                <Button
                  onClick={() => setActiveTab("discover")}
                  className="rounded-full font-bold bg-[#FF5436] hover:bg-[#E84326] text-white"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Discover Candidate Vibes
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] p-4 text-xs text-[#065F46] flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>
                      <strong>Mutual Connections Established:</strong> First names and verified profiles are fully unlocked for your confirmed matches.
                    </span>
                  </div>
                  <Badge className="bg-emerald-600 text-white font-bold">{effectiveMutualMatches.length} Connected</Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
                  {effectiveMutualMatches.map((m) => (
                    <MatchCard
                      key={m.match_id || m.user_id}
                      match={m}
                      isConnected={true}
                      myCity={myProfile?.location_city}
                      onOpenChat={(mId) => navigate(`/match/${mId}/chat`)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: RECEIVED REQUESTS - Requests from other members waiting for you to connect back */}
        {activeTab === "received" && (
          <div className="flex-1 pt-1 space-y-4">
            {incomingMatches.length === 0 ? (
              <Card className="rounded-3xl border border-[#EFE8DD] shadow-card bg-white p-8 text-center max-w-md mx-auto my-8">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF0EB] text-primary mb-3 mx-auto">
                  <Sparkles className="h-7 w-7" />
                </div>
                <h2 className="font-serif text-xl font-bold text-foreground mb-1.5">No Incoming Requests Right Now</h2>
                <p className="text-xs text-muted-foreground leading-relaxed mb-5">
                  When compatible members discover your profile and send a connection request, they will appear here so you can connect back with a single click.
                </p>
                <Button
                  onClick={() => setActiveTab("discover")}
                  className="rounded-full font-bold bg-[#FF5436] hover:bg-[#E84326] text-white"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Explore Discover Queue
                </Button>
              </Card>
            ) : currentReceivedMatch ? (
              <div className="space-y-4 pb-8 flex-1 flex flex-col min-h-0">
                {/* Stepper Navigation Bar when reviewing incoming requests */}
                <div className="flex items-center justify-between px-1 shrink-0 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-sm flex items-center gap-1.5">
                      <Heart className="h-4 w-4 text-primary fill-primary" />
                      <span>Request {Math.min(receivedIndex + 1, incomingMatches.length)} of {incomingMatches.length}</span>
                    </span>
                    <Badge variant="outline" className="bg-[#FFF4F0] border-[#FFD9CE] text-primary font-semibold text-[10px] py-0.5">
                      Awaiting Your Response
                    </Badge>
                  </div>

                  {incomingMatches.length > 1 && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-full border-[#EFE8DD] hover:bg-[#FFF0EB] text-foreground disabled:opacity-30"
                        disabled={receivedIndex <= 0}
                        onClick={() => setReceivedIndex((prev) => Math.max(0, prev - 1))}
                        title="Previous request"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-xs text-muted-foreground font-medium px-1">
                        {receivedIndex + 1} / {incomingMatches.length}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-full border-[#EFE8DD] hover:bg-[#FFF0EB] text-foreground disabled:opacity-30"
                        disabled={receivedIndex >= incomingMatches.length - 1}
                        onClick={() => setReceivedIndex((prev) => Math.min(incomingMatches.length - 1, prev + 1))}
                        title="Next request"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Single Focused Request View with Compatibility Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
                  {/* LEFT COLUMN: Modular MatchCard with Connect Back & Pass */}
                  <div className="lg:col-span-5 flex flex-col relative">
                    <MatchCard
                      key={currentReceivedMatch.pending_match_id || currentReceivedMatch.user_id}
                      match={currentReceivedMatch}
                      isConnected={false}
                      myCity={myProfile?.location_city}
                      candidatePartnerName={undefined}
                      vibes={receivedVibes}
                      userName={myProfile?.user_type === "couple" ? "Your Duo" : "You"}
                      onConnect={() => {
                        handleAction(currentReceivedMatch, "accept");
                      }}
                      onPass={() => {
                        handleAction(currentReceivedMatch, "pass");
                      }}
                      acting={acting}
                      enableSwipe={false}
                      className="w-full"
                    />
                  </div>

                  {/* RIGHT COLUMN: Compatibility Breakdown for this Candidate */}
                  <div className="lg:col-span-7 flex flex-col gap-4">
                    <CompatibilityScoreMeter
                      key={`received-score-meter-${currentReceivedMatch.pending_match_id || currentReceivedMatch.user_id}`}
                      myDimensions={currentReceivedMatch.my_dimensions}
                      candidateDimensions={currentReceivedMatch.dimensions}
                      fallbackScore={currentReceivedMatch.score}
                    />

                    {/* Compatibility Dimensions Radar Chart */}
                    <div
                      key={`received-radar-${currentReceivedMatch.pending_match_id || currentReceivedMatch.user_id}`}
                      className="rounded-[28px] border border-[#EFE8DD] shadow-card bg-white p-4 sm:p-5"
                    >
                      <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
                        <div>
                          <h3 className="font-serif font-bold text-base text-[#1A1816]">Compatibility Dimensions</h3>
                          <p className="text-[11px] text-muted-foreground">Overlap across 5 core social pacing dimensions</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-semibold">
                          <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-[#FF5436]" />
                            <span className="text-[#1A1816]">{myProfile?.user_type === "couple" ? "Your Duo" : "You"}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />
                            <span className="text-[#1A1816] flex items-center gap-1">
                              <span>Candidate</span>
                              <ShieldCheck className="h-2.5 w-2.5 text-primary" />
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="h-[220px] w-full mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart
                            data={[
                              { subject: "Social Energy", you: currentReceivedMatch.my_dimensions[0] || 3, candidate: currentReceivedMatch.dimensions[0] || 3 },
                              { subject: "Budget", you: currentReceivedMatch.my_dimensions[1] || 3, candidate: currentReceivedMatch.dimensions[1] || 3 },
                              { subject: "Spontaneity", you: currentReceivedMatch.my_dimensions[2] || 3, candidate: currentReceivedMatch.dimensions[2] || 3 },
                              { subject: "Planning", you: currentReceivedMatch.my_dimensions[3] || 3, candidate: currentReceivedMatch.dimensions[3] || 3 },
                              { subject: "Intellectual", you: currentReceivedMatch.my_dimensions[4] || 3, candidate: currentReceivedMatch.dimensions[4] || 3 },
                              { subject: "Activity", you: currentReceivedMatch.my_dimensions[5] || 3, candidate: currentReceivedMatch.dimensions[5] || 3 },
                              { subject: "Alcohol/Night", you: currentReceivedMatch.my_dimensions[6] || 3, candidate: currentReceivedMatch.dimensions[6] || 3 },
                              { subject: "Humor", you: currentReceivedMatch.my_dimensions[7] || 3, candidate: currentReceivedMatch.dimensions[7] || 3 },
                              { subject: "Commitment", you: currentReceivedMatch.my_dimensions[8] || 3, candidate: currentReceivedMatch.dimensions[8] || 3 },
                              { subject: "Home/Private", you: currentReceivedMatch.my_dimensions[9] || 3, candidate: currentReceivedMatch.dimensions[9] || 3 },
                            ]}
                          >
                            <PolarGrid stroke="#EFE8DD" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: "#706A62", fontSize: 10 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                            <Radar name="You" dataKey="you" stroke="#FF5436" fill="#FF5436" fillOpacity={0.25} />
                            <Radar name="Candidate" dataKey="candidate" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.25} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* TAB 2: PENDING MATCHES (SENT) */}
        {activeTab === "pending" && (
          <div className="flex-1 overflow-y-auto pt-2 space-y-4">
            <div className="rounded-2xl bg-[#FFF9F6] border border-[#FFD9CE] p-3.5 text-xs text-[#7A3E2D] flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary shrink-0" />
                <span>
                  <strong>Pending Requests:</strong> Awaiting candidate response. First names and direct chat unlock upon mutual acceptance.
                </span>
              </div>
              <Badge variant="outline" className="bg-white border-[#FFD9CE] text-primary font-bold text-xs">
                {pendingMatches.length} Sent
              </Badge>
            </div>

            {pendingMatches.length === 0 ? (
              <Card className="rounded-3xl border border-[#EFE8DD] shadow-card bg-white p-8 text-center max-w-md mx-auto my-8">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF0EB] text-primary mb-3 mx-auto">
                  <Clock className="h-7 w-7" />
                </div>
                <h2 className="font-serif text-xl font-bold text-foreground mb-1.5">No Pending Requests</h2>
                <p className="text-xs text-muted-foreground leading-relaxed mb-5">
                  When you send a connection request to candidates in Discover, you can track candidate response status right here.
                </p>
                <Button
                  onClick={() => setActiveTab("discover")}
                  className="rounded-full font-bold bg-[#FF5436] hover:bg-[#E84326] text-white"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Discover Candidates
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
                {pendingMatches.map((m) => {
                  const mDist = calculateDistanceKm(myProfile?.location_city, m.location_city);
                  const mVibes = getTopSharedVibes(m.my_dimensions, m.dimensions);
                  return (
                    <Card key={m.user_id} className="rounded-3xl border border-[#EFE8DD] shadow-card bg-white p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="bg-[#FFF9F6] border-[#FFD9CE] text-[#7A3E2D] font-bold text-xs flex items-center gap-1.5 py-1">
                          <Clock className="h-3.5 w-3.5 text-primary animate-pulse" />
                          <span>Awaiting Candidate Response</span>
                        </Badge>
                        <div className="inline-flex items-center rounded-2xl bg-[#FFF4F0] border border-[#FCD9CE] px-2.5 py-0.5">
                          <span className="text-lg font-bold text-primary mr-1 font-serif">{Math.round(m.score)}%</span>
                          <span className="text-[10px] font-semibold text-primary">Vibe</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#FFF0EB] to-[#FFE4DC] border border-[#FFC8B8] flex items-center justify-center text-primary shrink-0">
                          <Sparkles className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="font-serif font-bold text-base text-foreground">
                            {getCandidateDisplayName(m, mVibes)}
                          </h3>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Lock className="h-3 w-3 text-primary inline" />
                            <span>Names unlock once candidate accepts</span>
                          </p>
                        </div>
                      </div>

                      {mVibes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {mVibes.map((v, i) => (
                            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-[#FAF7F2] border border-[#EFE8DD] px-2.5 py-0.5 text-[11px] font-medium text-[#555]">
                              <span>{v.emoji}</span>
                              <span>{v.label}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="rounded-2xl bg-[#FAF7F2] p-3 text-xs text-muted-foreground space-y-1">
                        <div className="flex justify-between">
                          <span>Location</span>
                          <span className="font-bold text-foreground">{m.location_city || "Local area"}</span>
                        </div>
                        {mDist !== null && (
                          <div className="flex justify-between">
                            <span>Distance</span>
                            <span className="font-bold text-foreground">~{mDist} km away</span>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DISCOVER CANDIDATES (Zero-Bias Blind Candidate Discovery Queue) */}
        {activeTab === "discover" && (
          <>
            {!currentMatch ? (
              <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-8">
                <Card className="w-full max-w-md rounded-3xl border border-[#EFE8DD] shadow-card bg-white overflow-hidden">
                  <div className="bg-gradient-to-b from-[#FFF5F1] to-white p-8 text-center border-b border-[#F5EDE3]">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF0EB] text-3xl shadow-xs mb-3">
                      {pendingMatches.length > 0 ? "🕒" : "✨"}
                    </div>
                    <h2 className="font-serif text-2xl font-bold text-foreground">
                      {pendingMatches.length > 0 ? "All Caught Up in Discovery!" : "Curating Your Circle"}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto leading-relaxed">
                      {pendingMatches.length > 0
                        ? `You've reviewed all available candidates. You currently have ${pendingMatches.length} pending connection request(s) awaiting response!`
                        : "We match you based on deep compatibility, not an endless swipe stack. We'll notify you as new verified members join!"}
                    </p>
                  </div>
                  <CardContent className="space-y-4 p-6 text-center">
                    {pendingMatches.length > 0 && (
                      <Button
                        className="rounded-full h-11 w-full font-semibold bg-amber-500 hover:bg-amber-600 text-white text-xs"
                        onClick={() => setActiveTab("pending")}
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        View Pending Requests ({pendingMatches.length})
                      </Button>
                    )}

                    {mutualMatches.length > 0 && (
                      <Button
                        variant="outline"
                        className="rounded-full h-11 w-full font-semibold border-emerald-300 text-emerald-800 bg-white hover:bg-emerald-50 text-xs"
                        onClick={() => setActiveTab("connected")}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" />
                        View Connected Matches ({mutualMatches.length})
                      </Button>
                    )}

                    <div className="rounded-2xl bg-[#FFF8F5] border border-[#FFD9CE] p-4 text-left">
                      <p className="text-xs font-bold uppercase tracking-wider text-primary">Priority Match Booster</p>
                      <p className="text-xs text-foreground mt-1 font-medium leading-relaxed">
                        Invite a friend and unlock <strong>7 days of Priority Matching</strong> as soon as they sign up!
                      </p>
                    </div>

                    <div className="flex flex-col gap-2.5 pt-1">
                      <Button
                        variant="outline"
                        className="rounded-full h-11 w-full font-bold border-[#FF5436]/40 text-[#FF5436] hover:bg-[#FFF0EB]"
                        onClick={async () => {
                          if (user) {
                            setOptimisticallyRemovedIds(new Set());
                            await resetSwipedMatches(user.id);
                            queryClient.invalidateQueries({ queryKey: ["matches"] });
                            toast({
                              title: "✨ Discovery Queue Refilled",
                              description: "Reset passed candidates so you can review them again.",
                            });
                          }
                        }}
                      >
                        <Sparkles className="h-4 w-4 mr-2" /> Re-review Passed Candidates
                      </Button>
                      <Button className="rounded-full h-12 w-full font-bold" onClick={() => navigate("/referral")}>
                        <Share2 className="h-4 w-4 mr-2" /> Share Your Referral Link
                      </Button>
                      <Button variant="outline" className="rounded-full h-12 w-full font-semibold" onClick={() => navigate("/dashboard")}>
                        Go to Dashboard
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              /* Responsive Layout: 2-Column Split on Desktop, Stack on Mobile */
              <div className="space-y-3.5 flex-1 flex flex-col">
                {/* Discovery status bar */}
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <span>Candidate 1 of {matchesList.length}</span>
                    </span>
                    {isOffline ? (
                      <span
                        id="offline-sync-indicator"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50"
                        title="Displaying cached compatibility queue"
                      >
                        <WifiOff className="h-2.5 w-2.5 text-amber-600" />
                        <span>Offline Cache</span>
                      </span>
                    ) : (
                      <span
                        id="live-sync-indicator"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50"
                        title="Compatibility queue updated dynamically"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Live Sync</span>
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] hidden sm:inline">Swipe card or press C (Connect) / P (Pass)</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
                  {/* LEFT COLUMN: Modular MatchCard Component with Integrated Synergy & Action Controls */}
                  <div className="lg:col-span-5 flex flex-col relative">
                    <AnimatePresence mode="popLayout">
                      <MatchCard
                        key={currentMatch.user_id}
                        match={currentMatch}
                        isConnected={false}
                        myCity={myProfile?.location_city}
                        candidatePartnerName={undefined}
                        vibes={vibes}
                        userName={myProfile?.user_type === "couple" ? "Your Duo" : "You"}
                        onConnect={() => handleAction(currentMatch, "accept")}
                        onPass={() => handleAction(currentMatch, "pass")}
                        onBlocked={() => {
                          queryClient.invalidateQueries({ queryKey: ["matches"] });
                          queryClient.invalidateQueries({ queryKey: ["chat-summary"] });
                        }}
                        acting={acting}
                        className="w-full"
                      />
                    </AnimatePresence>
                  </div>

                  {/* RIGHT COLUMN: CompatibilityScoreMeter on Top + Dimensions Radar Below */}
                  <div className="lg:col-span-7 flex flex-col gap-4">
                    {/* Primary Decision Element: Visual D3 Compatibility Score Meter */}
                    <CompatibilityScoreMeter
                      key={`score-meter-${currentMatch.user_id}`}
                      myDimensions={currentMatch.my_dimensions}
                      candidateDimensions={currentMatch.dimensions}
                      fallbackScore={currentMatch.score}
                    />

                    {/* Compatibility Dimensions Radar Chart (Beneath Score Meter) */}
                    <div
                      key={`radar-${currentMatch.user_id}`}
                      className="rounded-[28px] border border-[#EFE8DD] shadow-card bg-white p-4 sm:p-5"
                    >
                      <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
                        <div>
                          <h3 className="font-serif font-bold text-base text-[#1A1816]">Compatibility Dimensions</h3>
                          <p className="text-[11px] text-muted-foreground">Overlap across 5 core social pacing dimensions</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-semibold">
                          <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-[#FF5436]" />
                            <span className="text-[#1A1816]">{myProfile?.user_type === "couple" ? "Your Duo" : "You"}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />
                            <span className="text-[#1A1816] flex items-center gap-1">
                              <span>Candidate</span>
                              <ShieldCheck className="h-2.5 w-2.5 text-primary" />
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="h-[200px] sm:h-[220px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
                            <PolarGrid stroke="#E0D6CA" />
                            <PolarAngleAxis
                              dataKey="dimension"
                              tick={{ fontSize: 11, fill: "#5C5752", fontWeight: 600 }}
                            />
                            <PolarRadiusAxis
                              angle={90}
                              domain={[0, 5]}
                              tick={{ fontSize: 8, fill: "#8C847B" }}
                            />
                            <Radar
                              name="You"
                              dataKey="You"
                              stroke="#FF5436"
                              fill="#FF5436"
                              fillOpacity={0.25}
                              strokeWidth={2}
                            />
                            <Radar
                              name="Match"
                              dataKey="Match"
                              stroke="#F59E0B"
                              fill="#F59E0B"
                              fillOpacity={0.2}
                              strokeWidth={2}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </>
        )}
      </div>
    </div>
  );
};

export default Matches;
