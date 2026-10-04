/**
 * Feature flags for the application.
 * Reads from VITE_FEATURE_* environment variables.
 */

export const features = {
  messages: import.meta.env.VITE_FEATURE_MESSAGES === "true",
  liveSessions: import.meta.env.VITE_FEATURE_LIVE_SESSIONS === "true",
  analytics: import.meta.env.VITE_FEATURE_ANALYTICS === "true",
};
