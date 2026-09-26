import { supabase } from "@/integrations/supabase/client";
import { ALL_DIMS, getDim, soloScore, QuizRow } from "@/lib/scoring";
import { ensureUserQuizResponse, getSavedQuizAnswers } from "@/lib/quizSync";
import { fetchBlockedUserIds } from "@/lib/blockService";
import { saveOfflineMatches, getOfflineMatches } from "@/lib/queryPersister";
import { sanitizeLocationCity } from "@/lib/matchUtils";
import { toast } from "@/hooks/use-toast";

export interface MatchData {
  user_id: string;
  first_name: string;
  user_type: string;
  location_city: string | null;
  travel_radius_km: number | null;
  score: number;
  dimensions: number[];
  my_dimensions: number[];
  has_incoming_request?: boolean;
  pending_match_id?: string;
  revealed_at?: string | null;
}

export interface MatchesResult {
  matches: MatchData[];
  pending_matches?: MatchData[];
  incoming_matches?: MatchData[];
  pending_match: any | null;
  incoming_requests: any[];
  user_type: string;
  waiting_for_partner?: boolean;
  partner_needed?: boolean;
  partner_quiz_pending?: boolean;
  invite_code?: string | null;
  quiz_needed?: boolean;
  onboarding_needed?: boolean;
  sent_request_user_ids?: string[];
}

export async function fetchMatchesWithFallback(
  userId: string,
  session: any
): Promise<MatchesResult> {
  // If device is offline, immediately return cached matches from IndexedDB
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const cachedMatches = await getOfflineMatches(userId);
    if (cachedMatches) {
      console.info("[MatchEngine] Offline mode: served matches from IndexedDB cache");
      return cachedMatches;
    }
  }

  try {
    return await executeFetchMatches(userId, session);
  } catch (err) {
    console.warn("[MatchEngine] Fetch error, attempting IndexedDB fallback:", err);
    const cachedMatches = await getOfflineMatches(userId);
    if (cachedMatches) {
      return cachedMatches;
    }
    throw err;
  }
}

async function executeFetchMatches(
  userId: string,
  session: any
): Promise<MatchesResult> {
  // 1. Fetch current user's profile and verify onboarding and quiz completion
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("id, first_name, user_type, location_city, travel_radius_km, quiz_completed, onboarding_completed")
    .eq("id", userId)
    .maybeSingle();

  let isQuizCompleted = Boolean(myProfile?.quiz_completed);
  if (!isQuizCompleted && userId) {
    const { data: qRow } = await supabase
      .from("quiz_responses")
      .select("dimension_1_social")
      .eq("user_id", userId)
      .maybeSingle();

    if (qRow && qRow.dimension_1_social !== null) {
      isQuizCompleted = true;
      await supabase.from("profiles").update({ quiz_completed: true }).eq("id", userId);
    } else {
      const saved = getSavedQuizAnswers(userId);
      if (saved && (saved.personalityChoice || Object.keys(saved.scaleAnswers || {}).length > 0)) {
        await ensureUserQuizResponse(userId);
        isQuizCompleted = true;
      }
    }
  }

  let isOnboardingCompleted = Boolean(myProfile?.onboarding_completed);
  if (!isOnboardingCompleted && myProfile?.first_name && isQuizCompleted) {
    isOnboardingCompleted = true;
    await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", userId);
  }

  // If user profile is not complete or quiz not finished, DO NOT generate any match suggestions
  if (!myProfile || !myProfile.first_name || !isQuizCompleted || !isOnboardingCompleted) {
    return {
      matches: [],
      pending_match: null,
      incoming_requests: [],
      user_type: myProfile?.user_type || "solo",
      quiz_needed: !isQuizCompleted,
      onboarding_needed: !isOnboardingCompleted,
    };
  }

  // 2. Fetch current user's quiz responses
  const { data: myQuizData } = await supabase
    .from("quiz_responses")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!myQuizData || myQuizData.dimension_1_social === null) {
    return {
      matches: [],
      pending_match: null,
      incoming_requests: [],
      user_type: myProfile.user_type || "solo",
      quiz_needed: true,
    };
  }

  const myQuizDims = myQuizData as QuizRow;
  const userType = myProfile.user_type || "solo";

  // 3. Check couple status if couple: both partners MUST be linked and have completed quiz
  let partnerId: string | null = null;
  let coupleInviteCode: string | null = null;

  if (userType === "couple") {
    const { data: couple } = await supabase
      .from("couples")
      .select("id, partner_a_id, partner_b_id, invite_code")
      .or(`partner_a_id.eq.${userId},partner_b_id.eq.${userId}`)
      .maybeSingle();

    coupleInviteCode = couple?.invite_code || null;
    partnerId = couple ? (couple.partner_a_id === userId ? couple.partner_b_id : couple.partner_a_id) : null;

    // If no couple record exists or partner has not joined yet (partner_b_id is null), PAUSE matching
    if (!couple || !partnerId || !couple.partner_b_id) {
      return {
        matches: [],
        pending_match: null,
        incoming_requests: [],
        user_type: "couple",
        waiting_for_partner: true,
        partner_needed: true,
        invite_code: coupleInviteCode,
      };
    }

    // Partner is linked: check if partner completed onboarding and quiz
    const { data: partnerProfile } = await supabase
      .from("profiles")
      .select("quiz_completed, onboarding_completed")
      .eq("id", partnerId)
      .maybeSingle();

    const { data: partnerQuiz } = await supabase
      .from("quiz_responses")
      .select("id")
      .eq("user_id", partnerId)
      .maybeSingle();

    if (!partnerProfile?.quiz_completed || !partnerQuiz) {
      return {
        matches: [],
        pending_match: null,
        incoming_requests: [],
        user_type: "couple",
        waiting_for_partner: true,
        partner_needed: false,
        partner_quiz_pending: true,
        invite_code: coupleInviteCode,
      };
    }
  }

  // 3. Query existing matches from Supabase
  const matchFilter = partnerId
    ? `user_a_id.eq.${userId},user_b_id.eq.${userId},user_a_id.eq.${partnerId},user_b_id.eq.${partnerId}`
    : `user_a_id.eq.${userId},user_b_id.eq.${userId}`;

  const { data: existingMatches, error: matchesErr } = await supabase
    .from("matches")
    .select("id, user_a_id, user_b_id, status, user_a_action, user_b_action, compatibility_score, revealed_at")
    .or(matchFilter);

  if (matchesErr) {
    console.error("Error fetching existing matches from Supabase:", matchesErr);
  }

  // Initialize master exclusion list: exclude current user and partner
  const excludeIds = new Set<string>([userId]);
  if (partnerId) excludeIds.add(partnerId);

  // Fetch all globally blocked user IDs from blocks table
  try {
    const blockedIds = await fetchBlockedUserIds(userId);
    blockedIds.forEach((id) => excludeIds.add(id));
    if (partnerId) {
      const partnerBlockedIds = await fetchBlockedUserIds(partnerId);
      partnerBlockedIds.forEach((id) => excludeIds.add(id));
    }
  } catch (err) {
    console.warn("Error fetching blocked user IDs in matchEngine:", err);
  }

  // EXPLICIT FILTERING CHECK:
  // Identify all users who have already received a connection request from the current user (or couple partner).
  // These users MUST be excluded from the discovery feed.
  const sentRequestRecipientIds = new Set<string>();
  for (const m of existingMatches || []) {
    const isUserA = m.user_a_id === userId || (partnerId && m.user_a_id === partnerId);
    const isUserB = m.user_b_id === userId || (partnerId && m.user_b_id === partnerId);

    // If current user or partner sent a connection request ('accept') to the other party
    if ((isUserA && m.user_a_action === "accept") || (isUserB && m.user_b_action === "accept")) {
      const recipientId = isUserA ? m.user_b_id : m.user_a_id;
      if (recipientId) {
        sentRequestRecipientIds.add(recipientId);
        excludeIds.add(recipientId);
      }
    }
  }

  // Populate exclusion list with users already passed, mutual, blocked, or pending
  for (const m of existingMatches || []) {
    if (
      m.status === "passed_by_a" ||
      m.status === "passed_by_b" ||
      m.status === "mutual" ||
      m.status === "blocked" ||
      m.status === "pending"
    ) {
      excludeIds.add(m.user_a_id);
      excludeIds.add(m.user_b_id);
    }
  }

  // Check outgoing pending match records (where current user has accepted, waiting for other party)
  const outgoingPendingRecords = (existingMatches || []).filter((m) => {
    if (m.status === "mutual" || m.status === "passed_by_a" || m.status === "passed_by_b" || m.status === "blocked") {
      return false;
    }
    const isA = m.user_a_id === userId || (partnerId && m.user_a_id === partnerId);
    const isB = m.user_b_id === userId || (partnerId && m.user_b_id === partnerId);
    if (isA && m.user_a_action === "accept" && m.user_b_action !== "accept") return true;
    if (isB && m.user_b_action === "accept" && m.user_a_action !== "accept") return true;
    return false;
  });

  console.log(
    `[MatchEngine Pending Diagnostic] Found ${outgoingPendingRecords.length} outgoingPendingRecords for user ${userId}:`,
    outgoingPendingRecords.map((m) => ({
      matchId: m.id,
      user_a_id: m.user_a_id,
      user_b_id: m.user_b_id,
      status: m.status,
      user_a_action: m.user_a_action,
      user_b_action: m.user_b_action,
    }))
  );

  const pendingMatchesList: MatchData[] = [];
  const seenPendingIds = new Set<string>();

  for (const out of outgoingPendingRecords) {
    const isUserA = out.user_a_id === userId || (partnerId && out.user_a_id === partnerId);
    const otherId = isUserA ? out.user_b_id : out.user_a_id;

    if (excludeIds.has(otherId) && out.status === "blocked") {
      console.log(
        `[MatchEngine Pending Diagnostic] CONTINUE: Record ${out.id} for otherId ${otherId} dropped because match is blocked and otherId is in excludeIds.`
      );
      continue;
    }
    if (seenPendingIds.has(otherId)) {
      console.log(
        `[MatchEngine Pending Diagnostic] CONTINUE: Record ${out.id} for otherId ${otherId} dropped because of duplicate otherId in seenPendingIds.`
      );
      continue;
    }
    seenPendingIds.add(otherId);

    const { data: otherQuizData, error: otherQuizErr } = await supabase
      .from("quiz_responses")
      .select("*")
      .eq("user_id", otherId)
      .maybeSingle();

    const { data: otherProfile, error: otherProfileErr } = await supabase
      .from("profiles")
      .select("id, first_name, user_type, location_city, travel_radius_km")
      .eq("id", otherId)
      .maybeSingle();

    console.log(`[MatchEngine Pending Diagnostic] Checking record ${out.id} for otherId ${otherId}:`, {
      otherId,
      otherProfileFound: !!otherProfile,
      otherProfileError: otherProfileErr?.message || null,
      otherQuizDataFound: !!otherQuizData,
      otherQuizError: otherQuizErr?.message || null,
    });

    // If candidate has no quiz_responses row, exclude them from matching entirely
    if (!otherQuizData) {
      console.log(
        `[MatchEngine Pending Diagnostic] CONTINUE: Record ${out.id} for otherId ${otherId} dropped by (!otherQuizData) check! otherProfileFound=${!!otherProfile}, otherQuizDataFound=false.`
      );
      continue;
    }

    const otherQuiz = otherQuizData as QuizRow;
    const myQuizRow = { ...myQuizDims, user_id: userId } as QuizRow;
    const myDims = ALL_DIMS.map((d) => getDim(myQuizRow, d));

    const myCleanCity = myProfile?.location_city ? sanitizeLocationCity(myProfile.location_city) : null;
    const resolvedCity = otherProfile?.location_city
      ? sanitizeLocationCity(otherProfile.location_city)
      : myCleanCity && myCleanCity !== "Local area"
      ? myCleanCity
      : "Local area";

    const resolvedOtherDims = ALL_DIMS.map((d) => getDim(otherQuiz, d));

    const score: number =
      out.compatibility_score && out.compatibility_score > 0
        ? out.compatibility_score
        : soloScore(myQuizRow, otherQuiz);

    const resolvedProfile = otherProfile || {
      id: otherId,
      first_name: "Community Member",
      user_type: userType || "solo",
      location_city: resolvedCity,
      travel_radius_km: 15,
    };

    pendingMatchesList.push({
      user_id: resolvedProfile.id,
      first_name: resolvedProfile.first_name || "Community Member",
      user_type: resolvedProfile.user_type || "solo",
      location_city: resolvedCity,
      travel_radius_km: resolvedProfile.travel_radius_km || 15,
      score,
      dimensions: resolvedOtherDims,
      my_dimensions: myDims,
      pending_match_id: out.id,
    });

    console.log(
      `[MatchEngine Pending Diagnostic] SUCCESS: Record ${out.id} for otherId ${otherId} added to pendingMatchesList. (first_name: "${resolvedProfile.first_name}")`
    );
  }

  console.log(`[MatchEngine Pending Diagnostic] Resulting pendingMatchesList count: ${pendingMatchesList.length}`);

  // Check incoming match requests (where other party accepted, current user hasn't acted yet)
  const incomingMatchRecords = (existingMatches || []).filter((m) => {
    if (m.status !== "pending") return false;
    const isA = m.user_a_id === userId || (partnerId && m.user_a_id === partnerId);
    const isB = m.user_b_id === userId || (partnerId && m.user_b_id === partnerId);
    if (isA && m.user_b_action === "accept" && !m.user_a_action) return true;
    if (isB && m.user_a_action === "accept" && !m.user_b_action) return true;
    return false;
  });

  const matchesMap = new Map<string, MatchData>();
  const incomingMatchesList: MatchData[] = [];

  // Convert incoming match records into priority match cards
  for (const inc of incomingMatchRecords) {
    const isUserA = inc.user_a_id === userId || (partnerId && inc.user_a_id === partnerId);
    const otherId = isUserA ? inc.user_b_id : inc.user_a_id;
    if (excludeIds.has(otherId) && inc.status === "blocked") continue;

    const { data: otherQuizData } = await supabase
      .from("quiz_responses")
      .select("*")
      .eq("user_id", otherId)
      .maybeSingle();

    // If candidate has no quiz_responses row, exclude them from matching entirely
    if (!otherQuizData) continue;

    const { data: otherProfile } = await supabase
      .from("profiles")
      .select("id, first_name, user_type, location_city, travel_radius_km")
      .eq("id", otherId)
      .maybeSingle();

    const otherQuiz = otherQuizData as QuizRow;
    const myQuizRow = { ...myQuizDims, user_id: userId } as QuizRow;
    const myDims = ALL_DIMS.map((d) => getDim(myQuizRow, d));

    const myCleanCity = myProfile?.location_city ? sanitizeLocationCity(myProfile.location_city) : null;
    const resolvedCity = otherProfile?.location_city
      ? sanitizeLocationCity(otherProfile.location_city)
      : myCleanCity && myCleanCity !== "Local area"
      ? myCleanCity
      : "Local area";

    const resolvedOtherDims = ALL_DIMS.map((d) => getDim(otherQuiz, d));

    const score: number =
      inc.compatibility_score && inc.compatibility_score > 0
        ? inc.compatibility_score
        : soloScore(myQuizRow, otherQuiz);

    const resolvedProfile = otherProfile || {
      id: otherId,
      first_name: "Match Candidate",
      user_type: userType || "solo",
      location_city: resolvedCity,
      travel_radius_km: 15,
    };

    const matchObj: MatchData = {
      user_id: resolvedProfile.id,
      first_name: resolvedProfile.first_name || "Match Candidate",
      user_type: resolvedProfile.user_type || "solo",
      location_city: resolvedCity,
      travel_radius_km: resolvedProfile.travel_radius_km || 15,
      score,
      dimensions: resolvedOtherDims,
      my_dimensions: myDims,
      has_incoming_request: true,
      pending_match_id: inc.id,
    };
    matchesMap.set(resolvedProfile.id, matchObj);
    incomingMatchesList.push(matchObj);
  }

  // 4. Try edge function calculate-matches
  try {
    const { data: edgeData, error: edgeErr } = await supabase.functions.invoke("calculate-matches", {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });

    if (!edgeErr && edgeData?.matches?.length > 0) {
      for (const m of edgeData.matches) {
        // MUST filter by excludeIds here so that already swiped/pending candidates from Edge Function do not surface
        if (!excludeIds.has(m.user_id) && !matchesMap.has(m.user_id)) {
          matchesMap.set(m.user_id, {
            ...m,
            location_city: sanitizeLocationCity(m.location_city),
          });
        }
      }
    }
  } catch (err) {
    console.warn("calculate-matches edge function note:", err);
  }

  // 5. Candidate discovery (RPC or direct query) to ensure fresh discovery matches are always populated
  try {
    const myQuizRow = { ...myQuizDims, user_id: userId } as QuizRow;

      // 5a. First try dedicated security-definer RPC function
      const { data: rpcCandidates, error: rpcErr } = await supabase.rpc("get_candidate_matches");
      if (!rpcErr && Array.isArray(rpcCandidates) && rpcCandidates.length > 0) {
        // Verify that any couple candidate actually has both partners joined
        const coupleCandidates = rpcCandidates.filter((c) => c.user_type === "couple");
        const verifiedCoupleUserIds = new Set<string>();
        if (coupleCandidates.length > 0) {
          const { data: cCouples } = await supabase
            .from("couples")
            .select("partner_a_id, partner_b_id")
            .or(coupleCandidates.map((c) => `partner_a_id.eq.${c.id},partner_b_id.eq.${c.id}`).join(","));

          for (const cRow of cCouples || []) {
            if (cRow.partner_a_id && cRow.partner_b_id) {
              verifiedCoupleUserIds.add(cRow.partner_a_id);
              verifiedCoupleUserIds.add(cRow.partner_b_id);
            }
          }
        }

        for (const c of rpcCandidates) {
          if (excludeIds.has(c.id)) continue;
          // User types must strictly match: solo with solo, couple with couple
          if (userType === "solo" && c.user_type && c.user_type !== "solo") continue;
          if (userType === "couple" && c.user_type !== "couple") continue;

          // For couple candidates, verify they have both partners linked
          if (c.user_type === "couple") {
            const { data: isVer } = await supabase.rpc("is_verified_couple_member", { _user_id: c.id });
            if (isVer === false || (isVer === null && !verifiedCoupleUserIds.has(c.id))) {
              continue;
            }
          }

          const dimsObj = (c.dimensions || {}) as QuizRow;
          const score = soloScore(myQuizRow, dimsObj);
          matchesMap.set(c.id, {
            user_id: c.id,
            first_name: c.first_name || "Community Member",
            user_type: c.user_type || "solo",
            location_city: sanitizeLocationCity(c.location_city),
            travel_radius_km: c.travel_radius_km,
            score,
            dimensions: ALL_DIMS.map((d) => getDim(dimsObj, d)),
            my_dimensions: ALL_DIMS.map((d) => getDim(myQuizRow, d)),
          });
        }
      }

      // 5b. Direct query fallback (Note: under strict RLS, direct SELECT on other profiles is locked; secure RPCs are preferred)
      if (matchesMap.size === 0) {
        const { data: candidates, error: candErr } = await supabase
          .from("profiles")
          .select("id, first_name, user_type, location_city, travel_radius_km, quiz_completed, onboarding_completed, is_suspended, matching_paused")
          .neq("id", userId)
          .eq("quiz_completed", true)
          .eq("onboarding_completed", true)
          .eq("is_suspended", false)
          .eq("matching_paused", false)
          .limit(20);

        if (candErr) {
          console.info("[MatchEngine] Direct candidate query notice (handled via RLS):", candErr.message);
        }

        if (candidates && candidates.length > 0) {
          const candidateIds = candidates.map((c) => c.id).filter((id) => !excludeIds.has(id));
          if (candidateIds.length > 0) {
            const { data: candidateQuizzes } = await supabase
              .from("quiz_responses")
              .select("*")
              .in("user_id", candidateIds);

            const cQuizMap = new Map<string, QuizRow>();
            for (const q of candidateQuizzes || []) {
              cQuizMap.set(q.user_id, q as QuizRow);
            }

            // Verify that any couple candidate actually has both partners joined
            const coupleCandidates = candidates.filter((c) => c.user_type === "couple");
            const verifiedCoupleUserIds = new Set<string>();
            if (coupleCandidates.length > 0) {
              const { data: cCouples } = await supabase
                .from("couples")
                .select("partner_a_id, partner_b_id")
                .or(coupleCandidates.map((c) => `partner_a_id.eq.${c.id},partner_b_id.eq.${c.id}`).join(","));

              for (const cRow of cCouples || []) {
                if (cRow.partner_a_id && cRow.partner_b_id) {
                  verifiedCoupleUserIds.add(cRow.partner_a_id);
                  verifiedCoupleUserIds.add(cRow.partner_b_id);
                }
              }
            }

            for (const c of candidates) {
              if (excludeIds.has(c.id)) continue;
              // User types must strictly match
              if (userType === "solo" && c.user_type && c.user_type !== "solo") continue;
              if (userType === "couple" && c.user_type !== "couple") continue;

              // If candidate is a couple, verify they have both partners linked
              if (c.user_type === "couple") {
                const { data: isVer } = await supabase.rpc("is_verified_couple_member", { _user_id: c.id });
                if (isVer === false || (isVer === null && !verifiedCoupleUserIds.has(c.id))) {
                  continue;
                }
              }

              const otherQuiz = cQuizMap.get(c.id);
              if (!otherQuiz) continue;

              const score = soloScore(myQuizRow, otherQuiz);
              matchesMap.set(c.id, {
                user_id: c.id,
                first_name: c.first_name || "Community Member",
                user_type: c.user_type || "solo",
                location_city: sanitizeLocationCity(c.location_city),
                travel_radius_km: c.travel_radius_km,
                score,
                dimensions: ALL_DIMS.map((d) => getDim(otherQuiz, d)),
                my_dimensions: ALL_DIMS.map((d) => getDim(myQuizRow, d)),
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn("Client fallback candidate matching warning:", err);
    }

  // Explicit filtering check: Ensure users who have already received a connection request
  // from the current user (or couple partner) are strictly excluded from the discovery feed
  const discoveryCandidates = Array.from(matchesMap.values()).filter((cand) => {
    // 1. Exclude if current user or partner already sent a connection request
    if (sentRequestRecipientIds.has(cand.user_id)) return false;
    // 2. Exclude if candidate is in pending matches list
    if (pendingMatchesList.some((p) => p.user_id === cand.user_id)) return false;
    // 3. Exclude if in excludeIds (unless candidate is an incoming request waiting for current user's review)
    if (excludeIds.has(cand.user_id) && !cand.has_incoming_request) return false;
    return true;
  });

  discoveryCandidates.sort((a, b) => {
    if (a.has_incoming_request && !b.has_incoming_request) return -1;
    if (!a.has_incoming_request && b.has_incoming_request) return 1;
    return b.score - a.score;
  });

  const result: MatchesResult = {
    matches: discoveryCandidates,
    pending_matches: pendingMatchesList,
    incoming_matches: incomingMatchesList,
    pending_match: outgoingPendingRecords[0] || null,
    incoming_requests: incomingMatchRecords,
    user_type: userType,
    waiting_for_partner: false,
    sent_request_user_ids: Array.from(sentRequestRecipientIds),
  };

  // Cache to IndexedDB for offline resilience
  saveOfflineMatches(userId, result);

  return result;
}

export async function resetSwipedMatches(userId: string): Promise<void> {
  await supabase
    .from("matches")
    .delete()
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .in("status", ["passed_by_a", "passed_by_b"]);
}

export async function executeMatchAction(
  otherUserId: string,
  action: "accept" | "pass",
  session: any,
  score?: number,
  pendingMatchId?: string,
  hasIncomingRequest?: boolean
): Promise<{ status: string; match_id: string }> {
  const { data: result, error } = await supabase.rpc("handle_match_action", {
    _other_user_id: otherUserId,
    _action: action,
  });

  if (error) {
    toast({
      title: "Action failed",
      description: error.message || "Failed to process match action. Please try again.",
      variant: "destructive",
    });
    throw error;
  }

  const res = (result || {
    match_id: pendingMatchId || "",
    status: action === "accept" ? "pending" : "passed",
  }) as { match_id: string; status: string };

  const activeUserId = session?.user?.id;

  console.log("[executeMatchAction] Result resolved:", {
    rawRpcResult: result,
    resStatus: res?.status,
    action,
    activeUserId,
    otherUserId,
    score,
    isPendingAndAccept: res?.status === "pending" && action === "accept",
  });

  if (res.status === "mutual") {
    // 1. Persist in-app notifications in Supabase so Realtime listeners and notification bells trigger
    if (activeUserId) {
      supabase
        .from("notifications")
        .insert([
          {
            user_id: otherUserId,
            message: "🎉 It's a Mutual Match! You both accepted each other.",
            link: `/match-reveal/${res.match_id}`,
            read: false,
          },
          {
            user_id: activeUserId,
            message: "🎉 It's a Mutual Match! You both accepted each other.",
            link: `/match-reveal/${res.match_id}`,
            read: false,
          },
        ])
        .then(({ error: notifErr }) => {
          if (notifErr) console.warn("Error creating match notification:", notifErr);
        });
    }

    // 2. Notify edge function for intro email
    supabase.functions
      .invoke("send-match-intro", {
        body: { match_id: res.match_id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      .catch(console.warn);

    // 3. Send push notification via Supabase Edge Function (supports both userId and user_id)
    supabase.functions
      .invoke("send-push", {
        body: {
          userId: otherUserId,
          user_id: otherUserId,
          title: "It's a Match! 🎉",
          body: "You both accepted each other! Check your match reveal now.",
          url: `/match-reveal/${res.match_id}`,
          type: "mutual_match",
          matchId: res.match_id,
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      .catch(console.warn);

    // 4. Also trigger backend web-push dispatcher fallback
    fetch("/api/push/dispatch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        userId: otherUserId,
        title: "It's a Match! 🎉",
        body: "You both accepted each other! Check your match reveal now.",
        url: `/match-reveal/${res.match_id}`,
        type: "mutual_match",
        tag: `match-${res.match_id}`,
      }),
    }).catch(console.warn);

    // 5. Also trigger backend transactional email dispatcher for mutual match
    fetch("/api/email/match-notification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token || ""}`,
      },
      body: JSON.stringify({
        matchId: res.match_id,
        userAId: activeUserId,
        userBId: otherUserId,
      }),
    }).catch(console.warn);
  } else if (res.status === "pending" && action === "accept") {
    // 1. Persist in-app notification for the recipient
    supabase
      .from("notifications")
      .insert([
        {
          user_id: otherUserId,
          message: "✨ Someone reviewed your profile and wants to connect with you!",
          link: `/matches?tab=received&match_id=${res.match_id || activeUserId}`,
          read: false,
        },
      ])
      .then(({ error: notifErr }) => {
        if (notifErr) console.warn("Error creating request notification:", notifErr);
      });

    // 2. Notify other user that they received a match request via Edge Function
    supabase.functions
      .invoke("send-push", {
        body: {
          userId: otherUserId,
          user_id: otherUserId,
          title: "New Match Request! ✨",
          body: "Someone wants to connect with you! Review and connect back on duogo.",
          url: "/matches?tab=received",
          type: "match_request",
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      .catch(console.warn);

    // 3. Also trigger backend web-push dispatcher fallback
    fetch("/api/push/dispatch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        userId: otherUserId,
        title: "New Match Request! ✨",
        body: "Someone wants to connect with you! Review and connect back on duogo.",
        url: "/matches?tab=received",
        type: "match_request",
        tag: `match-req-${Date.now()}`,
      }),
    }).catch(console.warn);

    // 4. Trigger email notification to recipient via Supabase Edge Function
    supabase.functions
      .invoke("send-request-notification", {
        body: {
          targetUserId: otherUserId,
          senderUserId: activeUserId,
          compatibilityScore: score,
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      .catch(console.warn);
  }

  return res;
}

let lastInstantMatchCheckTime = 0;
const INSTANT_MATCH_COOLDOWN_MS = 60 * 1000; // 1 minute cooldown per client session

export async function triggerInstantMatchCheck(session?: any): Promise<void> {
  const now = Date.now();
  if (now - lastInstantMatchCheckTime < INSTANT_MATCH_COOLDOWN_MS) {
    return;
  }
  lastInstantMatchCheckTime = now;

  try {
    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
    await supabase.functions.invoke("notify-new-matches", {
      headers,
    });
  } catch (err) {
    console.warn("Instant match notification trigger warning:", err);
  }
}
