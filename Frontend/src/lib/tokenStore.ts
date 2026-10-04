/**
 * JWT token storage.
 *
 * Security note: localStorage is used for pragmatic reasons (SPA + Django JWT with short
 * access tokens + refresh rotation). Access tokens are short-lived; if XSS lands, the
 * attacker gets a short window. For higher security, migrate to httpOnly cookies —
 * only this file changes.
 */

const ACCESS_KEY = "mk_access";
const REFRESH_KEY = "mk_refresh";

export type TokenStoreEvent = { type: "tokens_set" | "tokens_cleared" | "tab_sync" };
type Listener = (event?: TokenStoreEvent) => void;
const listeners = new Set<Listener>();

const CHANNEL_NAME = "mkanak_auth_channel";
const authChannel =
  typeof window !== "undefined" && "BroadcastChannel" in window
    ? new BroadcastChannel(CHANNEL_NAME)
    : null;

export const tokenStore = {
  getAccess(): string | null {
    try {
      return localStorage.getItem(ACCESS_KEY);
    } catch {
      return null;
    }
  },

  getRefresh(): string | null {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },

  setTokens(access: string, refresh: string, broadcast = true): void {
    try {
      localStorage.setItem(ACCESS_KEY, access);
      localStorage.setItem(REFRESH_KEY, refresh);
      if (broadcast && authChannel) {
        authChannel.postMessage({ type: "SYNC_TOKENS", access, refresh });
      }
      notify({ type: "tokens_set" });
    } catch {
      /* storage disabled — silently degrade */
    }
  },

  setAccess(access: string, broadcast = true): void {
    try {
      localStorage.setItem(ACCESS_KEY, access);
      if (broadcast && authChannel) {
        authChannel.postMessage({ type: "SYNC_ACCESS", access });
      }
      notify({ type: "tokens_set" });
    } catch {
      /* noop */
    }
  },

  clear(broadcast = true): void {
    try {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
      if (broadcast && authChannel) {
        authChannel.postMessage({ type: "CLEAR_TOKENS" });
      }
      notify({ type: "tokens_cleared" });
    } catch {
      /* noop */
    }
  },

  broadcastRefreshStart(): void {
    if (authChannel) {
      authChannel.postMessage({ type: "REFRESH_START" });
    }
  },

  broadcastRefreshEnd(success: boolean, access?: string, refresh?: string): void {
    if (authChannel) {
      authChannel.postMessage({ type: "REFRESH_END", success, access, refresh });
    }
  },

  getChannel(): BroadcastChannel | null {
    return authChannel;
  },

  /**
   * Subscribe to token changes — including changes from other tabs (via `storage` or BroadcastChannel).
   * Returns an unsubscribe function.
   */
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

function notify(event?: TokenStoreEvent) {
  for (const l of listeners) l(event);
}

// Cross-tab sync: when another tab logs in/out, fire local listeners.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === ACCESS_KEY || e.key === REFRESH_KEY) notify({ type: "tab_sync" });
  });

  if (authChannel) {
    authChannel.onmessage = (msg) => {
      if (msg.data?.type === "SYNC_TOKENS") {
        try {
          localStorage.setItem(ACCESS_KEY, msg.data.access);
          localStorage.setItem(REFRESH_KEY, msg.data.refresh);
          notify({ type: "tab_sync" });
        } catch {
          /* noop */
        }
      } else if (msg.data?.type === "SYNC_ACCESS") {
        try {
          localStorage.setItem(ACCESS_KEY, msg.data.access);
          notify({ type: "tab_sync" });
        } catch {
          /* noop */
        }
      } else if (msg.data?.type === "CLEAR_TOKENS") {
        try {
          localStorage.removeItem(ACCESS_KEY);
          localStorage.removeItem(REFRESH_KEY);
          notify({ type: "tokens_cleared" });
        } catch {
          /* noop */
        }
      }
    };
  }
}
