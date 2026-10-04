/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_ENV?: "development" | "staging" | "production";
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_FEATURE_MESSAGES?: string;
  readonly VITE_FEATURE_LIVE_SESSIONS?: string;
  readonly VITE_FEATURE_ANALYTICS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
