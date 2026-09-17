import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import {
  Users,
  Sparkles,
  Copy,
  Clock,
  WifiOff,
} from "lucide-react";
import { DIMENSION_LABELS, getTopSharedVibes } from "@/lib/matchUtils";
import { calculateDistanceKm } from "@/lib/postalCodeUtils";
import { MatchesSkeleton } from "@/components/MatchesSkeleton";
import { cn } from "@/lib/utils";
import { MatchCardItem } from "@/components/MatchCard";
import { MatchesDiscoverTab } from "@/components/matches/MatchesDiscoverTab";
import { MatchesReceivedTab } from "@/components/matches/MatchesReceivedTab";
import { MatchesPendingTab } from "@/components/matches/MatchesPendingTab";
import { MatchesConnectedTab } from "@/components/matches/MatchesConnectedTab";
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

        {/* TAB 1: CONNECTED MATCHES */}
        {activeTab === "connected" && (
          <MatchesConnectedTab
            connectedMatches={effectiveMutualMatches}
            myCity={myProfile?.location_city}
            onDiscoverClick={() => setActiveTab("discover")}
            onOpenChat={(mId) => navigate(`/match/${mId}/chat`)}
          />
        )}

        {/* TAB 2: RECEIVED REQUESTS */}
        {activeTab === "received" && (
          <MatchesReceivedTab
            incomingMatches={incomingMatches}
            currentReceivedMatch={currentReceivedMatch}
            receivedIndex={receivedIndex}
            setReceivedIndex={setReceivedIndex}
            receivedVibes={receivedVibes}
            userType={myProfile?.user_type}
            locationCity={myProfile?.location_city}
            acting={acting}
            handleAction={handleAction}
            onDiscoverClick={() => setActiveTab("discover")}
          />
        )}

        {/* TAB 3: PENDING MATCHES (SENT) */}
        {activeTab === "pending" && (
          <MatchesPendingTab
            pendingMatches={pendingMatches}
            myCity={myProfile?.location_city}
            onDiscoverClick={() => setActiveTab("discover")}
          />
        )}

        {/* TAB 4: DISCOVER CANDIDATES */}
        {activeTab === "discover" && (
          <MatchesDiscoverTab
            currentMatch={currentMatch}
            matchesListCount={matchesList.length}
            pendingCount={pendingMatches.length}
            connectedCount={mutualMatches.length}
            isOffline={isOffline}
            userType={myProfile?.user_type}
            locationCity={myProfile?.location_city}
            vibes={vibes}
            radarData={radarData}
            acting={acting}
            handleAction={handleAction}
            onBlocked={() => {
              queryClient.invalidateQueries({ queryKey: ["matches"] });
              queryClient.invalidateQueries({ queryKey: ["chat-summary"] });
            }}
            onResetPassed={async () => {
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
            onNavigate={navigate}
            onSwitchTab={(tab) => setActiveTab(tab)}
          />
        )}
      </div>
    </div>
  );
};

export default Matches;
