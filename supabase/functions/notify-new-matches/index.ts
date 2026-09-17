import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ALL_DIMS,
  COUPLE_THRESHOLD,
  SOLO_THRESHOLD,
  QuizRow,
  buildCoupleVector,
  coupleOverlapScore,
  soloScore,
  vectorFromRow,
} from "../_shared/scoring.ts";
import { isAuthorizedCronCall } from "../_shared/cronAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const isCronOrService = isAuthorizedCronCall(req);
  let callingUser: any = null;

  if (!isCronOrService) {
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const pubKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
      if (pubKey) {
        const userClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          pubKey,
          { global: { headers: { Authorization: authHeader } } }
        );
        const { data: { user } } = await userClient.auth.getUser();
        if (user) callingUser = user;
      }
    }
  }

  if (!isCronOrService && !callingUser) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Eligible users
    const { data: profiles, error: profileErr } = await supabase
      .from("profiles")
      .select("id, user_type")
      .eq("quiz_completed", true)
      .eq("onboarding_completed", true)
      .eq("is_suspended", false)
      .eq("matching_paused", false);

    if (profileErr) {
      console.error("Error fetching profiles:", profileErr);
      return new Response(JSON.stringify({ error: profileErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ notified: 0, checked: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eligibleIds = new Set(profiles.map((p: any) => p.id));

    // Bulk-load everything we need once
    const [{ data: allQuizzes }, { data: allMatches }, { data: allBlocks }, { data: allCouples }, { data: allVectors }] =
      await Promise.all([
        supabase.from("quiz_responses").select("*"),
        supabase.from("matches").select("user_a_id, user_b_id, status"),
        supabase.from("blocks").select("blocker_id, blocked_user_id"),
        supabase.from("couples").select("id, partner_a_id, partner_b_id"),
        supabase.from("couple_vectors").select("*"),
      ]);

    const quizMap = new Map<string, QuizRow>();
    for (const q of allQuizzes || []) quizMap.set(q.user_id, q as QuizRow);

    // partner lookup
    const partnerOf = new Map<string, string>();
    const coupleOfUser = new Map<string, any>();
    for (const c of allCouples || []) {
      coupleOfUser.set(c.partner_a_id, c);
      if (c.partner_b_id) {
        coupleOfUser.set(c.partner_b_id, c);
        partnerOf.set(c.partner_a_id, c.partner_b_id);
        partnerOf.set(c.partner_b_id, c.partner_a_id);
      }
    }

    // blocks (both directions)
    const blockedBy = new Map<string, Set<string>>();
    const addBlock = (a: string, b: string) => {
      if (!blockedBy.has(a)) blockedBy.set(a, new Set());
      blockedBy.get(a)!.add(b);
    };
    for (const b of allBlocks || []) {
      addBlock(b.blocker_id, b.blocked_user_id);
      addBlock(b.blocked_user_id, b.blocker_id);
    }

    // resolved matches (anything already acted on / decided)
    const RESOLVED = ["mutual", "passed_by_a", "passed_by_b", "blocked", "pending"];
    const interactedWith = new Map<string, Set<string>>();
    const addInteraction = (a: string, b: string) => {
      if (!interactedWith.has(a)) interactedWith.set(a, new Set());
      interactedWith.get(a)!.add(b);
    };
    for (const m of allMatches || []) {
      if (!RESOLVED.includes(m.status)) continue;
      addInteraction(m.user_a_id, m.user_b_id);
      addInteraction(m.user_b_id, m.user_a_id);
    }

    // Existing notices ledger
    const { data: notices } = await supabase
      .from("match_candidate_notices")
      .select("user_id, candidate_user_id");
    const noticedBy = new Map<string, Set<string>>();
    for (const n of notices || []) {
      if (!noticedBy.has(n.user_id)) noticedBy.set(n.user_id, new Set());
      noticedBy.get(n.user_id)!.add(n.candidate_user_id);
    }

    // Solo candidate pool
    const soloIds = profiles.filter((p: any) => p.user_type === "solo").map((p: any) => p.id);

    // Couple vectors by couple id
    const vectorByCouple = new Map<string, any>();
    for (const v of allVectors || []) vectorByCouple.set(v.couple_id, v);

    const buildExclusions = (userId: string): Set<string> => {
      const excluded = new Set<string>([userId]);
      const partnerId = partnerOf.get(userId);
      const sides = [userId];
      if (partnerId) {
        excluded.add(partnerId);
        sides.push(partnerId);
      }
      for (const side of sides) {
        for (const b of blockedBy.get(side) || []) excluded.add(b);
        for (const i of interactedWith.get(side) || []) excluded.add(i);
      }
      return excluded;
    };

    const candidatesFor = (profile: any): string[] => {
      const excluded = buildExclusions(profile.id);

      if (profile.user_type === "solo") {
        const myQuiz = quizMap.get(profile.id);
        if (!myQuiz) return [];
        const out: string[] = [];
        for (const otherId of soloIds) {
          if (excluded.has(otherId)) continue;
          const otherQuiz = quizMap.get(otherId);
          if (!otherQuiz) continue;
          if (soloScore(myQuiz, otherQuiz) >= SOLO_THRESHOLD) out.push(otherId);
        }
        return out;
      }

      if (profile.user_type === "couple") {
        const couple = coupleOfUser.get(profile.id);
        if (!couple || !couple.partner_b_id) return [];
        const partnerId = couple.partner_a_id === profile.id ? couple.partner_b_id : couple.partner_a_id;
        const myQuiz = quizMap.get(profile.id);
        const partnerQuiz = quizMap.get(partnerId);
        if (!myQuiz || !partnerQuiz) return [];

        const myVector = buildCoupleVector(myQuiz, partnerQuiz);
        const out: string[] = [];
        for (const row of allVectors || []) {
          if (row.couple_id === couple.id) continue;
          const otherCouple = (allCouples || []).find((c: any) => c.id === row.couple_id);
          if (!otherCouple) continue;
          // Candidate is represented by partner A (same convention as calculate-matches)
          const candidateId = otherCouple.partner_a_id;
          if (!candidateId || excluded.has(candidateId)) continue;
          if (!eligibleIds.has(candidateId)) continue;
          if (coupleOverlapScore(myVector, vectorFromRow(row)) >= COUPLE_THRESHOLD) out.push(candidateId);
        }
        return out;
      }

      return [];
    };

    let notified = 0;

    const targetProfiles = isCronOrService
      ? profiles
      : profiles.filter((p: any) => p.id === callingUser?.id);

    for (const profile of targetProfiles) {
      const candidates = candidatesFor(profile);
      if (candidates.length === 0) continue;

      const alreadyNoticed = noticedBy.get(profile.id) || new Set<string>();
      const fresh = candidates.filter((c) => !alreadyNoticed.has(c));
      if (fresh.length === 0) continue;

      const count = fresh.length;
      const message =
        count === 1
          ? "A new match is waiting for you 👀"
          : `${count} new matches are waiting for you 👀`;

      // Check if user already received any match notification in the last 24 hours to prevent spam/duplicates
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: existingNotifs } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", profile.id)
        .gte("created_at", oneDayAgo)
        .ilike("message", "%new match%")
        .limit(1);

      if (existingNotifs && existingNotifs.length > 0) {
        // Record the ledger to ensure synchronization without inserting duplicate notification
        await supabase
          .from("match_candidate_notices")
          .upsert(
            fresh.map((candidateId) => ({ user_id: profile.id, candidate_user_id: candidateId })),
            { onConflict: "user_id,candidate_user_id", ignoreDuplicates: true }
          );
        continue;
      }

      const { error: notifErr } = await supabase.from("notifications").insert({
        user_id: profile.id,
        message,
        link: "/matches",
      });
      if (notifErr) {
        console.error(`Notification insert failed for ${profile.id}:`, notifErr);
        continue;
      }

      // Web push (best effort)
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            user_id: profile.id,
            title: count === 1 ? "A new match is waiting 👀" : `${count} new matches waiting 👀`,
            body: "Open duogo to see who we found for you.",
            url: "/matches",
          }),
        });
      } catch (pushErr) {
        console.error(`Push failed for ${profile.id}:`, pushErr);
      }

      // Record the ledger so we never re-notify about the same people
      const { error: ledgerErr } = await supabase
        .from("match_candidate_notices")
        .upsert(
          fresh.map((candidateId) => ({ user_id: profile.id, candidate_user_id: candidateId })),
          { onConflict: "user_id,candidate_user_id", ignoreDuplicates: true }
        );
      if (ledgerErr) console.error(`Ledger insert failed for ${profile.id}:`, ledgerErr);

      notified++;
    }

    return new Response(JSON.stringify({ notified, checked: targetProfiles.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-new-matches error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
