"use server";

import "server-only";

import { getViewer } from "@/server/auth/dal";
import { listNotifications, markNotificationsRead } from "@/server/queries/member";

/** Called when the notifications page has been seen. */
export async function markAllNotificationsRead(): Promise<void> {
  const viewer = await getViewer();
  if (!viewer) return;
  const unread = (await listNotifications(viewer.id, 100)).filter((n) => n.unread).map((n) => n.id);
  await markNotificationsRead(viewer.id, unread);
}
