import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/http";
import type { Course, Grade } from "@/types";

type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function extractItems<T>(response: any): T[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.results)) return response.results;
  return [];
}

async function getAllPages<T>(path: string, baseParams: Record<string, unknown>): Promise<T[]> {
  const first = await apiGet<any>(path, { ...baseParams, page: 1, pageSize: 50 });
  const items = [...extractItems<T>(first)];
  const totalPages = Math.max(first?.totalPages ?? first?.total_pages ?? (first?.count ? Math.ceil(first.count / 50) : 1), 1);

  for (let page = 2; page <= totalPages; page += 1) {
    const response = await apiGet<any>(path, { ...baseParams, page, pageSize: 50 });
    items.push(...extractItems<T>(response));
  }
  return items;
}

export async function getInstructorCourses(): Promise<Course[]> {
  const rawList = await getAllPages<any>("/courses/", { mine: true });
  return rawList.map((c: any) => ({
    ...c,
    id: Number(c.id),
    title: String(c.title || ""),
    description: String(c.description || ""),
    shortDescription: String(c.shortDescription || c.short_description || ""),
    image: c.image || c.image_url || "",
    isFree: Boolean(c.isFree ?? c.is_free),
    price: Number(c.price || 0),
    rating: Number(c.rating || 0),
    studentCount: Number(c.studentCount ?? c.student_count ?? 0),
    lessonCount: Number(c.lessonCount ?? c.lesson_count ?? 0),
    status: c.status || "draft",
  }));
}

export async function getInstructorGrades(): Promise<Grade[]> {
  const rawList = await getAllPages<any>("/grades/", {});
  return rawList.map((g: any) => ({
    ...g,
    id: Number(g.id),
    studentName: String(g.studentName || g.student_name || "طالب"),
    courseName: String(g.courseName || g.course_title || g.course_name || "الدورة"),
    assignmentTitle: String(g.assignmentTitle || g.assignment_title || g.assignment || "واجب"),
    score: Number(g.score || 0),
    maxScore: Number(g.maxScore ?? g.max_score ?? 100),
    gradedAt: String(g.gradedAt || g.graded_at || g.created_at || new Date().toISOString()),
  }));
}

export async function createCourse(data: Record<string, unknown>) {
  return apiPost<Course>("/courses/", data);
}

export async function updateCourse(id: number, data: Record<string, unknown>) {
  return apiPatch<Course>(`/courses/${id}/`, data);
}

export async function deleteInstructorCourse(id: number) {
  return apiDelete(`/courses/${id}/`);
}

export async function updateGrade(id: number, data: Record<string, unknown>) {
  return apiPatch<Grade>(`/grades/${id}/`, data);
}
