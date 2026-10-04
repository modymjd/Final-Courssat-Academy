import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/http";

export interface TeamMemberDto {
  id?: number | string;
  name: string;
  role: string;
  quote?: string;
  photoUrl?: string | null;
  photo?: string | null;
  order?: number;
}

export interface PartnershipDto {
  id?: number | string;
  partnerName?: string;
  partner_name?: string;
  date: string;
  description: string;
  photoUrl?: string | null;
  photo?: string | null;
  badgeText?: string;
  order?: number;
}

export interface AboutPageContentData {
  id?: number;
  founderName?: string;
  founder_name?: string;
  founderTitle?: string;
  founder_title?: string;
  founderPhotoUrl?: string | null;
  founder_photo_url?: string | null;
  founderQuote?: string;
  founder_quote?: string;
  companyName?: string;
  company_name?: string;
  companyTagline?: string;
  company_tagline?: string;
  companyDescription?: string;
  company_description?: string;
  companyLogoUrl?: string | null;
  company_logo_url?: string | null;
  platformName?: string;
  platform_name?: string;
  platformTagline?: string;
  platform_tagline?: string;
  platformDescription?: string;
  platform_description?: string;
  contactEmail?: string;
  contact_email?: string;
  contactPhone?: string;
  contact_phone?: string;
  facebookUrl?: string;
  facebook_url?: string;
  instagramUrl?: string;
  instagram_url?: string;
  linkedinUrl?: string;
  linkedin_url?: string;
  youtubeUrl?: string;
  youtube_url?: string;
  twitterUrl?: string;
  twitter_url?: string;
  teamMembers?: TeamMemberDto[];
  team_members?: TeamMemberDto[];
  partnerships?: PartnershipDto[];
  updatedAt?: string;
  updated_at?: string;
}

/**
 * Determine if about page content has any configured fields.
 * Content is considered empty if no founder, company, platform name,
 * team members, or partnerships are configured.
 */
function checkIsAboutContentEmpty(data?: AboutPageContentData | null): boolean {
  if (!data) return true;
  const hasFounder = Boolean(data.founder_name?.trim() || data.founderName?.trim());
  const hasCompany = Boolean(data.company_name?.trim() || data.companyName?.trim());
  const hasPlatform = Boolean(data.platform_name?.trim() || data.platformName?.trim());
  const members = data.team_members || data.teamMembers || [];
  const parts = data.partnerships || [];
  return !hasFounder && !hasCompany && !hasPlatform && members.length === 0 && parts.length === 0;
}

export function usePlatformAboutContent() {
  const query = useQuery<AboutPageContentData>({
    queryKey: ["public-platform-about"],
    queryFn: () => apiGet<AboutPageContentData>("/platform/about/"),
    staleTime: 1000 * 60 * 10,
  });

  const rawData = query.data ?? null;
  const teamMembers = rawData?.team_members || rawData?.teamMembers || [];
  const partnerships = rawData?.partnerships || [];
  const isEmpty = query.isSuccess && checkIsAboutContentEmpty(rawData);

  return {
    ...query,
    data: rawData,
    isEmpty,
    teamMembers,
    partnerships,
  };
}
