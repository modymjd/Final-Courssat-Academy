import { apiGet, apiPatch, apiPost } from "@/lib/http";
import type { Instructor, User } from "@/types/auth";
import type { Course, PaginatedResponse, Review } from "@/types/course";

export async function getInstructors(params?: Record<string, unknown>) {
  return apiGet<PaginatedResponse<Instructor>>("/accounts/instructors/", params);
}

export async function getInstructorProfile(id: number) {
  return apiGet<{ instructor: Instructor; courses: Course[]; reviews?: Review[] }>(`/accounts/instructors/${id}/`);
}

export async function updateUserProfile(data: Record<string, any>) {
  return apiPatch<User>("/accounts/me/", data);
}

export async function changePassword(data: { old_password: string; new_password: string }) {
  return apiPost<{ detail: string }>("/accounts/change-password/", data);
}
