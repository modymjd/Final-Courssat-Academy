import type { AxiosError } from "axios";

/**
 * Normalized application error.
 * Every error surfaced to the UI passes through this type — one shape for toasts,
 * error boundaries, and form field mapping.
 *
 * Error codes follow a structured taxonomy:
 * - "network_offline"       → navigator.onLine is false
 * - "network_connection"    → ERR_CONNECTION_REFUSED / backend unreachable
 * - "network_cors"          → CORS policy blocked the request
 * - "network_timeout"       → request exceeded timeout
 * - "network_unknown"       → catch-all for unclassified network failures
 * - "server_error"          → 5xx
 * - "auth_error"            → 401/403
 * - "validation_error"      → 400/422 with field errors
 * - "conflict_error"        → 409
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly fields?: Record<string, string[]>;
  public readonly cause?: unknown;

  constructor(params: {
    message: string;
    status: number;
    code?: string;
    fields?: Record<string, string[]>;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = "ApiError";
    this.status = params.status;
    this.code = params.code;
    this.fields = params.fields;
    this.cause = params.cause;
  }

  /** True network offline (navigator.onLine === false). */
  get isOffline() {
    return this.code === "network_offline";
  }

  /** Any network-level failure (offline, CORS, connection refused, timeout). */
  get isNetwork() {
    return this.status === 0;
  }

  /** CORS policy blocked the request. */
  get isCors() {
    return this.code === "network_cors";
  }

  /** Backend unreachable (ERR_CONNECTION_REFUSED). */
  get isConnectionRefused() {
    return this.code === "network_connection";
  }

  /** Request timed out. */
  get isTimeout() {
    return this.code === "network_timeout";
  }

  get isAuth() {
    return this.status === 401 || this.status === 403;
  }

  get isValidation() {
    return this.status === 400 && !!this.fields;
  }

  get isServer() {
    return this.status >= 500;
  }
}

// ---- User-facing messages (Arabic) ----
const MSG_OFFLINE = "أنت حالياً غير متصل بالإنترنت. تحقق من اتصالك بالإنترنت.";
const MSG_CONNECTION_REFUSED = "تعذّر الاتصال بالخادم. تأكد من أن الخادم يعمل.";
const MSG_CORS = "تم حظر الطلب بسبب سياسة الأمان (CORS). تواصل مع فريق الدعم.";
const MSG_TIMEOUT = "انتهت مهلة الطلب. حاول مرة أخرى.";
const MSG_NETWORK_UNKNOWN = "تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.";
const MSG_SERVER = "حدث خطأ في الخادم. حاول مرة أخرى بعد قليل.";
const MSG_GENERIC = "حدث خطأ غير متوقع.";

/**
 * Classify a no-response AxiosError into a specific network error subtype.
 *
 * Axios error codes we care about:
 * - ERR_NETWORK          → generic network failure (could be CORS, refused, etc.)
 * - ECONNABORTED         → timeout or aborted
 * - ERR_CANCELED         → request was cancelled (AbortController)
 *
 * Additional heuristics:
 * - navigator.onLine === false → truly offline
 * - error.message containing "Network Error" with online status → likely CORS or refused
 */
function classifyNetworkError(axiosErr: AxiosError): ApiError {
  const isOnline =
    typeof navigator !== "undefined" ? navigator.onLine : true;
  const axiosCode = axiosErr.code; // e.g. "ERR_NETWORK", "ECONNABORTED"
  const msg = axiosErr.message || "";

  // 1. Device is truly offline
  if (!isOnline) {
    return new ApiError({
      message: MSG_OFFLINE,
      status: 0,
      code: "network_offline",
      cause: axiosErr,
    });
  }

  // 2. Timeout
  if (axiosCode === "ECONNABORTED" || msg.toLowerCase().includes("timeout")) {
    return new ApiError({
      message: MSG_TIMEOUT,
      status: 0,
      code: "network_timeout",
      cause: axiosErr,
    });
  }

  // 3. Request explicitly cancelled (e.g. AbortController, component unmount)
  if (axiosCode === "ERR_CANCELED") {
    return new ApiError({
      message: MSG_GENERIC,
      status: 0,
      code: "network_cancelled",
      cause: axiosErr,
    });
  }

  // 4. ERR_NETWORK while online → either CORS block or connection refused.
  //    Unfortunately, browsers intentionally hide the distinction for security.
  //    Heuristic: if the error message is exactly "Network Error" with no
  //    additional info, it's almost always CORS or connection refused.
  if (axiosCode === "ERR_NETWORK") {
    // We can't reliably distinguish CORS from connection refused in the browser.
    // Show a generic "server unreachable" message instead of "you're offline".
    return new ApiError({
      message: MSG_CONNECTION_REFUSED,
      status: 0,
      code: "network_connection",
      cause: axiosErr,
    });
  }

  // 5. Fallback for any other no-response error
  return new ApiError({
    message: MSG_NETWORK_UNKNOWN,
    status: 0,
    code: "network_unknown",
    cause: axiosErr,
  });
}

/**
 * Convert any thrown value (usually AxiosError) into a normalized ApiError.
 * Handles the three DRF response shapes:
 *   - { detail: "message" }
 *   - { field: ["msg1", "msg2"], other: [...] }
 *   - network / no response
 */
export function normalizeError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;

  const axiosErr = err as AxiosError<Record<string, unknown>>;

  // Network / no response → classify into specific subtype.
  if (!axiosErr?.response) {
    return classifyNetworkError(axiosErr);
  }

  const { status, data } = axiosErr.response;

  if (status >= 500) {
    return new ApiError({
      message: MSG_SERVER,
      status,
      code: "server_error",
      cause: err,
    });
  }

  // Unwrap Backend custom envelope if present: { error: { status, detail, errors } }
  const rawEnvelope = (data && typeof data === "object" && "error" in data && typeof (data as { error?: unknown }).error === "object")
    ? (data as { error: Record<string, unknown> }).error
    : data;

  // 1. Check for 429 Throttle / Rate Limit
  if (status === 429) {
    const detailMsg = typeof rawEnvelope?.detail === "string" ? rawEnvelope.detail : "";
    const secondsMatch = detailMsg.match(/(\d+)\s*second/i);
    const seconds = secondsMatch ? secondsMatch[1] : null;
    const throttleMsg = seconds
      ? `لقد تجاوزت الحد المسموح من المحاولات. يرجى الانتظار ${seconds} ثانية قبل المحاولة مجدداً.`
      : "لقد تجاوزت الحد المسموح من المحاولات. يرجى الانتظار دقيقة واحدة ثم المحاولة مجدداً.";

    return new ApiError({
      message: throttleMsg,
      status: 429,
      code: "rate_limited",
      cause: err,
    });
  }

function localizeBackendMessage(msg: string): string {
  const trimmed = msg.trim();
  if (/user with this email already exists/i.test(trimmed)) {
    return "البريد الإلكتروني مسجّل بالفعل لمستخدم آخر. يرجى تسجيل الدخول أو استخدام بريد آخر.";
  }
  if (/user with this phone already exists/i.test(trimmed)) {
    return "رقم الهاتف مسجّل بالفعل لمستخدم آخر.";
  }
  if (/user with this national id already exists/i.test(trimmed)) {
    return "الرقم القومي مسجّل بالفعل لمستخدم آخر.";
  }
  if (/this field is required/i.test(trimmed)) {
    return "هذا الحقل مطلوب.";
  }
  if (/this field may not be blank/i.test(trimmed)) {
    return "لا يمكن ترك هذا الحقل فارغاً.";
  }
  if (/enter a valid email address/i.test(trimmed)) {
    return "يرجى إدخال بريد إلكتروني صحيح.";
  }
  return trimmed;
}

  // 2. Extract field-level errors first if present
  const targetForFields = (rawEnvelope?.errors && typeof rawEnvelope.errors === "object")
    ? rawEnvelope.errors as Record<string, unknown>
    : (rawEnvelope && typeof rawEnvelope === "object" && !Array.isArray(rawEnvelope)
        ? Object.fromEntries(Object.entries(rawEnvelope).filter(([k]) => !["detail", "status", "code", "correlation_id"].includes(k)))
        : null);

  let fieldErrors: Record<string, string[]> | undefined;
  let firstFieldMessage: string | undefined;

  if (targetForFields && typeof targetForFields === "object" && !Array.isArray(targetForFields)) {
    const fields: Record<string, string[]> = {};

    for (const [key, value] of Object.entries(targetForFields)) {
      if (Array.isArray(value)) {
        const messages = value
          .filter((v): v is string => typeof v === "string")
          .map(localizeBackendMessage);
        if (messages.length) {
          fields[key] = messages;
          firstFieldMessage ??= messages[0];
        }
      } else if (typeof value === "string") {
        const localized = localizeBackendMessage(value);
        fields[key] = [localized];
        firstFieldMessage ??= localized;
      }
    }

    if (Object.keys(fields).length > 0) {
      fieldErrors = fields;
    }
  }

  // 3. Detail message resolution
  const rawDetail = (rawEnvelope && typeof rawEnvelope === "object" && typeof rawEnvelope.detail === "string")
    ? localizeBackendMessage(rawEnvelope.detail)
    : undefined;

  // If we have field errors, prioritize them over generic "Request failed"
  if (fieldErrors) {
    const fallbackMsg = (rawDetail && rawDetail !== "Request failed")
      ? rawDetail
      : "يرجى مراجعة البيانات وتصحيح الأخطاء الموضحة.";
    return new ApiError({
      message: firstFieldMessage || fallbackMsg,
      status,
      fields: fieldErrors,
      code: (rawEnvelope?.code as string | undefined) ?? "validation_error",
      cause: err,
    });
  }

  // 4. Standalone detail string (e.g. 401, 403, or specific API message)
  if (rawDetail) {
    return new ApiError({
      message: rawDetail,
      status,
      code: (rawEnvelope?.code as string | undefined) ?? (status === 401 || status === 403 ? "auth_error" : undefined),
      cause: err,
    });
  }

  return new ApiError({
    message: axiosErr.message || MSG_GENERIC,
    status,
    cause: err,
  });
}
