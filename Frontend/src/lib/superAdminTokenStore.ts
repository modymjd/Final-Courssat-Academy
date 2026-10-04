/**
 * Super Admin Dedicated JWT Token Store.
 * Fully isolated from regular student/instructor platform token storage.
 */

const SUPER_ADMIN_ACCESS_KEY = "mk_super_admin_access";
const SUPER_ADMIN_REFRESH_KEY = "mk_super_admin_refresh";

export type SuperAdminTokenEvent = { type: "tokens_set" | "tokens_cleared" };
type Listener = (event?: SuperAdminTokenEvent) => void;
const listeners = new Set<Listener>();

export const superAdminTokenStore = {
  getAccess(): string | null {
    try {
      return localStorage.getItem(SUPER_ADMIN_ACCESS_KEY);
    } catch {
      return null;
    }
  },

  getRefresh(): string | null {
    try {
      return localStorage.getItem(SUPER_ADMIN_REFRESH_KEY);
    } catch {
      return null;
    }
  },

  setTokens(access: string, refresh: string): void {
    try {
      localStorage.setItem(SUPER_ADMIN_ACCESS_KEY, access);
      localStorage.setItem(SUPER_ADMIN_REFRESH_KEY, refresh);
      notify({ type: "tokens_set" });
    } catch {
      /* storage disabled */
    }
  },

  setAccess(access: string): void {
    try {
      localStorage.setItem(SUPER_ADMIN_ACCESS_KEY, access);
      notify({ type: "tokens_set" });
    } catch {
      /* storage disabled */
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(SUPER_ADMIN_ACCESS_KEY);
      localStorage.removeItem(SUPER_ADMIN_REFRESH_KEY);
      notify({ type: "tokens_cleared" });
    } catch {
      /* storage disabled */
    }
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

function notify(event?: SuperAdminTokenEvent) {
  for (const l of listeners) l(event);
}
