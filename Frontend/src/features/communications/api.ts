import { apiGet } from "@/lib/http";

export interface CalendarEvent {
  id: number;
  title: string;
  date: string;
  type: "live_session" | "assignment" | "exam";
  description?: string;
  link?: string;
}

export async function getCalendarEvents(params?: Record<string, unknown>) {
  return apiGet<CalendarEvent[]>("/communications/calendar/", params);
}
