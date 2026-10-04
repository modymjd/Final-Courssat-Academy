import { superAdminTokenStore } from "./superAdminTokenStore";

const getSuperAdminApiUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (envUrl && envUrl.trim() !== "") {
    return envUrl.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `http://${window.location.hostname}:8000/api/v1`;
  }
  return "http://127.0.0.1:8000/api/v1";
};

const API_BASE_URL = getSuperAdminApiUrl();


export class SuperAdminApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = "SuperAdminApiError";
    this.status = status;
    this.data = data;
  }
}

// Single-Flight Mutex for Super Admin Token Refresh
let refreshPromise: Promise<string | null> | null = null;

async function refreshSuperAdminToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = superAdminTokenStore.getRefresh();
    if (!refreshToken) {
      superAdminTokenStore.clear();
      return null;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (!res.ok) {
        superAdminTokenStore.clear();
        return null;
      }

      const data = await res.json();
      if (data.access) {
        superAdminTokenStore.setAccess(data.access);
        if (data.refresh) {
          superAdminTokenStore.setTokens(data.access, data.refresh);
        }
        return data.access;
      }
      superAdminTokenStore.clear();
      return null;
    } catch {
      superAdminTokenStore.clear();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function superAdminFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const token = superAdminTokenStore.getAccess();

  const headers: Record<string, string> = {
    "x-correlation-id": typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Handle FormData vs JSON
  if (options.body instanceof FormData) {
    // When sending FormData, never set Content-Type header manually so the browser
    // can automatically generate the correct multipart/form-data boundary.
    delete headers["Content-Type"];
    delete headers["content-type"];
  } else if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  let res = await fetch(url, { ...options, headers });

  // Handle 401 and Token Refresh
  if (res.status === 401 && !path.includes("/auth/login") && !path.includes("/auth/refresh")) {
    const newAccess = await refreshSuperAdminToken();
    if (newAccess) {
      headers["Authorization"] = `Bearer ${newAccess}`;
      res = await fetch(url, { ...options, headers });
    }
  }

  if (!res.ok) {
    let errorData: any;
    try {
      errorData = await res.json();
    } catch {
      errorData = { detail: res.statusText };
    }
    let msg = errorData?.detail || errorData?.message;
    if (!msg && errorData && typeof errorData === "object") {
      const firstKey = Object.keys(errorData)[0];
      if (firstKey) {
        const val = errorData[firstKey];
        msg = `${firstKey}: ${Array.isArray(val) ? val.join(", ") : String(val)}`;
      }
    }
    if (!msg) {
      msg = `Request failed with status ${res.status}`;
    }
    throw new SuperAdminApiError(res.status, msg, errorData);
  }

  if (res.status === 240) return {} as T;
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return res.json();
  }
  return res.text() as unknown as T;
}

export const superAdminGet = <T = any>(path: string, options: RequestInit = {}) =>
  superAdminFetch<T>(path, { ...options, method: "GET" });

export const superAdminPost = <T = any>(path: string, body?: any, options: RequestInit = {}) =>
  superAdminFetch<T>(path, {
    ...options,
    method: "POST",
    body: body instanceof FormData ? body : JSON.stringify(body),
  });

export const superAdminPatch = <T = any>(path: string, body?: any, options: RequestInit = {}) =>
  superAdminFetch<T>(path, {
    ...options,
    method: "PATCH",
    body: body instanceof FormData ? body : JSON.stringify(body),
  });

export const superAdminDelete = <T = any>(path: string, options: RequestInit = {}) =>
  superAdminFetch<T>(path, { ...options, method: "DELETE" });
