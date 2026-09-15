import { supabase } from "@/integrations/supabase/client";

/**
 * For couple users, fetches their partner's user ID.
 * Returns null for solo users or if no couple found.
 */
export async function getCouplePartnerId(userId: string): Promise<string | null> {
  const { data: couple } = await supabase
    .from("couples")
    .select("partner_a_id, partner_b_id")
    .or(`partner_a_id.eq.${userId},partner_b_id.eq.${userId}`)
    .maybeSingle();

  if (!couple) return null;
  return couple.partner_a_id === userId ? couple.partner_b_id : couple.partner_a_id;
}

/**
 * Given a match record and the current user (who may be a couple partner),
 * returns the "other side" user ID: i.e. the person NOT on the current user's couple.
 */
export function resolveOtherId(
  match: { user_a_id: string; user_b_id: string },
  currentUserId: string,
  partnerId: string | null
): string {
  const myIds = new Set([currentUserId]);
  if (partnerId) myIds.add(partnerId);

  // The "other" is whichever match participant is NOT in our couple
  if (!myIds.has(match.user_a_id)) return match.user_a_id;
  if (!myIds.has(match.user_b_id)) return match.user_b_id;

  // Fallback: both sides are "ours" (shouldn't happen)
  return match.user_a_id === currentUserId ? match.user_b_id : match.user_a_id;
}
