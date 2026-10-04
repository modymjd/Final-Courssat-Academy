import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/http";
import type {
  StudentNote,
  StudentNoteCreateInput,
  StudentNoteUpdateInput,
  BulkImportNotesResponse,
} from "@/types/note";
import type { PaginatedResponse } from "@/types/course";

export interface GetNotesParams {
  courseId?: number;
  lessonId?: number;
  search?: string;
  isPinned?: boolean;
  page?: number;
  pageSize?: number;
}

export async function fetchStudentNotes(
  params?: GetNotesParams
): Promise<PaginatedResponse<StudentNote>> {
  const query = new URLSearchParams();
  if (params?.courseId) query.append("course_id", String(params.courseId));
  if (params?.lessonId) query.append("lesson_id", String(params.lessonId));
  if (params?.search) query.append("search", params.search);
  if (params?.isPinned !== undefined) query.append("is_pinned", String(params.isPinned));
  if (params?.page) query.append("page", String(params.page));
  if (params?.pageSize) query.append("pageSize", String(params.pageSize));

  const qs = query.toString();
  const url = qs ? `/notes/?${qs}` : "/notes/";
  const res = await apiGet<any>(url);

  const rawList = res?.data || res?.results || (Array.isArray(res) ? res : []);
  const total = Number(res?.total ?? res?.count ?? rawList.length);
  const page = Number(res?.page ?? 1);
  const pageSize = Number(res?.pageSize ?? 50);
  const totalPages = Number(res?.totalPages ?? (Math.ceil(total / pageSize) || 1));

  return {
    data: rawList,
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function fetchStudentNote(id: number): Promise<StudentNote> {
  return apiGet<StudentNote>(`/notes/${id}/`);
}

export async function createStudentNote(data: StudentNoteCreateInput): Promise<StudentNote> {
  return apiPost<StudentNote>("/notes/", data);
}

export async function updateStudentNote(
  id: number,
  data: StudentNoteUpdateInput
): Promise<StudentNote> {
  return apiPatch<StudentNote>(`/notes/${id}/`, data);
}

export async function deleteStudentNote(id: number): Promise<void> {
  return apiDelete<void>(`/notes/${id}/`);
}

export async function bulkImportStudentNotes(
  notes: StudentNoteCreateInput[]
): Promise<BulkImportNotesResponse> {
  return apiPost<BulkImportNotesResponse>("/notes/bulk-import/", { notes });
}
