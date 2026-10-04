import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getInstructorCourses, getInstructorGrades, 
  createCourse, updateCourse, deleteInstructorCourse,
  updateGrade 
} from "./api";

export function useInstructorCourses() {
  return useQuery({
    queryKey: ['instructor', 'courses'],
    queryFn: getInstructorCourses,
  });
}

export function useInstructorGrades() {
  return useQuery({
    queryKey: ['instructor', 'grades'],
    queryFn: getInstructorGrades,
  });
}

export function useCreateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCourse,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['instructor', 'courses'] }),
  });
}

export function useUpdateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => updateCourse(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['instructor', 'courses'] }),
  });
}

export function useDeleteInstructorCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteInstructorCourse,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['instructor', 'courses'] }),
  });
}

export function useUpdateGrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => updateGrade(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['instructor', 'grades'] }),
  });
}
