import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { User, LoginCredentials, RegisterData, AuthState } from "@/types/auth";
import { apiGet, apiPost, apiPatch } from "@/lib/http";
import { tokenStore } from "@/lib/tokenStore";
import { queryClient } from "@/lib/queryClient";

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<User>;
  loginWithGoogle: (data: { user: any; access: string; refresh: string }) => Promise<User>;
  register: (data: RegisterData) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User> & Record<string, any>) => Promise<User>;
  setUserData: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeUser(raw: any): User {
  if (!raw) return raw;
  const firstName = raw.firstName || raw.first_name || "";
  const lastName = raw.lastName || raw.last_name || "";
  const fullName = raw.fullName || raw.full_name || `${firstName} ${lastName}`.trim() || raw.email || "";
  const sp = raw.student_profile || raw.studentProfile || {};
  return {
    ...raw,
    firstName,
    lastName,
    fullName,
    authProvider: raw.auth_provider || raw.authProvider || "email",
    profileCompleted: raw.profile_completed ?? raw.profileCompleted ?? true,
    educationLevel: sp.education_level || sp.educationLevel || raw.educationLevel || raw.education_level || "",
    gradeLevel: sp.grade_level || sp.gradeLevel || raw.gradeLevel || raw.grade_level || "",
    educationalTrack: sp.educational_track || sp.educationalTrack || raw.educationalTrack || raw.educational_track || "",
    secondLanguage: sp.second_language || sp.secondLanguage || raw.secondLanguage || raw.second_language || "",
    religion: sp.religion || raw.religion || "",
    schoolName: sp.school_name || sp.schoolName || raw.schoolName || raw.school_name || "",
    universityName: sp.university_name || sp.universityName || raw.universityName || raw.university_name || "",
    facultyName: sp.faculty_name || sp.facultyName || raw.facultyName || raw.faculty_name || "",
    studyStreak: sp.study_streak ?? sp.studyStreak ?? raw.studyStreak ?? 0,
  };
}


export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const fetchMe = useCallback(async () => {
    try {
      const raw = await apiGet<any>('/accounts/me/', undefined, { _skipGlobalToast: true } as any);
      const user = normalizeUser(raw);
      setState(prev => {
        if (prev.user && user && prev.user.id !== user.id) {
          queryClient.clear();
        }
        return { user, isAuthenticated: true, isLoading: false };
      });
    } catch (error: any) {
      const status = error?.status;
      if (status === 401 || status === 403) {
        tokenStore.clear();
        queryClient.clear();
        setState({ user: null, isAuthenticated: false, isLoading: false });
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    }
  }, []);

  useEffect(() => {
    if (tokenStore.getAccess()) {
      fetchMe();
    } else {
      setState({ user: null, isAuthenticated: false, isLoading: false });
      queryClient.clear();
    }

    const unsubscribe = tokenStore.subscribe((evt) => {
      queryClient.clear();
      if (tokenStore.getAccess()) {
        if (evt?.type === "tab_sync" || evt?.type === "tokens_cleared" || evt?.type === "tokens_set") {
          fetchMe();
        }
      } else {
        setState({ user: null, isAuthenticated: false, isLoading: false });
      }
    });

    return unsubscribe;
  }, [fetchMe]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      queryClient.clear();
      const data = await apiPost<{ access: string; refresh: string; user: any }>(
        '/auth/login/',
        credentials,
        { _skipAuth: true, _skipGlobalToast: true } as any,
      );
      tokenStore.setTokens(data.access, data.refresh);
      const user = normalizeUser(data.user);
      setState({ user, isAuthenticated: true, isLoading: false });
      return user;
    } catch (e) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw e;
    }
  }, []);

  const loginWithGoogle = useCallback(async (data: { user: any; access: string; refresh: string }) => {
    queryClient.clear();
    tokenStore.setTokens(data.access, data.refresh);
    const user = normalizeUser(data.user);
    setState({ user, isAuthenticated: true, isLoading: false });
    return user;
  }, []);

  const setUserData = useCallback((user: User) => {
    const normalized = normalizeUser(user);
    setState(prev => {
      if (prev.user && normalized && prev.user.id !== normalized.id) {
        queryClient.clear();
      }
      return { ...prev, user: normalized, isAuthenticated: true };
    });
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      queryClient.clear();
      const res = await apiPost<{ access?: string; refresh?: string; user?: any }>(
        '/auth/register/',
        data,
        { _skipGlobalToast: true } as any,
      );
      if (res?.access && res?.refresh) {
        tokenStore.setTokens(res.access, res.refresh);
        const user = normalizeUser(res.user);
        setState({ user, isAuthenticated: true, isLoading: false });
        return user;
      }
      const user = await login({ email: data.email, password: data.password || "" });
      return user;
    } catch (e) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw e;
    }
  }, [login]);

  const logout = useCallback(async () => {
    try {
      if (tokenStore.getRefresh()) {
        await apiPost('/auth/logout/', { refresh: tokenStore.getRefresh() });
      }
    } catch {
      // Ignore network errors on logout
    } finally {
      tokenStore.clear();
      queryClient.clear();
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

  const updateUser = useCallback(async (updates: Partial<User> & Record<string, any>) => {
    const payload = {
      ...updates,
      first_name: updates.firstName ?? updates.first_name,
      last_name: updates.lastName ?? updates.last_name,
    };
    const updatedRaw = await apiPatch<any>('/accounts/me/', payload);
    const updatedUser = normalizeUser(updatedRaw);
    setState(prev => ({ ...prev, user: updatedUser }));
    return updatedUser;
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, loginWithGoogle, setUserData, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
