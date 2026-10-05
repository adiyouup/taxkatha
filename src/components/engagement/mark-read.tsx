"use client";

import { useEffect, useRef } from "react";

import { useEngagement } from "@/components/engagement/engagement-provider";
import { markAllNotificationsRead } from "@/server/actions/member";

/**
 * Marks notifications read once the list has been shown, and clears the
 * header badge. Exactly once per visit: Server Actions run one at a time and
 * navigations wait behind them, so a repeated call would delay the member's
 * click on a notification.
 */
export function MarkNotificationsRead({ hasUnread }: { hasUnread: boolean }) {
  const { clearUnread } = useEngagement();
  const sent = useRef(false);
  useEffect(() => {
    if (!hasUnread || sent.current) return;
    sent.current = true;
    void markAllNotificationsRead().then(clearUnread);
  }, [hasUnread, clearUnread]);
  return null;
}
