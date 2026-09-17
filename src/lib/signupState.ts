import { supabase } from "@/integrations/supabase/client";
import { getStoredReferralCode, clearStoredReferralCode } from "@/lib/referralUtils";
import { compileQuizDimensions, saveUserQuizResponse } from "@/lib/quizSync";
import { triggerInstantMatchCheck } from "@/lib/matchEngine";

export interface SignupDraft {
  age_group?: string;
  gender?: "male" | "female" | string;
  user_type?: "solo" | "couple";
  has_kids?: boolean;
  kids_stages?: string[];
  kids_count?: number;
  kids_summary?: string;
  looking_for?: string[];
  personality_energy?: "introverted" | "ambivert" | "extroverted" | string;
  free_time_interests?: string[];
  friend_qualities?: string[];
  family_importance?: number;
  first_name?: string;
  social_link?: string;
  avatar_url?: string | null;
  location_city?: string;
  postal_code?: string;
  postal_neighborhood?: string;
  travel_radius_km?: number;
  couple_mode?: "create" | "join" | null;
  couple_code?: string;
  partner_name?: string;
  quiz_answers?: Record<string, number>;
  quiz_completed?: boolean;
  privacy_consented?: boolean;
  email?: string;
}

const SIGNUP_STORAGE_KEY = "duogo_signup_draft";

export function getSignupDraft(): SignupDraft {
  try {
    const raw = localStorage.getItem(SIGNUP_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn("Failed to load signup draft:", e);
    return {};
  }
}

export function updateSignupDraft(partial: Partial<SignupDraft>): SignupDraft {
  try {
    const current = getSignupDraft();
    const updated = { ...current, ...partial };
    localStorage.setItem(SIGNUP_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn("Failed to save signup draft:", e);
    return partial;
  }
}

export function clearSignupDraft() {
  try {
    localStorage.removeItem(SIGNUP_STORAGE_KEY);
  } catch (e) {
    console.warn("Failed to clear signup draft:", e);
  }
}

export function hasSignupDraft(): boolean {
  try {
    const raw = localStorage.getItem(SIGNUP_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed && (parsed.user_type || parsed.age_group || parsed.first_name || parsed.quiz_answers));
  } catch {
    return false;
  }
}

export async function syncSignupDraftToSupabase(user: { id: string; email?: string | null }): Promise<{ ok: boolean; error?: string }> {
  const draft = getSignupDraft();

  try {
    // 1. Fetch existing profile to merge and preserve state
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, first_name, user_type, onboarding_completed, quiz_completed, location_city, avatar_url, social_link")
      .eq("id", user.id)
      .maybeSingle();

    const resolvedFirstName = draft.first_name?.trim() || existingProfile?.first_name?.trim() || user.email?.split("@")[0] || "Member";
    const resolvedUserType = draft.user_type || existingProfile?.user_type || "solo";
    const resolvedLocation = draft.location_city || existingProfile?.location_city || "Milton";

    const profileUpdates: Record<string, unknown> = {
      last_active: new Date().toISOString(),
      user_type: resolvedUserType,
    };

    if (resolvedFirstName) profileUpdates.first_name = resolvedFirstName;
    if (resolvedLocation) profileUpdates.location_city = resolvedLocation;
    if (draft.social_link || existingProfile?.social_link) {
      profileUpdates.social_link = draft.social_link?.trim() || existingProfile?.social_link;
    }
    if (draft.travel_radius_km !== undefined) profileUpdates.travel_radius_km = draft.travel_radius_km;
    if (draft.avatar_url || existingProfile?.avatar_url) {
      profileUpdates.avatar_url = draft.avatar_url || existingProfile?.avatar_url;
    }

    const isQuizDone = Boolean(
      draft.quiz_completed ||
      existingProfile?.quiz_completed ||
      (draft.quiz_answers && Object.keys(draft.quiz_answers).length >= 1)
    );

    if (isQuizDone) {
      profileUpdates.quiz_completed = true;
      profileUpdates.onboarding_completed = true;
    }

    // Mark onboarding complete if user consented to privacy OR has quiz OR draft marked onboarding_completed
    if (draft.privacy_consented || existingProfile?.onboarding_completed || draft.onboarding_completed || isQuizDone) {
      profileUpdates.onboarding_completed = true;
    }

    // Try UPDATE first as users have UPDATE RLS permission on their own profile row
    const profilePayload = {
      email: user.email,
      ...profileUpdates,
    };

    const { error: updateErr } = await supabase
      .from("profiles")
      .update(profilePayload)
      .eq("id", user.id);

    if (updateErr) {
      console.warn("Profile update notice, attempting upsert fallback:", updateErr.message);
      // Fallback to upsert if profile record does not exist yet
      const { error: upsertErr } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          ...profilePayload,
        } as any, { onConflict: "id" });

      if (upsertErr) {
        console.warn("Profile sync notice:", upsertErr.message);
      }
    }

    // 2. Handle couple creation or joining if applicable
    let coupleId: string | null = null;
    if (resolvedUserType === "couple") {
      if (draft.couple_mode === "create" && draft.couple_code) {
        const { data: existingCouple } = await supabase
          .from("couples")
          .select("id")
          .eq("partner_a_id", user.id)
          .maybeSingle();

        if (existingCouple) {
          coupleId = existingCouple.id;
        } else {
          const { data: newCouple } = await supabase
            .from("couples")
            .insert({
              invite_code: draft.couple_code.toUpperCase(),
              partner_a_id: user.id,
            })
            .select("id")
            .maybeSingle();
          coupleId = newCouple?.id ?? null;
        }
      } else if (draft.couple_mode === "join" && draft.couple_code) {
        const { data: coupleToJoin } = await supabase
          .from("couples")
          .select("id, partner_a_id, partner_b_id")
          .eq("invite_code", draft.couple_code.trim().toUpperCase())
          .maybeSingle();

        if (coupleToJoin && !coupleToJoin.partner_b_id && coupleToJoin.partner_a_id !== user.id) {
          await supabase
            .from("couples")
            .update({ partner_b_id: user.id, both_verified: true })
            .eq("id", coupleToJoin.id);
          coupleId = coupleToJoin.id;
        }
      }
    }

    // 3. Insert quiz responses if completed
    if (draft.quiz_answers && Object.keys(draft.quiz_answers).length >= 1) {
      const dimensions = draft.quiz_answers.dimension_1_social !== undefined
        ? (draft.quiz_answers as any)
        : compileQuizDimensions(
            draft.quiz_answers,
            { q3_friend_qualities: draft.friend_qualities || [] },
            draft.personality_energy
          );

      const saveRes = await saveUserQuizResponse(user.id, coupleId, dimensions);
      if (!saveRes.ok) {
        console.warn("Quiz response insert warning:", saveRes.error);
      }
    }

    // 4. Process referral code if present
    const referralCode = getStoredReferralCode();
    if (referralCode) {
      try {
        await supabase.rpc("process_referral", {
          _new_user_id: user.id,
          _referral_code: referralCode,
        });
        clearStoredReferralCode();
      } catch (err) {
        console.warn("Referral processing error:", err);
      }
    }

    // Trigger instant match calculations for the new user and compatible community members
    triggerInstantMatchCheck();

    return { ok: true };
  } catch (err: any) {
    console.error("Failed to sync signup draft:", err);
    return { ok: false, error: err?.message || "Sync failed" };
  }
}
