export interface RawNotification {
  id: string;
  message: string;
  read: boolean;
  created_at: string;
  link: string | null;
  type?: "match" | "message" | "mutual" | "system";
  associated_ids?: string[];
}

/**
 * Deduplicates notifications so identical alerts (e.g. repeated "15 new matches are waiting for you")
 * or redundant state transitions are collapsed into a single clean item.
 * Preserves the most recent timestamp and unread status if any duplicate is unread.
 */
export function deduplicateNotifications(items: RawNotification[]): RawNotification[] {
  const result: RawNotification[] = [];
  // Map of normalized message + link key -> index in result
  const keyMap = new Map<string, number>();

  for (const item of items) {
    if (!item || !item.id) continue;

    const normMsg = (item.message || "").trim().toLowerCase();
    const normLink = (item.link || "").trim();
    // Unique fingerprint for grouping identical messages & links
    const dedupKey = `${normMsg}::${normLink}`;

    if (keyMap.has(dedupKey)) {
      const existingIdx = keyMap.get(dedupKey)!;
      const existing = result[existingIdx];

      // Merge:
      // 1. If either is unread, the collapsed notification is unread (so user doesn't miss it)
      const mergedRead = existing.read && item.read;

      // 2. Take the newer created_at timestamp
      const timeExisting = new Date(existing.created_at).getTime() || 0;
      const timeItem = new Date(item.created_at).getTime() || 0;
      const newerCreatedAt = timeItem > timeExisting ? item.created_at : existing.created_at;

      // 3. Keep track of all underlying database IDs so marking as read updates all duplicates in the backend
      const existingIds = existing.associated_ids || [existing.id];
      const itemIds = item.associated_ids || [item.id];
      const mergedIds = Array.from(new Set([...existingIds, ...itemIds]));

      result[existingIdx] = {
        ...existing,
        read: mergedRead,
        created_at: newerCreatedAt,
        associated_ids: mergedIds,
      };
    } else {
      keyMap.set(dedupKey, result.length);
      result.push({
        ...item,
        associated_ids: item.associated_ids || [item.id],
      });
    }
  }

  // Sort by created_at descending
  return result.sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
  });
}
