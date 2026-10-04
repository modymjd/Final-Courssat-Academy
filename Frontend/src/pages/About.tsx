import React, { useEffect } from "react";
import Layout from "@/components/layout/Layout";
import FounderHero from "@/components/about/FounderHero";
import CompanySection from "@/components/about/CompanySection";
import EduSmartSection from "@/components/about/EduSmartSection";
import TeamGrid from "@/components/about/TeamGrid";
import PartnershipTimeline from "@/components/about/PartnershipTimeline";
import ContactSocial from "@/components/about/ContactSocial";
import { usePlatformAboutContent } from "@/hooks/usePlatformAboutContent";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, FileQuestion } from "lucide-react";

export const AboutPageSkeleton: React.FC = () => (
  <div className="container mx-auto px-4 py-16 space-y-12 animate-pulse" dir="rtl">
    <div className="flex flex-col items-center space-y-4 max-w-2xl mx-auto text-center">
      <div className="h-6 w-32 bg-muted rounded-full" />
      <div className="h-10 w-64 bg-muted rounded-xl" />
      <div className="h-4 w-96 bg-muted rounded" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="h-48 bg-muted rounded-2xl" />
      <div className="h-48 bg-muted rounded-2xl" />
      <div className="h-48 bg-muted rounded-2xl" />
    </div>
  </div>
);

const About: React.FC = () => {
  const {
    data: aboutData,
    isLoading,
    isError,
    isEmpty,
    teamMembers,
    partnerships,
    refetch,
  } = usePlatformAboutContent();

  const founderName = aboutData?.founder_name || aboutData?.founderName || "";
  const founderTitle = aboutData?.founder_title || aboutData?.founderTitle || "";
  const founderQuote = aboutData?.founder_quote || aboutData?.founderQuote || "";
  const founderPhotoUrl = aboutData?.founder_photo_url || aboutData?.founderPhotoUrl || null;

  const companyName = aboutData?.company_name || aboutData?.companyName || "";
  const companyTagline = aboutData?.company_tagline || aboutData?.companyTagline || "";
  const companyDescription = aboutData?.company_description || aboutData?.companyDescription || "";
  const companyLogoUrl = aboutData?.company_logo_url || aboutData?.companyLogoUrl || null;

  const platformName = aboutData?.platform_name || aboutData?.platformName || "";
  const platformTagline = aboutData?.platform_tagline || aboutData?.platformTagline || "";
  const platformDescription = aboutData?.platform_description || aboutData?.platformDescription || "";

  const contactEmail = aboutData?.contact_email || aboutData?.contactEmail || "";
  const contactPhone = aboutData?.contact_phone || aboutData?.contactPhone || "";
  const facebookUrl = aboutData?.facebook_url || aboutData?.facebookUrl || "";
  const instagramUrl = aboutData?.instagram_url || aboutData?.instagramUrl || "";
  const linkedinUrl = aboutData?.linkedin_url || aboutData?.linkedinUrl || "";
  const youtubeUrl = aboutData?.youtube_url || aboutData?.youtubeUrl || "";
  const twitterUrl = aboutData?.twitter_url || aboutData?.twitterUrl || "";

  useEffect(() => {
    const pageTitle = platformName ? `من نحن | ${platformName}` : "من نحن";
    document.title = pageTitle;

    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.setAttribute("name", "description");
      document.head.appendChild(metaDesc);
    }
    if (platformName || founderName) {
      metaDesc.setAttribute(
        "content",
        `تعرف على منصة ${platformName || "التعليمية"}، وفريق العمل ومسيرة الشراكات والإنجازات.`
      );
    }
  }, [platformName, founderName]);

  return (
    <Layout>
      <div className="w-full space-y-0 min-h-[60vh]" dir="rtl">
        {isLoading && <AboutPageSkeleton />}

        {isError && (
          <div className="container mx-auto px-4 py-24 text-center">
            <div className="max-w-md mx-auto p-8 rounded-3xl bg-card border border-destructive/30 space-y-4 shadow-sm">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
              <h2 className="text-xl font-bold text-foreground">تعذر تحميل معلومات الصفحة</h2>
              <p className="text-sm text-muted-foreground">
                حدث خطأ أثناء جلب بيانات المحتوى من الخادم. يرجى المحاولة مرة أخرى.
              </p>
              <Button
                variant="outline"
                className="gap-2 border-border hover:bg-muted"
                onClick={() => refetch()}
              >
                <RefreshCw className="w-4 h-4" />
                إعادة المحاولة
              </Button>
            </div>
          </div>
        )}

        {!isLoading && !isError && isEmpty && (
          <div className="container mx-auto px-4 py-24 text-center">
            <div className="max-w-md mx-auto p-8 rounded-3xl bg-card border border-border space-y-4 shadow-sm">
              <FileQuestion className="w-12 h-12 text-muted-foreground mx-auto" />
              <h2 className="text-xl font-bold text-foreground">محتوى الصفحة قيد الإعداد</h2>
              <p className="text-sm text-muted-foreground">
                لم يتم نشر بيانات تفصيلية لصفحة "من نحن" حتى الآن من قِبل إدارة المنصة.
              </p>
            </div>
          </div>
        )}

        {!isLoading && !isError && !isEmpty && (
          <>
            {/* Section 1: Hero */}
            <FounderHero
              name={founderName}
              title={founderTitle}
              quote={founderQuote}
              photoUrl={founderPhotoUrl}
            />

            {/* Section 2: Parent Company */}
            <CompanySection
              name={companyName}
              tagline={companyTagline}
              description={companyDescription}
              logoUrl={companyLogoUrl}
            />

            {/* Section 3: Platform Deep Dive */}
            <EduSmartSection
              name={platformName}
              tagline={platformTagline}
              description={platformDescription}
            />

            {/* Section 4: Team Grid */}
            <TeamGrid members={teamMembers} />

            {/* Section 5: Partnership Timeline */}
            <PartnershipTimeline items={partnerships} />

            {/* Section 6: Contact & Social */}
            <ContactSocial
              email={contactEmail}
              phone={contactPhone}
              facebookUrl={facebookUrl}
              instagramUrl={instagramUrl}
              linkedinUrl={linkedinUrl}
              youtubeUrl={youtubeUrl}
              twitterUrl={twitterUrl}
            />
          </>
        )}
      </div>
    </Layout>
  );
};

export default About;
