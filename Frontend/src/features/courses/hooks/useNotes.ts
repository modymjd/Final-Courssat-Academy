import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchStudentNotes,
  fetchStudentNote,
  createStudentNote,
  updateStudentNote,
  deleteStudentNote,
  bulkImportStudentNotes,
  type GetNotesParams,
} from "../notesApi";
import type {
  StudentNoteCreateInput,
  StudentNoteUpdateInput,
} from "@/types/note";

export const studentNotesKeys = {
  all: ["student-notes"] as const,
  lists: () => [...studentNotesKeys.all, "list"] as const,
  list: (params?: GetNotesParams) => [...studentNotesKeys.lists(), params] as const,
  details: () => [...studentNotesKeys.all, "detail"] as const,
  detail: (id: number) => [...studentNotesKeys.details(), id] as const,
};

export function useStudentNotes(params?: GetNotesParams) {
  return useQuery({
    queryKey: studentNotesKeys.list(params),
    queryFn: () => fetchStudentNotes(params),
  });
}

export function useStudentNote(id: number) {
  return useQuery({
    queryKey: studentNotesKeys.detail(id),
    queryFn: () => fetchStudentNote(id),
    enabled: !!id,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: StudentNoteCreateInput) => createStudentNote(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentNotesKeys.all });
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: StudentNoteUpdateInput }) =>
      updateStudentNote(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: studentNotesKeys.all });
      queryClient.invalidateQueries({ queryKey: studentNotesKeys.detail(variables.id) });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteStudentNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentNotesKeys.all });
    },
  });
}

export function useBulkImportNotes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notes: StudentNoteCreateInput[]) => bulkImportStudentNotes(notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentNotesKeys.all });
    },
  });
}
