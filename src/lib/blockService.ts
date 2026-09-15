import { supabase } from "@/integrations/supabase/client";
import { QueryClient } from "@tanstack/react-query";

export interface ToggleBlockParams {
  currentUserId: string;
  targetUserId: string;
  matchId?: string | null;
  shouldBlock: boolean;
  queryClient?: QueryClient;
}

/**
 * Fetches all blocked user IDs related to the user (both users blocked by current user and users who blocked current user)
 */
export async function fetchBlockedUserIds(userId: string): Promise<Set<string>> {
  if (!userId) return new Set();

  try {
    const { data, error } = await supabase
      .from("blocks" as any)
      .select("blocker_id, blocked_user_id")
      .or(`blocker_id.eq.${userId},blocked_user_id.eq.${userId}`);

    if (error) {
      console.warn("[BlockService] fetchBlockedUserIds query note:", error.message);
      return new Set();
    }

    const blockedIds = new Set<string>();
    (data || []).forEach((row: any) => {
      if (row.blocker_id === userId && row.blocked_user_id) {
        blockedIds.add(row.blocked_user_id);
      }
      if (row.blocked_user_id === userId && row.blocker_id) {
        blockedIds.add(row.blocker_id);
      }
    });

    return blockedIds;
  } catch (err) {
    console.warn("[BlockService] Error fetching blocked user IDs:", err);
    return new Set();
  }
}

/**
 * Checks if a specific target user is blocked by current user
 */
export async function checkIsUserBlocked(currentUserId: string, targetUserId: string): Promise<boolean> {
  if (!currentUserId || !targetUserId) return false;

  try {
    const { data, error } = await supabase
      .from("blocks" as any)
      .select("id")
      .eq("blocker_id", currentUserId)
      .eq("blocked_user_id", targetUserId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.warn("[BlockService] checkIsUserBlocked note:", error.message);
      return false;
    }

    return Boolean(data);
  } catch (err) {
    console.warn("[BlockService] Error checking block status:", err);
    return false;
  }
}

/**
 * Toggles a user's blocked status (block or unblock)
 */
export async function toggleBlockUser({
  currentUserId,
  targetUserId,
  matchId,
  shouldBlock,
  queryClient,
}: ToggleBlockParams): Promise<{ success: boolean; error?: string }> {
  if (!currentUserId || !targetUserId) {
    return { success: false, error: "Missing required user IDs" };
  }

  try {
    if (shouldBlock) {
      // 1. Insert into blocks table
      const { error: blockInsertErr } = await supabase
        .from("blocks" as any)
        .upsert(
          {
            blocker_id: currentUserId,
            blocked_user_id: targetUserId,
          },
          { onConflict: "blocker_id,blocked_user_id" }
        );

      if (blockInsertErr && !blockInsertErr.message.includes("unique")) {
        console.warn("[BlockService] Direct blocks insert note:", blockInsertErr.message);
      }

      // 2. Call RPC block_match_user if available
      try {
        await supabase.rpc("block_match_user" as any, {
          _other_user_id: targetUserId,
          _match_id: matchId || "00000000-0000-0000-0000-000000000000",
        });
      } catch (rpcErr) {
        console.warn("[BlockService] RPC block_match_user note:", rpcErr);
      }

      // 3. Update match record status if matchId exists
      if (matchId) {
        await supabase
          .from("matches")
          .update({ status: "blocked" })
          .eq("id", matchId);
      }
    } else {
      // UNBLOCK: Remove from blocks table
      const { error: unblockErr } = await supabase
        .from("blocks" as any)
        .delete()
        .eq("blocker_id", currentUserId)
        .eq("blocked_user_id", targetUserId);

      if (unblockErr) {
        console.warn("[BlockService] Unblock delete error:", unblockErr.message);
      }

      // If match was previously blocked, reset or unblock status
      if (matchId) {
        await supabase
          .from("matches")
          .update({ status: "passed_by_a" })
          .eq("id", matchId);
      }
    }

    // Invalidate react-query caches
    if (queryClient) {
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["chat-summary"] });
      queryClient.invalidateQueries({ queryKey: ["match-reveal"] });
      queryClient.invalidateQueries({ queryKey: ["match-chat"] });
      queryClient.invalidateQueries({ queryKey: ["block-status", targetUserId] });
    }

    return { success: true };
  } catch (err: any) {
    console.error("[BlockService] Toggle block error:", err);
    return { success: false, error: err.message || "Failed to update block status" };
  }
}
