import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/http";

export interface PlatformThemeSettings {
  id: number;
  site_name: string;
  siteName?: string;
  site_tagline: string;
  siteTagline?: string;
  logoUrl?: string;
  logo_url?: string;
  faviconUrl?: string;
  favicon_url?: string;
  primary_color: string;
  primaryColor?: string;
  secondary_color: string;
  secondaryColor?: string;
  accent_color: string;
  accentColor?: string;
  dark_mode_enabled: boolean;
  darkModeEnabled?: boolean;
  hero_title: string;
  heroTitle?: string;
  hero_subtitle: string;
  heroSubtitle?: string;
  heroBannerUrl?: string;
  hero_banner_url?: string;
  promoVideoUrl?: string;
  promo_video_url?: string;
  support_email: string;
  supportEmail?: string;
  support_phone: string;
  supportPhone?: string;
  terms_url: string;
  termsUrl?: string;
  privacy_url: string;
  privacyUrl?: string;
  faq_url: string;
  faqUrl?: string;
  facebook_url: string;
  facebookUrl?: string;
  twitter_url: string;
  twitterUrl?: string;
  linkedin_url: string;
  linkedinUrl?: string;
  youtube_url: string;
  youtubeUrl?: string;
  instagram_url: string;
  instagramUrl?: string;
  cdn_cache_version: number;
  cdnCacheVersion?: number;
}

export function normalizeThemeData(raw: any): PlatformThemeSettings {
  if (!raw) return raw;
  const site_name = raw.site_name || raw.siteName || "";
  const site_tagline = raw.site_tagline || raw.siteTagline || "";
  const primary_color = raw.primary_color || raw.primaryColor || "#4f46e5";
  const secondary_color = raw.secondary_color || raw.secondaryColor || "#06b6d4";
  const accent_color = raw.accent_color || raw.accentColor || "#f59e0b";
  const dark_mode_enabled = raw.dark_mode_enabled ?? raw.darkModeEnabled ?? true;
  const hero_title = raw.hero_title || raw.heroTitle || "";
  const hero_subtitle = raw.hero_subtitle || raw.heroSubtitle || "";
  const support_email = raw.support_email || raw.supportEmail || "";
  const support_phone = raw.support_phone || raw.supportPhone || "";
  const terms_url = raw.terms_url || raw.termsUrl || "";
  const privacy_url = raw.privacy_url || raw.privacyUrl || "";
  const faq_url = raw.faq_url || raw.faqUrl || "";
  const facebook_url = raw.facebook_url || raw.facebookUrl || "";
  const twitter_url = raw.twitter_url || raw.twitterUrl || "";
  const linkedin_url = raw.linkedin_url || raw.linkedinUrl || "";
  const youtube_url = raw.youtube_url || raw.youtubeUrl || "";
  const instagram_url = raw.instagram_url || raw.instagramUrl || "";
  const cdn_cache_version = raw.cdn_cache_version ?? raw.cdnCacheVersion ?? 1;

  return {
    ...raw,
    id: raw.id,
    site_name,
    siteName: site_name,
    site_tagline,
    siteTagline: site_tagline,
    logoUrl: raw.logoUrl || raw.logo_url || "",
    faviconUrl: raw.faviconUrl || raw.favicon_url || raw.logoUrl || raw.logo_url || "/logo-icon.png",
    primary_color,
    primaryColor: primary_color,
    secondary_color,
    secondaryColor: secondary_color,
    accent_color,
    accentColor: accent_color,
    dark_mode_enabled,
    darkModeEnabled: dark_mode_enabled,
    hero_title,
    heroTitle: hero_title,
    hero_subtitle,
    heroSubtitle: hero_subtitle,
    heroBannerUrl: raw.heroBannerUrl || raw.hero_banner_url || "",
    promoVideoUrl: raw.promoVideoUrl || raw.promo_video_url || "",
    support_email,
    supportEmail: support_email,
    support_phone,
    supportPhone: support_phone,
    terms_url,
    termsUrl: terms_url,
    privacy_url,
    privacyUrl: privacy_url,
    faq_url,
    faqUrl: faq_url,
    facebook_url,
    facebookUrl: facebook_url,
    twitter_url,
    twitterUrl: twitter_url,
    linkedin_url,
    linkedinUrl: linkedin_url,
    youtube_url,
    youtubeUrl: youtube_url,
    instagram_url,
    instagramUrl: instagram_url,
    cdn_cache_version,
    cdnCacheVersion: cdn_cache_version,
  };
}

const THEME_CACHE_KEY = "es_theme_cache";

/** Validate HEX color format */
function isValidHex(hex: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
}

/** Convert HEX color to Tailwind-compatible HSL string: "239 84% 67%" */
function hexToHslString(hex: string): string | null {
  if (!isValidHex(hex)) return null;

  let c = hex.substring(1);
  if (c.length === 3) {
    c = c.split("").map((x) => x + x).join("");
  }

  const num = parseInt(c, 16);
  const r = (num >> 16) / 255;
  const g = ((num >> 8) & 0x00ff) / 255;
  const b = (num & 0x0000ff) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  const hDeg = Math.round(h * 360);
  const sPct = Math.round(s * 100);
  const lPct = Math.round(l * 100);

  return `${hDeg} ${sPct}% ${lPct}%`;
}

/** Calculate WCAG AA contrast text color ("0 0% 100%" white vs "0 0% 10%" dark) based on luminance */
function getContrastForeground(hex: string): string {
  if (!isValidHex(hex)) return "0 0% 100%";

  let c = hex.substring(1);
  if (c.length === 3) {
    c = c.split("").map((x) => x + x).join("");
  }
  const num = parseInt(c, 16);
  const r = (num >> 16) / 255;
  const g = ((num >> 8) & 0x00ff) / 255;
  const b = (num & 0x0000ff) / 255;

  // Relative luminance formula
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.45 ? "0 0% 10%" : "0 0% 100%";
}

/** Apply theme tokens directly to documentElement style */
function applyThemeToDocument(data: Partial<PlatformThemeSettings>) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark = root.classList.contains("dark");

  const primaryColor = data.primary_color || data.primaryColor;
  const secondaryColor = data.secondary_color || data.secondaryColor;
  const accentColor = data.accent_color || data.accentColor;
  const faviconUrl = data.faviconUrl || data.favicon_url;

  if (!isDark) {
    if (primaryColor && isValidHex(primaryColor)) {
      const hsl = hexToHslString(primaryColor);
      if (hsl) {
        root.style.setProperty("--primary", hsl);
        root.style.setProperty("--ring", hsl);
        root.style.setProperty("--primary-foreground", getContrastForeground(primaryColor));
      }
    }
    if (secondaryColor && isValidHex(secondaryColor)) {
      const hsl = hexToHslString(secondaryColor);
      if (hsl) {
        root.style.setProperty("--secondary", hsl);
        root.style.setProperty("--secondary-foreground", getContrastForeground(secondaryColor));
      }
    }
    if (accentColor && isValidHex(accentColor)) {
      const hsl = hexToHslString(accentColor);
      if (hsl) {
        root.style.setProperty("--accent", hsl);
        root.style.setProperty("--accent-foreground", getContrastForeground(accentColor));
      }
    }
  } else {
    // In dark mode, clean inline overrides so stylesheet .dark theme tokens take precedence!
    root.style.removeProperty("--primary");
    root.style.removeProperty("--ring");
    root.style.removeProperty("--primary-foreground");
    root.style.removeProperty("--secondary");
    root.style.removeProperty("--secondary-foreground");
    root.style.removeProperty("--accent");
    root.style.removeProperty("--accent-foreground");
  }

  if (faviconUrl) {
    const link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
    if (link) {
      link.href = faviconUrl;
    }
  }
}

// Immediate FOUC Prevention: Apply cached theme instantly on initial script evaluation
if (typeof localStorage !== "undefined") {
  try {
    const cached = localStorage.getItem(THEME_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      applyThemeToDocument(normalizeThemeData(parsed));
    }
  } catch {
    /* noop */
  }
}

export function usePlatformTheme() {
  const query = useQuery<PlatformThemeSettings>({
    queryKey: ["public-platform-theme"],
    queryFn: async () => {
      const rawData = await apiGet<any>("/common/settings/");
      const data = normalizeThemeData(rawData);
      if (typeof localStorage !== "undefined") {
        try {
          localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(data));
        } catch {
          /* noop */
        }
      }
      return data;
    },
    staleTime: 1000 * 60 * 15,
  });

  useEffect(() => {
    if (query.data) {
      applyThemeToDocument(query.data);
    }

    const handleThemeChange = () => {
      if (query.data) {
        applyThemeToDocument(query.data);
      }
    };

    window.addEventListener("edusmart:theme-change", handleThemeChange);
    return () => window.removeEventListener("edusmart:theme-change", handleThemeChange);
  }, [query.data]);

  return query;
}
