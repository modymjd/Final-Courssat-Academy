import { http } from "@/lib/http";

export interface FocusSessionPayload {
  session_id: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  focused: boolean;
  focus_score: number;
  mode: "pomodoro" | "deep_work" | "custom";
  distractions_count: number;
  course_id?: number | null;
}

export const submitFocusSession = async (payload: FocusSessionPayload) => {
  const { data } = await http.post("/analytics/focus-sessions/", payload);
  return data;
};

export const getFocusSessionHistory = async () => {
  const { data } = await http.get("/analytics/focus-sessions/history/");
  return data;
};
