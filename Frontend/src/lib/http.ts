import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { ApiError, normalizeError } from "./apiError";
import { tokenStore } from "./tokenStore";
import { logger } from "./logger";
import { toast } from "@/components/ui/use-toast";

export const getApiUrl = (): string => {
  const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");
  if (import.meta.env.PROD) {
    throw new Error("VITE_API_URL must be set in production");
  }
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `http://${window.location.hostname}:8000/api/v1`;
  }
  return "http://127.0.0.1:8000/api/v1";
};

export const API_URL = getApiUrl();
const AUTH_REFRESH_PATH = "/auth/refresh/";
const AUTH_LOGIN_PATH = "/auth/login/";
const AUTH_REGISTER_PATH = "/auth/register/";

declare module "axios" {
  export interface AxiosRequestConfig {
    _retried?: boolean;
    _skipAuth?: boolean;
    _skipGlobalToast?: boolean;
  }
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
  _skipAuth?: boolean;
  _skipGlobalToast?: boolean;
}

export const http: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 25_000,
});

function generateCorrelationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const isAuthEndpoint = (url?: string): boolean => {
  if (!url) return false;
  return url.includes(AUTH_REFRESH_PATH) || url.includes(AUTH_LOGIN_PATH) || url.includes(AUTH_REGISTER_PATH);
};

http.interceptors.request.use((config) => {
  const cfg = config as RetriableConfig;
  cfg.headers = cfg.headers ?? {};
  cfg.headers["x-correlation-id"] = generateCorrelationId();

  if (cfg.url && isAuthEndpoint(cfg.url)) cfg.timeout = 30_000;

  // Axios must generate the multipart boundary itself. Never force JSON for FormData.
  if (typeof FormData !== "undefined" && cfg.data instanceof FormData) {
    delete cfg.headers["Content-Type"];
  }

  // Public auth endpoints must never inherit a stale JWT from localStorage.
  // Otherwise DRF authentication can reject the request before validating the
  // fresh login credentials.
  if (cfg._skipAuth || isAuthEndpoint(cfg.url)) {
    delete cfg.headers.Authorization;
    return cfg;
  }
  const access = tokenStore.getAccess();
  if (access) cfg.headers.Authorization = `Bearer ${access}`;
  return cfg;
});

let refreshPromise: Promise<string | null> | null = null;
let lastRefreshErrorStatus: number | null = null;

const authChannel = tokenStore.getChannel();
if (authChannel) {
  authChannel.addEventListener("message", (msg) => {
    if (msg.data?.type !== "REFRESH_START" || refreshPromise) return;
    refreshPromise = new Promise((resolve) => {
      const handler = (event: MessageEvent) => {
        if (event.data?.type !== "REFRESH_END") return;
        authChannel.removeEventListener("message", handler);
        resolve(event.data.success ? (event.data.access ?? tokenStore.getAccess()) : null);
      };
      authChannel.addEventListener("message", handler);
    });
  });
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStore.getRefresh();
  if (!refresh) return null;

  tokenStore.broadcastRefreshStart();
  lastRefreshErrorStatus = null;

  try {
    const res = await axios.post<{ access: string; refresh?: string }>(
      `${API_URL}${AUTH_REFRESH_PATH}`,
      { refresh },
      { headers: { "Content-Type": "application/json", Accept: "application/json" }, timeout: 30_000 },
    );
    const newAccess = res.data.access;
    const newRefresh = res.data.refresh;
    if (!newAccess) throw new Error("Refresh endpoint returned no access token");

    if (newRefresh) tokenStore.setTokens(newAccess, newRefresh);
    else tokenStore.setAccess(newAccess);
    tokenStore.broadcastRefreshEnd(true, newAccess, newRefresh);
    return newAccess;
  } catch (e: unknown) {
    const axiosErr = e as AxiosError;
    lastRefreshErrorStatus = axiosErr.response?.status ?? 0;
    logger.warn("Token refresh failed", e);
    tokenStore.broadcastRefreshEnd(false);
    return null;
  }
}

let lastToastMessage = "";
let lastToastTimestamp = 0;
const TOAST_DEBOUNCE_MS = 2000;

function showDeduplicatedToast(message: string, title = "خطأ") {
  const now = Date.now();
  if (lastToastMessage === message && now - lastToastTimestamp < TOAST_DEBOUNCE_MS) {
    return;
  }
  lastToastMessage = message;
  lastToastTimestamp = now;
  toast({ title, description: message, variant: "destructive" });
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    if (import.meta.env.DEV && error) {
      console.warn(
        `[http] ${original?.method?.toUpperCase() ?? "REQUEST"} ${original?.url} failed (${status ?? "Network Error"}):`,
        error.response?.data || error.message,
      );
    }

    if (
      status === 401 &&
      original &&
      !original._retried &&
      !isAuthEndpoint(original.url) &&
      tokenStore.getRefresh()
    ) {
      original._retried = true;
      if (!refreshPromise) refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });

      const newAccess = await refreshPromise;
      if (newAccess) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newAccess}`;
        return http.request(original);
      }

      // Token refresh failed - cleanly clear tokens to prevent repeated failed requests/loops
      tokenStore.clear();
      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        window.location.assign("/?authExpired=1");
      }
    }

    const normalizedError = normalizeError(error);
    const isAuthOrClientError =
      normalizedError.status === 400 ||
      normalizedError.status === 401 ||
      normalizedError.status === 403;
    const skipToast =
      Boolean(original?._skipGlobalToast) ||
      Boolean((error.config as any)?._skipGlobalToast) ||
      isAuthOrClientError;

    if (!skipToast && normalizedError.code !== "network_cancelled") {
      showDeduplicatedToast(normalizedError.message);
    }
    return Promise.reject(normalizedError);
  },
);

export async function apiGet<T>(url: string, params?: Record<string, unknown>, config?: AxiosRequestConfig): Promise<T> {
  const res: AxiosResponse<T> = await http.get<T>(url, { params, ...config });
  return res.data;
}

export async function apiPost<T, B = unknown>(url: string, body?: B, config?: AxiosRequestConfig): Promise<T> {
  const res: AxiosResponse<T> = await http.post<T>(url, body, config);
  return res.data;
}

export async function apiPatch<T, B = unknown>(url: string, body?: B, config?: AxiosRequestConfig): Promise<T> {
  const res: AxiosResponse<T> = await http.patch<T>(url, body, config);
  return res.data;
}

export async function apiPut<T, B = unknown>(url: string, body?: B, config?: AxiosRequestConfig): Promise<T> {
  const res: AxiosResponse<T> = await http.put<T>(url, body, config);
  return res.data;
}

export async function apiDelete<T = void>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res: AxiosResponse<T> = await http.delete<T>(url, config);
  return res.data;
}

export function unauthedRequest<T>(config: AxiosRequestConfig): Promise<T> {
  return http.request<T>({ ...config, _skipAuth: true } as RetriableConfig).then((r) => r.data);
}

export type { ApiError };
export default http;
