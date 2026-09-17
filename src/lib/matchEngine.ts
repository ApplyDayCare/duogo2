import { supabase } from "@/integrations/supabase/client";
import { ALL_DIMS, getDim, soloScore, QuizRow } from "@/lib/scoring";
import { ensureUserQuizResponse, getSavedQuizAnswers } from "@/lib/quizSync";
import { fetchBlockedUserIds } from "@/lib/blockService";
import { saveOfflineMatches, getOfflineMatches } from "@/lib/queryPersister";

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
    if (m.status !== "pending") return false;
    const isA = m.user_a_id === userId || (partnerId && m.user_a_id === partnerId);
    const isB = m.user_b_id === userId || (partnerId && m.user_b_id === partnerId);
    if (isA && m.user_a_action === "accept" && !m.user_b_action) return true;
    if (isB && m.user_b_action === "accept" && !m.user_a_action) return true;
    return false;
  });

  const pendingMatchesList: MatchData[] = [];
  for (const out of outgoingPendingRecords) {
    const isUserA = out.user_a_id === userId || (partnerId && out.user_a_id === partnerId);
    const otherId = isUserA ? out.user_b_id : out.user_a_id;
    if (excludeIds.has(otherId) && out.status === "blocked") continue;

    const { data: otherProfile } = await supabase
      .from("profiles")
      .select("id, first_name, user_type, location_city, travel_radius_km")
      .eq("id", otherId)
      .maybeSingle();

    const { data: otherQuizData } = await supabase
      .from("quiz_responses")
      .select("*")
      .eq("user_id", otherId)
      .maybeSingle();

    const otherQuiz = (otherQuizData || {}) as QuizRow;
    const myQuizRow = { ...myQuizDims, user_id: userId } as QuizRow;
    const score = out.compatibility_score && out.compatibility_score > 0
      ? out.compatibility_score
      : (otherQuizData ? soloScore(myQuizRow, otherQuiz) : 88);

    const resolvedProfile = otherProfile || {
      id: otherId,
      first_name: "Community Member",
      user_type: userType || "solo",
      location_city: myProfile?.location_city || null,
      travel_radius_km: 15,
    };

    pendingMatchesList.push({
      user_id: resolvedProfile.id,
      first_name: resolvedProfile.first_name || "Community Member",
      user_type: resolvedProfile.user_type || "solo",
      location_city: resolvedProfile.location_city,
      travel_radius_km: resolvedProfile.travel_radius_km || 15,
      score,
      dimensions: ALL_DIMS.map((d) => getDim(otherQuiz, d)),
      my_dimensions: ALL_DIMS.map((d) => getDim(myQuizRow, d)),
      pending_match_id: out.id,
    });
  }

  // Check incoming match requests (where other party accepted, current user hasn't acted yet)
  const incomingMatchRecords = (existingMatches || []).filter((m) => {
    if (m.status !== "pending") return false;
    const isA = m.user_a_id === userId || (partnerId && m.user_a_id === partnerId);
    const isB = m.user_b_id === userId || (partnerId && m.user_b_id === partnerId);
    if (isA && m.user_b_action === "accept" && !m.user_a_action) return true;
    if (isB && m.user_a_action === "accept" && !m.user_b_action) return true;
    return false;
  });

  // Load local storage demo swipes and add to exclusion list (merging user-specific and anonymous fallback keys)
  let demoSwipes: Record<string, "accept" | "pass"> = {};
  try {
    const storedUser = localStorage.getItem(`duogo_demo_swipes_${userId}`);
    const storedAnon = localStorage.getItem(`duogo_demo_swipes_anonymous`);
    const swipesUser = storedUser ? JSON.parse(storedUser) : {};
    const swipesAnon = storedAnon ? JSON.parse(storedAnon) : {};
    demoSwipes = { ...swipesAnon, ...swipesUser };
  } catch (e) {
    console.warn("Error reading local demo swipes", e);
  }
  Object.keys(demoSwipes).forEach((id) => excludeIds.add(id));

  const matchesMap = new Map<string, MatchData>();
  const incomingMatchesList: MatchData[] = [];

  // Convert incoming match records into priority match cards
  for (const inc of incomingMatchRecords) {
    const isUserA = inc.user_a_id === userId || (partnerId && inc.user_a_id === partnerId);
    const otherId = isUserA ? inc.user_b_id : inc.user_a_id;
    if (excludeIds.has(otherId) && inc.status === "blocked") continue;
    const { data: otherProfile } = await supabase
      .from("profiles")
      .select("id, first_name, user_type, location_city, travel_radius_km")
      .eq("id", otherId)
      .maybeSingle();

    const { data: otherQuizData } = await supabase
      .from("quiz_responses")
      .select("*")
      .eq("user_id", otherId)
      .maybeSingle();

    const otherQuiz = (otherQuizData || {}) as QuizRow;
    const myQuizRow = { ...myQuizDims, user_id: userId } as QuizRow;
    const score = inc.compatibility_score && inc.compatibility_score > 0
      ? inc.compatibility_score
      : (otherQuizData ? soloScore(myQuizRow, otherQuiz) : 88);

    const resolvedProfile = otherProfile || {
      id: otherId,
      first_name: "Match Candidate",
      user_type: userType || "solo",
      location_city: myProfile?.location_city || null,
      travel_radius_km: 15,
    };

    const matchObj: MatchData = {
      user_id: resolvedProfile.id,
      first_name: resolvedProfile.first_name || "Match Candidate",
      user_type: resolvedProfile.user_type || "solo",
      location_city: resolvedProfile.location_city,
      travel_radius_km: resolvedProfile.travel_radius_km || 15,
      score,
      dimensions: ALL_DIMS.map((d) => getDim(otherQuiz, d)),
      my_dimensions: ALL_DIMS.map((d) => getDim(myQuizRow, d)),
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
          matchesMap.set(m.user_id, m);
        }
      }
    }
  } catch (err) {
    console.warn("calculate-matches edge function note:", err);
  }

  // 5. Candidate discovery (RPC or direct query) to ensure fresh discovery matches are always populated
  try {
    // Append accepted demo candidates to pendingMatchesList so they appear in the Pending tab
    try {
      const myDims = ALL_DIMS.map((d) => getDim(myQuizRow, d));
      const myCity = myProfile.location_city || "Milton";
      const demoFallbacks = [
        {
          user_id: "demo_candidate_1",
          first_name: userType === "couple" ? "Jordan & Casey" : "Jordan M.",
          user_type: userType,
          location_city: myCity,
          travel_radius_km: 12,
          score: 93,
          dimensions: myDims.map((val) => Math.min(5, Math.max(1, val + (val > 3 ? -1 : 1)))),
          my_dimensions: myDims,
        },
        {
          user_id: "demo_candidate_2",
          first_name: userType === "couple" ? "Taylor & Sam" : "Taylor R.",
          user_type: userType,
          location_city: myCity,
          travel_radius_km: 8,
          score: 89,
          dimensions: myDims.map((val, idx) => (idx % 2 === 0 ? val : Math.min(5, val + 1))),
          my_dimensions: myDims,
        },
        {
          user_id: "demo_candidate_3",
          first_name: userType === "couple" ? "Morgan & Riley" : "Morgan S.",
          user_type: userType,
          location_city: myCity,
          travel_radius_km: 18,
          score: 85,
          dimensions: myDims.map((val, idx) => (idx % 3 === 0 ? val : Math.max(1, val - 1))),
          my_dimensions: myDims,
        },
      ];

      Object.entries(demoSwipes).forEach(([id, act]) => {
        if (act === "accept") {
          const found = demoFallbacks.find((f) => f.user_id === id);
          if (found) {
            pendingMatchesList.push(found);
          }
        }
      });
    } catch (e) {
      console.warn("Error appending demo swipes to pendingMatchesList", e);
    }

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
            location_city: c.location_city,
            travel_radius_km: c.travel_radius_km,
            score,
            dimensions: ALL_DIMS.map((d) => getDim(dimsObj, d)),
            my_dimensions: ALL_DIMS.map((d) => getDim(myQuizRow, d)),
          });
        }
      }

      // 5b. If primary RPC returned no candidates, try secondary secure RPC endpoints before direct querying
      if (matchesMap.size === 0) {
        const { data: secCandidates, error: secErr } = await supabase.rpc("get_matches_for_user" as any, { p_user_id: userId });
        if (!secErr && Array.isArray(secCandidates) && secCandidates.length > 0) {
          for (const c of secCandidates) {
            const candId = c.id || c.user_id;
            if (!candId || excludeIds.has(candId)) continue;
            const candType = c.user_type || "solo";
            if (userType === "solo" && candType !== "solo") continue;
            if (userType === "couple" && candType !== "couple") continue;

            const dimsObj = (c.dimensions || {}) as QuizRow;
            const score = c.compatibility_score || soloScore(myQuizRow, dimsObj);
            matchesMap.set(candId, {
              user_id: candId,
              first_name: c.first_name || "Community Member",
              user_type: candType,
              location_city: c.location_city,
              travel_radius_km: c.travel_radius_km,
              score,
              dimensions: ALL_DIMS.map((d) => getDim(dimsObj, d)),
              my_dimensions: ALL_DIMS.map((d) => getDim(myQuizRow, d)),
            });
          }
        }
      }

      // 5c. Direct query fallback (Note: under strict RLS, direct SELECT on other profiles is locked; secure RPCs are preferred)
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

              const otherQuiz = cQuizMap.get(c.id) || ({
                dimension_1_social: 3,
                dimension_2_budget: 3,
                dimension_3_spontaneity: 3,
                dimension_4_planning: 3,
                dimension_5_intellectual: 3,
                dimension_6_activity: 3,
                dimension_7_night: 3,
                dimension_8_humor: 3,
                dimension_9_commitment: 3,
                dimension_10_home: 3,
              } as QuizRow);

              const score = soloScore(myQuizRow, otherQuiz);
              matchesMap.set(c.id, {
                user_id: c.id,
                first_name: c.first_name || "Community Member",
                user_type: c.user_type || "solo",
                location_city: c.location_city,
                travel_radius_km: c.travel_radius_km,
                score,
                dimensions: ALL_DIMS.map((d) => getDim(otherQuiz, d)),
                my_dimensions: ALL_DIMS.map((d) => getDim(myQuizRow, d)),
              });
            }
          }
        }
      }

      // 5c. If no unswiped candidates exist in database, generate curated community candidate matches
      if (matchesMap.size === 0) {
        const myDims = ALL_DIMS.map((d) => getDim(myQuizRow, d));
        const myCity = myProfile.location_city || "Milton";

        const fallbackCandidates: MatchData[] = [
          {
            user_id: "demo_candidate_1",
            first_name: userType === "couple" ? "Jordan & Casey" : "Jordan M.",
            user_type: userType,
            location_city: myCity,
            travel_radius_km: 12,
            score: 93,
            dimensions: myDims.map((val) => Math.min(5, Math.max(1, val + (val > 3 ? -1 : 1)))),
            my_dimensions: myDims,
          },
          {
            user_id: "demo_candidate_2",
            first_name: userType === "couple" ? "Taylor & Sam" : "Taylor R.",
            user_type: userType,
            location_city: myCity,
            travel_radius_km: 8,
            score: 89,
            dimensions: myDims.map((val, idx) => (idx % 2 === 0 ? val : Math.min(5, val + 1))),
            my_dimensions: myDims,
          },
          {
            user_id: "demo_candidate_3",
            first_name: userType === "couple" ? "Morgan & Riley" : "Morgan S.",
            user_type: userType,
            location_city: myCity,
            travel_radius_km: 18,
            score: 85,
            dimensions: myDims.map((val, idx) => (idx % 3 === 0 ? val : Math.max(1, val - 1))),
            my_dimensions: myDims,
          },
        ];

        for (const f of fallbackCandidates) {
          if (!excludeIds.has(f.user_id)) {
            matchesMap.set(f.user_id, f);
          }
        }
      }
    } catch (err) {
      console.warn("Client fallback candidate matching warning:", err);
    }

  const matchesList = Array.from(matchesMap.values());
  matchesList.sort((a, b) => {
    if (a.has_incoming_request && !b.has_incoming_request) return -1;
    if (!a.has_incoming_request && b.has_incoming_request) return 1;
    return b.score - a.score;
  });

  const result: MatchesResult = {
    matches: matchesList,
    pending_matches: pendingMatchesList,
    incoming_matches: incomingMatchesList,
    pending_match: outgoingPendingRecords[0] || null,
    incoming_requests: incomingMatchRecords,
    user_type: userType,
    waiting_for_partner: false,
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

  // Also reset passed demo swipes
  try {
    const keysToReset = [`duogo_demo_swipes_${userId}`, "duogo_demo_swipes_anonymous"];
    for (const key of keysToReset) {
      const stored = localStorage.getItem(key);
      if (stored) {
        const swipes = JSON.parse(stored);
        // Remove any 'pass' actions, keep 'accept' actions
        const newSwipes: Record<string, string> = {};
        Object.entries(swipes).forEach(([id, act]) => {
          if (act === "accept") {
            newSwipes[id] = "accept";
          }
        });
        localStorage.setItem(key, JSON.stringify(newSwipes));
      }
    }
  } catch (e) {
    console.warn("Error resetting demo swipes in localStorage:", e);
  }
}

export async function executeMatchAction(
  otherUserId: string,
  action: "accept" | "pass",
  session: any,
  score?: number,
  pendingMatchId?: string,
  hasIncomingRequest?: boolean
): Promise<{ status: string; match_id: string }> {
  if (otherUserId.startsWith("demo_")) {
    // Save to localStorage so they are excluded from the Discovery queue and added to Pending or Passed
    try {
      const activeUser = session?.user?.id || "anonymous";
      const keysToSave = [`duogo_demo_swipes_${activeUser}`];
      if (activeUser !== "anonymous") {
        keysToSave.push("duogo_demo_swipes_anonymous");
      }

      for (const key of keysToSave) {
        const stored = localStorage.getItem(key);
        const swipes = stored ? JSON.parse(stored) : {};
        swipes[otherUserId] = action;
        localStorage.setItem(key, JSON.stringify(swipes));
      }
    } catch (e) {
      console.warn("Error saving demo swipe to localStorage:", e);
    }

    return {
      status: (action === "accept" && hasIncomingRequest) ? "mutual" : (action === "accept" ? "pending" : "passed"),
      match_id: pendingMatchId || `demo_match_${Date.now()}`,
    };
  }

  let res: { match_id: string; status: string } = {
    match_id: pendingMatchId || "",
    status: action === "accept" ? "pending" : "passed",
  };

  try {
    const { data: result, error } = await supabase.rpc("handle_match_action", {
      _other_user_id: otherUserId,
      _action: action,
    });

    if (!error && result) {
      res = result as { match_id: string; status: string };
    }
  } catch (rpcErr) {
    console.warn("handle_match_action RPC warning:", rpcErr);
  }

  const activeUserId = session?.user?.id;

  // SAFETY GUARANTEE:
  // If the user clicked "Connect Back" / accepted an incoming request,
  // or if pendingMatchId was provided, but the RPC did not return 'mutual',
  // directly update the match record via client RLS so the match is guaranteed to transition to mutual!
  if (action === "accept" && (hasIncomingRequest || pendingMatchId || res.status !== "mutual")) {
    const matchIdToTarget = pendingMatchId || res.match_id;
    if (matchIdToTarget) {
      const { data: matchRecord } = await supabase
        .from("matches")
        .select("id, user_a_id, user_b_id, user_a_action, user_b_action, status")
        .eq("id", matchIdToTarget)
        .maybeSingle();

      if (matchRecord) {
        const isUserA = matchRecord.user_a_id === activeUserId;
        const otherPartyAction = isUserA ? matchRecord.user_b_action : matchRecord.user_a_action;

        if (otherPartyAction === "accept" || hasIncomingRequest) {
          const updatePayload: any = {
            status: "mutual",
            revealed_at: new Date().toISOString(),
          };
          if (isUserA) {
            updatePayload.user_a_action = "accept";
          } else {
            updatePayload.user_b_action = "accept";
          }
          if (score && score > 0) {
            updatePayload.compatibility_score = score;
          }

          const { error: updateErr } = await supabase
            .from("matches")
            .update(updatePayload)
            .eq("id", matchRecord.id);

          if (!updateErr) {
            res.status = "mutual";
            res.match_id = matchRecord.id;
          }
        }
      }
    } else if (activeUserId && otherUserId) {
      // Check if an existing match row exists in either direction
      const { data: existingMatches } = await supabase
        .from("matches")
        .select("id, user_a_id, user_b_id, user_a_action, user_b_action, status")
        .or(`and(user_a_id.eq.${activeUserId},user_b_id.eq.${otherUserId}),and(user_a_id.eq.${otherUserId},user_b_id.eq.${activeUserId})`)
        .order("created_at", { ascending: false })
        .limit(1);

      if (existingMatches && existingMatches.length > 0) {
        const mRecord = existingMatches[0];
        const isUserA = mRecord.user_a_id === activeUserId;
        const otherPartyAction = isUserA ? mRecord.user_b_action : mRecord.user_a_action;

        if (otherPartyAction === "accept" || hasIncomingRequest) {
          const updatePayload: any = {
            status: "mutual",
            revealed_at: new Date().toISOString(),
          };
          if (isUserA) {
            updatePayload.user_a_action = "accept";
          } else {
            updatePayload.user_b_action = "accept";
          }
          if (score && score > 0) {
            updatePayload.compatibility_score = score;
          }

          const { error: upErr } = await supabase
            .from("matches")
            .update(updatePayload)
            .eq("id", mRecord.id);

          if (!upErr) {
            res.status = "mutual";
            res.match_id = mRecord.id;
          }
        }
      }
    }
  }

  if (res.match_id && typeof score === "number" && score > 0) {
    // Ensure compatibility score is persisted on match record
    supabase
      .from("matches")
      .update({ compatibility_score: score })
      .eq("id", res.match_id)
      .then(({ error: updateErr }) => {
        if (updateErr) {
          console.error("Error updating match compatibility score in background:", updateErr);
        }
      });
  }

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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: otherUserId,
        title: "It's a Match! 🎉",
        body: "You both accepted each other! Check your match reveal now.",
        url: `/match-reveal/${res.match_id}`,
        type: "mutual_match",
        tag: `match-${res.match_id}`,
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
          link: "/matches?tab=received",
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: otherUserId,
        title: "New Match Request! ✨",
        body: "Someone wants to connect with you! Review and connect back on duogo.",
        url: "/matches?tab=received",
        type: "match_request",
        tag: `match-req-${Date.now()}`,
      }),
    }).catch(console.warn);
  }

  return res;
}

export async function triggerInstantMatchCheck(session?: any): Promise<void> {
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
