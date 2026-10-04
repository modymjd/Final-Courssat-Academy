import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/http";
import type { User, Course } from "@/types";

export async function getAdminUsers() {
  return apiGet<User[]>(`/auth/admin/users/`);
}

export async function getAdminCourses() {
  return apiGet<Course[]>(`/courses/`);
}

export async function deleteUser(userId: number) {
  return apiDelete(`/auth/admin/users/${userId}/`);
}

export async function deleteCourse(courseId: number) {
  return apiDelete(`/courses/${courseId}/`);
}
