/**
 * Public, client-side runtime configuration.
 *
 * OAuth client IDs are identifiers, not secrets. Vite exposes VITE_* values
 * at build time; when the production build is missing the variable we keep
 * the already-configured public Google Web Client ID as a compatibility
 * fallback so authentication does not silently disappear from the UI.
 */
export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ||
  "440041713770-tvs55jh8h5batgsf1iha96b85en7tek3.apps.googleusercontent.com";
