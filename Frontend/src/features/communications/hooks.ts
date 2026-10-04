import { useQuery } from "@tanstack/react-query";
import { getCalendarEvents } from "./api";

export function useCalendarEvents(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['calendarEvents', params],
    queryFn: () => getCalendarEvents(params),
  });
}
