import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ALL_DIMS,
  COUPLE_THRESHOLD,
  SOLO_THRESHOLD,
  QuizRow,
  CoupleVector,
  buildCoupleVector,
  coupleOverlapScore,
  getDim,
  soloScore,
} from "../_shared/scoring.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user from JWT
    const publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkYm9icXpxc21tc256Ymp0emJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMTY3NDQsImV4cCI6MjA4NzY5Mjc0NH0.U_lS4-1zpd36SR4xxGDdXSBfM3408wv4pRbfDGUbQ4k";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      publishableKey,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's profile with onboarding and quiz completion checks
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_type, location_city, travel_radius_km, quiz_completed, onboarding_completed, first_name")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Never generate or suggest matches for users who haven't completed onboarding and the quiz
    if (!profile.quiz_completed || !profile.onboarding_completed || !profile.first_name) {
      return new Response(JSON.stringify({
        matches: [],
        pending_match: null,
        user_type: profile.user_type || "solo",
        quiz_needed: !profile.quiz_completed,
        onboarding_needed: !profile.onboarding_completed,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's quiz response
    const { data: myQuiz } = await supabase
      .from("quiz_responses")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!myQuiz) {
      return new Response(JSON.stringify({
        matches: [],
        pending_match: null,
        user_type: profile.user_type || "solo",
        quiz_needed: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get existing matches to exclude (include partner's matches for couples)
    const matchFilterParts = [`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`];

    // For couples, also check partner's matches
    let myPartnerId: string | null = null;
    if (profile.user_type === "couple") {
      const { data: myCouple } = await supabase
        .from("couples")
        .select("partner_a_id, partner_b_id")
        .or(`partner_a_id.eq.${user.id},partner_b_id.eq.${user.id}`)
        .maybeSingle();
      if (myCouple) {
        myPartnerId = myCouple.partner_a_id === user.id ? myCouple.partner_b_id : myCouple.partner_a_id;
        if (myPartnerId) {
          matchFilterParts.push(`user_a_id.eq.${myPartnerId},user_b_id.eq.${myPartnerId}`);
        }
      }
    }

    const { data: existingMatches } = await supabase
      .from("matches")
      .select("id, user_a_id, user_b_id, status, user_a_action, user_b_action, compatibility_score")
      .or(matchFilterParts.join(","));

    // Get blocks (both directions)
    const { data: blocksData } = await supabase
      .from("blocks")
      .select("blocker_id, blocked_user_id")
      .or(`blocker_id.eq.${user.id},blocked_user_id.eq.${user.id}`);

    const excludeIds = new Set<string>();
    excludeIds.add(user.id);

    // Exclude blocked users (both directions)
    for (const b of blocksData || []) {
      excludeIds.add(b.blocker_id === user.id ? b.blocked_user_id : b.blocker_id);
    }

    if (myPartnerId) excludeIds.add(myPartnerId);

    for (const m of existingMatches || []) {
      // Exclude the "other side" of any existing completed or passed match
      const participantIds = new Set([user.id]);
      if (myPartnerId) participantIds.add(myPartnerId);
      
      const otherIds = [m.user_a_id, m.user_b_id].filter(id => !participantIds.has(id));
      
      if (m.status === 'passed_by_a' || m.status === 'passed_by_b' || m.status === 'mutual' || m.status === 'blocked' || m.status === 'pending') {
        for (const oid of otherIds) excludeIds.add(oid);
      }
    }

    // Determine outgoing pending match (user sent request, waiting for other party)
    const outgoingPendingMatch = (existingMatches || []).find(m => {
      if (m.status !== 'pending') return false;
      const isA = m.user_a_id === user.id || m.user_a_id === myPartnerId;
      const isB = m.user_b_id === user.id || m.user_b_id === myPartnerId;
      if (isA && m.user_a_action === 'accept' && !m.user_b_action) return true;
      if (isB && m.user_b_action === 'accept' && !m.user_a_action) return true;
      return false;
    });

    // Determine incoming match requests (the other party sent request, user has not acted yet)
    const incomingRequests = (existingMatches || []).filter(m => {
      if (m.status !== 'pending') return false;
      const isA = m.user_a_id === user.id || m.user_a_id === myPartnerId;
      const isB = m.user_b_id === user.id || m.user_b_id === myPartnerId;
      if (isA && m.user_b_action === 'accept' && !m.user_a_action) return true;
      if (isB && m.user_a_action === 'accept' && !m.user_b_action) return true;
      return false;
    });

    if (profile.user_type === "solo") {
      // Get all other solo users with completed quiz (exclude suspended)
      const { data: otherProfiles } = await supabase
        .from("profiles")
        .select("id, first_name, user_type, location_city, travel_radius_km, is_suspended")
        .eq("user_type", "solo")
        .eq("quiz_completed", true)
        .eq("is_suspended", false)
        .eq("matching_paused", false)
        .neq("id", user.id);

      const { data: allQuizzes } = await supabase
        .from("quiz_responses")
        .select("*");

      const quizMap = new Map<string, QuizRow>();
      for (const q of allQuizzes || []) {
        quizMap.set(q.user_id, q as QuizRow);
      }

      const matches: any[] = [];
      for (const other of otherProfiles || []) {
        if (excludeIds.has(other.id)) continue;
        const otherQuiz = quizMap.get(other.id);
        if (!otherQuiz) continue;

        const score = soloScore(myQuiz as QuizRow, otherQuiz);
        if (score >= SOLO_THRESHOLD) {
          matches.push({
            user_id: other.id,
            first_name: other.first_name,
            user_type: other.user_type,
            location_city: other.location_city,
            travel_radius_km: other.travel_radius_km,
            score,
            dimensions: ALL_DIMS.map(d => getDim(otherQuiz, d)),
            my_dimensions: ALL_DIMS.map(d => getDim(myQuiz as QuizRow, d)),
          });
        }
      }

      // Add incoming requests to the top of matches so the user can accept
      for (const inc of incomingRequests) {
        const otherId = inc.user_a_id === user.id ? inc.user_b_id : inc.user_a_id;
        const alreadyIn = matches.find(m => m.user_id === otherId);
        if (alreadyIn) {
          alreadyIn.has_incoming_request = true;
          alreadyIn.pending_match_id = inc.id;
        } else {
          // Fetch other profile directly if not in filtered list
          const { data: incProfile } = await supabase
            .from("profiles")
            .select("id, first_name, user_type, location_city, travel_radius_km")
            .eq("id", otherId)
            .maybeSingle();

          let incQuiz = quizMap.get(otherId);
          if (!incQuiz) {
            const { data: qData } = await supabase.from("quiz_responses").select("*").eq("user_id", otherId).maybeSingle();
            incQuiz = qData as QuizRow;
          }

          if (incProfile) {
            matches.unshift({
              user_id: incProfile.id,
              first_name: incProfile.first_name || "Match Candidate",
              user_type: incProfile.user_type || "solo",
              location_city: incProfile.location_city,
              travel_radius_km: incProfile.travel_radius_km,
              score: inc.compatibility_score && inc.compatibility_score > 0 ? inc.compatibility_score : (incQuiz ? soloScore(myQuiz as QuizRow, incQuiz) : 85),
              dimensions: incQuiz ? ALL_DIMS.map(d => getDim(incQuiz!, d)) : [3,3,3,3,3,3,3,3,3,3],
              my_dimensions: ALL_DIMS.map(d => getDim(myQuiz as QuizRow, d)),
              has_incoming_request: true,
              pending_match_id: inc.id,
            });
          }
        }
      }

      matches.sort((a, b) => {
        if (a.has_incoming_request && !b.has_incoming_request) return -1;
        if (!a.has_incoming_request && b.has_incoming_request) return 1;
        return b.score - a.score;
      });

      return new Response(JSON.stringify({
        matches,
        pending_match: outgoingPendingMatch || null,
        user_type: "solo",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // COUPLE matching
    if (profile.user_type === "couple") {
      // Get my couple
      const { data: myCouple } = await supabase
        .from("couples")
        .select("id, partner_a_id, partner_b_id, both_verified")
        .or(`partner_a_id.eq.${user.id},partner_b_id.eq.${user.id}`)
        .single();

      if (!myCouple || !myCouple.partner_b_id) {
        return new Response(JSON.stringify({
          matches: [],
          pending_match: null,
          user_type: "couple",
          waiting_for_partner: true,
          partner_needed: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get partner's quiz
      const partnerId = myCouple.partner_a_id === user.id ? myCouple.partner_b_id : myCouple.partner_a_id;
      if (!partnerId) {
        return new Response(JSON.stringify({
          matches: [],
          pending_match: null,
          user_type: "couple",
          waiting_for_partner: true,
          partner_needed: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: partnerQuiz } = await supabase
        .from("quiz_responses")
        .select("*")
        .eq("user_id", partnerId)
        .single();

      if (!partnerQuiz) {
        return new Response(JSON.stringify({
          matches: [],
          pending_match: null,
          user_type: "couple",
          waiting_for_partner: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Build our couple vector
      const myVector = buildCoupleVector(myQuiz as QuizRow, partnerQuiz as QuizRow);

      // Store couple vector
      await supabase.from("couple_vectors").upsert({
        couple_id: myCouple.id,
        d1_min: myVector.mins[0], d1_max: myVector.maxs[0],
        d2_min: myVector.mins[1], d2_max: myVector.maxs[1],
        d3_min: myVector.mins[2], d3_max: myVector.maxs[2],
        d4_min: myVector.mins[3], d4_max: myVector.maxs[3],
        d5_min: myVector.mins[4], d5_max: myVector.maxs[4],
        d6_min: myVector.mins[5], d6_max: myVector.maxs[5],
        d7_min: myVector.mins[6], d7_max: myVector.maxs[6],
        d8_min: myVector.mins[7], d8_max: myVector.maxs[7],
        d9_min: myVector.mins[8], d9_max: myVector.maxs[8],
        d10_min: myVector.mins[9], d10_max: myVector.maxs[9],
      }, { onConflict: "couple_id" });

      // Get all other couple vectors
      const { data: otherVectors } = await supabase
        .from("couple_vectors")
        .select("*")
        .neq("couple_id", myCouple.id);

      // Get all couple info for context
      const { data: allCouples } = await supabase
        .from("couples")
        .select("id, partner_a_id, partner_b_id");

      const coupleMap = new Map<string, any>();
      for (const c of allCouples || []) coupleMap.set(c.id, c);

      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, first_name, location_city, travel_radius_km");

      const profileMap = new Map<string, any>();
      for (const p of allProfiles || []) profileMap.set(p.id, p);

      const matches: any[] = [];
      for (const ov of otherVectors || []) {
        const couple = coupleMap.get(ov.couple_id);
        if (couple && (excludeIds.has(couple.partner_a_id) || (couple.partner_b_id && excludeIds.has(couple.partner_b_id)))) {
          continue;
        }

        const otherVector: CoupleVector = {
          couple_id: ov.couple_id,
          mins: [ov.d1_min, ov.d2_min, ov.d3_min, ov.d4_min, ov.d5_min, ov.d6_min, ov.d7_min, ov.d8_min, ov.d9_min, ov.d10_min],
          maxs: [ov.d1_max, ov.d2_max, ov.d3_max, ov.d4_max, ov.d5_max, ov.d6_max, ov.d7_max, ov.d8_max, ov.d9_max, ov.d10_max],
        };

        const score = coupleOverlapScore(myVector, otherVector);
        if (score >= COUPLE_THRESHOLD) {
          const partnerAProfile = couple ? profileMap.get(couple.partner_a_id) : null;

          matches.push({
            couple_id: ov.couple_id,
            user_id: couple?.partner_a_id,
            first_name: partnerAProfile?.first_name || "Couple",
            user_type: "couple",
            location_city: partnerAProfile?.location_city,
            travel_radius_km: partnerAProfile?.travel_radius_km,
            score,
            dimensions: otherVector.maxs,
            dimensions_min: otherVector.mins,
            my_dimensions: myVector.maxs,
            my_dimensions_min: myVector.mins,
          });
        }
      }

      matches.sort((a, b) => b.score - a.score);

      return new Response(JSON.stringify({
        matches,
        pending_match: outgoingPendingMatch || null,
        user_type: "couple",
        my_vector: { mins: myVector.mins, maxs: myVector.maxs },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown user type" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
