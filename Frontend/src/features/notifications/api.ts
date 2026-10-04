import { apiGet, apiPost } from "@/lib/http";
import type { Notification } from "@/types";

export async function getNotifications() {
  return apiGet<{ data: Notification[]; unreadCount: number }>(`/notifications/`);
}

export async function markNotificationRead(id: number) {
  return apiPost(`/notifications/${id}/read/`, {});
}

export async function markAllNotificationsRead() {
  return apiPost(`/notifications/read-all/`, {});
}
