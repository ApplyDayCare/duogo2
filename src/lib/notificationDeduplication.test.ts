import { describe, it, expect } from "vitest";
import { deduplicateNotifications, RawNotification } from "./notificationDeduplication";

describe("deduplicateNotifications", () => {
  it("collapses identical notification messages into a single notification", () => {
    const raw: RawNotification[] = [
      {
        id: "notif-1",
        message: "15 new matches are waiting for you 👀",
        read: true,
        created_at: "2026-09-17T05:00:00.000Z",
        link: "/matches",
        type: "match",
      },
      {
        id: "notif-2",
        message: "15 new matches are waiting for you 👀",
        read: false,
        created_at: "2026-09-17T05:05:00.000Z",
        link: "/matches",
        type: "match",
      },
    ];

    const result = deduplicateNotifications(raw);

    expect(result).toHaveLength(1);
    expect(result[0].message).toBe("15 new matches are waiting for you 👀");
    // If one duplicate was unread, the user should see it as unread
    expect(result[0].read).toBe(false);
    // Associated IDs must include both original IDs
    expect(result[0].associated_ids).toContain("notif-1");
    expect(result[0].associated_ids).toContain("notif-2");
    // Takes the latest timestamp
    expect(result[0].created_at).toBe("2026-09-17T05:05:00.000Z");
  });

  it("retains different notifications independently", () => {
    const raw: RawNotification[] = [
      {
        id: "notif-1",
        message: "15 new matches are waiting for you 👀",
        read: false,
        created_at: "2026-09-17T05:00:00.000Z",
        link: "/matches",
        type: "match",
      },
      {
        id: "notif-3",
        message: "🎉 It's a Mutual Match! You both accepted each other.",
        read: false,
        created_at: "2026-09-17T06:00:00.000Z",
        link: "/match-reveal/abc",
        type: "mutual",
      },
    ];

    const result = deduplicateNotifications(raw);
    expect(result).toHaveLength(2);
  });
});
