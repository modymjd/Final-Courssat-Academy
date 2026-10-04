import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { superAdminGet, superAdminPost, superAdminPatch } from "@/lib/superAdminHttp";
import AboutCmsTab from "@/components/super-admin/about/AboutCmsTab";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { PageLoading } from "@/components/common/LoadingState";
import {
  Palette,
  Image as ImageIcon,
  Video,
  Globe,
  Share2,
  RefreshCw,
  Save,
  Eye,
  CheckCircle2,
  Upload,
  ExternalLink,
  Facebook,
  Twitter,
  Linkedin,
  Youtube,
  Instagram,
  Sparkles,
  AlertCircle,
} from "lucide-react";

export interface PlatformSettingsFormData {
  site_name: string;
  site_tagline: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  dark_mode_enabled: boolean;
  hero_title: string;
  hero_subtitle: string;
  support_email: string;
  support_phone: string;
  terms_url: string;
  privacy_url: string;
  faq_url: string;
  facebook_url: string;
  twitter_url: string;
  linkedin_url: string;
  youtube_url: string;
  instagram_url: string;
  logoUrl?: string;
  faviconUrl?: string;
  heroBannerUrl?: string;
  promoVideoUrl?: string;
  cdn_cache_version?: number;
}

export default function ContentThemePage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("branding");
  const [formState, setFormState] = useState<PlatformSettingsFormData>({
    site_name: "",
    site_tagline: "",
    primary_color: "#4f46e5",
    secondary_color: "#06b6d4",
    accent_color: "#f59e0b",
    dark_mode_enabled: true,
    hero_title: "",
    hero_subtitle: "",
    support_email: "",
    support_phone: "",
    terms_url: "",
    privacy_url: "",
    faq_url: "",
    facebook_url: "",
    twitter_url: "",
    linkedin_url: "",
    youtube_url: "",
    instagram_url: "",
  });

  // Files state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [heroBannerFile, setHeroBannerFile] = useState<File | null>(null);
  const [promoVideoFile, setPromoVideoFile] = useState<File | null>(null);

  // Previews
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [faviconPreview, setFaviconPreview] = useState<string>("");
  const [heroBannerPreview, setHeroBannerPreview] = useState<string>("");
  const [promoVideoPreview, setPromoVideoPreview] = useState<string>("");

  // Fetch initial settings
  const { data: settingsData, isLoading, isError, refetch } = useQuery({
    queryKey: ["super-admin-settings"],
    queryFn: async () => {
      return superAdminGet<PlatformSettingsFormData>("/super-admin/settings/");
    },
  });

  useEffect(() => {
    if (settingsData) {
      setFormState({
        site_name: settingsData.site_name || (settingsData as any).siteName || "",
        site_tagline: settingsData.site_tagline || (settingsData as any).siteTagline || "",
        primary_color: settingsData.primary_color || (settingsData as any).primaryColor || "#4f46e5",
        secondary_color: settingsData.secondary_color || (settingsData as any).secondaryColor || "#06b6d4",
        accent_color: settingsData.accent_color || (settingsData as any).accentColor || "#f59e0b",
        dark_mode_enabled: settingsData.dark_mode_enabled ?? (settingsData as any).darkModeEnabled ?? true,
        hero_title: settingsData.hero_title || (settingsData as any).heroTitle || "",
        hero_subtitle: settingsData.hero_subtitle || (settingsData as any).heroSubtitle || "",
        support_email: settingsData.support_email || (settingsData as any).supportEmail || "",
        support_phone: settingsData.support_phone || (settingsData as any).supportPhone || "",
        terms_url: settingsData.terms_url || (settingsData as any).termsUrl || "",
        privacy_url: settingsData.privacy_url || (settingsData as any).privacyUrl || "",
        faq_url: settingsData.faq_url || (settingsData as any).faqUrl || "",
        facebook_url: settingsData.facebook_url || (settingsData as any).facebookUrl || "",
        twitter_url: settingsData.twitter_url || (settingsData as any).twitterUrl || "",
        linkedin_url: settingsData.linkedin_url || (settingsData as any).linkedinUrl || "",
        youtube_url: settingsData.youtube_url || (settingsData as any).youtubeUrl || "",
        instagram_url: settingsData.instagram_url || (settingsData as any).instagramUrl || "",
        logoUrl: settingsData.logoUrl || (settingsData as any).logo_url,
        faviconUrl: settingsData.faviconUrl || (settingsData as any).favicon_url,
        heroBannerUrl: settingsData.heroBannerUrl || (settingsData as any).hero_banner_url,
        promoVideoUrl: settingsData.promoVideoUrl || (settingsData as any).promo_video_url,
        cdn_cache_version: settingsData.cdn_cache_version ?? (settingsData as any).cdnCacheVersion ?? 1,
      });

      const logo = settingsData.logoUrl || (settingsData as any).logo_url;
      if (logo) setLogoPreview(logo);

      const favicon = settingsData.faviconUrl || (settingsData as any).favicon_url;
      if (favicon) setFaviconPreview(favicon);

      const heroBanner = settingsData.heroBannerUrl || (settingsData as any).hero_banner_url;
      if (heroBanner) setHeroBannerPreview(heroBanner);

      const promoVideo = settingsData.promoVideoUrl || (settingsData as any).promo_video_url;
      if (promoVideo) setPromoVideoPreview(promoVideo);
    }
  }, [settingsData]);

  // Save Settings Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      Object.entries(formState).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          formData.append(key, String(val));
        }
      });

      if (logoFile) formData.append("logo", logoFile);
      if (faviconFile) formData.append("favicon", faviconFile);
      if (heroBannerFile) formData.append("hero_banner", heroBannerFile);
      if (promoVideoFile) formData.append("promo_video", promoVideoFile);

      return superAdminPatch<{ message: string; settings: PlatformSettingsFormData }>("/super-admin/settings/", formData);
    },
    onSuccess: (res) => {
      toast({ title: "تم نشر التعديلات بنجاح", description: res.message });
      queryClient.invalidateQueries({ queryKey: ["super-admin-settings"] });
      queryClient.invalidateQueries({ queryKey: ["public-platform-theme"] });
    },
    onError: (err: any) => {
      toast({ title: "خطأ في النشر", description: err?.message || "فشلت عملية حفظ الإعدادات", variant: "destructive" });
    },
  });

  // CDN Cache Invalidation Mutation
  const cdnInvalidateMutation = useMutation({
    mutationFn: async () => {
      return superAdminPost<{ message: string; cdn_cache_version: number }>("/super-admin/settings/invalidate-cdn/");
    },

    onSuccess: (res) => {
      toast({ title: "تطهير الـ CDN Cache", description: `${res.message} الإصدار الحالي: v${res.cdn_cache_version}` });
      queryClient.invalidateQueries({ queryKey: ["super-admin-settings"] });
    },
    onError: (err: any) => {
      toast({ title: "فشل تطهير الـ Cache", description: err?.message || "فشلت عملية الإرسال", variant: "destructive" });
    },
  });

  const handleInputChange = (field: keyof PlatformSettingsFormData, value: any) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (field: "logo" | "favicon" | "hero_banner" | "promo_video", file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (field === "logo") {
      setLogoFile(file);
      setLogoPreview(url);
    } else if (field === "favicon") {
      setFaviconFile(file);
      setFaviconPreview(url);
    } else if (field === "hero_banner") {
      setHeroBannerFile(file);
      setHeroBannerPreview(url);
    } else if (field === "promo_video") {
      setPromoVideoFile(file);
      setPromoVideoPreview(url);
    }
  };

  if (isLoading) return <PageLoading />;

  if (isError) {
    return (
      <div className="p-12 text-center bg-slate-900 border border-red-900/50 rounded-2xl space-y-4 max-w-md mx-auto mt-12">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">تعذر تحميل إعدادات المحتوى والهوية</h2>
        <p className="text-xs text-slate-400">
          حدث خطأ أثناء الاتصال بالخادم لجلب إعدادات المنصة. يرجى التحقق من الجلسة والصلاحيات ثم إعادة المحاولة.
        </p>
        <Button
          variant="outline"
          className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 gap-2"
          onClick={() => refetch()}
        >
          <RefreshCw className="h-4 w-4" /> إعادة المحاولة
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Palette className="h-6 w-6 shrink-0 text-indigo-400" /> إدارة المحتوى والهوية البصرية (Theme & Content)
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            التحكم الديناميكي التام في ألوان المنصة، الصور الرئيسية، الشعار، البنرات، والروابط دون الحاجة لإعادة نشر الكود.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* CDN Invalidate Button */}
          <Button
            variant="outline"
            className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 gap-2"
            onClick={() => cdnInvalidateMutation.mutate()}
            disabled={cdnInvalidateMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 text-cyan-400 ${cdnInvalidateMutation.isPending ? "animate-spin" : ""}`} />
            تطهير الـ CDN Cache (v{formState.cdn_cache_version || 1})
          </Button>

          {/* Save & Publish Button */}
          <Button
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold gap-2 shadow-lg shadow-indigo-900/30"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "جاري الحفظ والنشر..." : "حفظ ونشر الهوية"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-900 border border-slate-800 p-1">
          <TabsTrigger value="branding" className="gap-2">
            <Palette className="h-4 w-4" /> الهوية والألوان
          </TabsTrigger>
          <TabsTrigger value="about" className="gap-2 text-indigo-400 font-bold">
            <Sparkles className="h-4 w-4" /> عن المنصة (About CMS)
          </TabsTrigger>
          <TabsTrigger value="media" className="gap-2">
            <ImageIcon className="h-4 w-4" /> البنرات والوسائط
          </TabsTrigger>
          <TabsTrigger value="links" className="gap-2">
            <Globe className="h-4 w-4" /> الروابط والدعم
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2 text-emerald-400 font-semibold">
            <Eye className="h-4 w-4" /> المعاينة الحية (Live Preview)
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Branding & Theme Tokens */}
        <TabsContent value="branding" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-400" /> معلومات المنصة والشعار
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">
                  اسم المنصة، الشعار اللفظي، والشعار الرسومي.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 block">اسم المنصة الرسمي</label>
                  <Input
                    value={formState.site_name}
                    onChange={(e) => handleInputChange("site_name", e.target.value)}
                    className="bg-slate-950 border-slate-800"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 block">الشعار اللفظي (Tagline)</label>
                  <Input
                    value={formState.site_tagline}
                    onChange={(e) => handleInputChange("site_tagline", e.target.value)}
                    className="bg-slate-950 border-slate-800"
                  />
                </div>

                {/* Logo File */}
                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 block">شعار المنصة (Logo File)</label>
                  <div className="flex items-center gap-4">
                    {logoPreview && (
                      <div className="h-12 w-24 rounded border border-slate-800 bg-slate-950 p-1 flex items-center justify-center">
                        <img src={logoPreview} alt="Logo Preview" className="max-h-full max-w-full object-contain" />
                      </div>
                    )}
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange("logo", e.target.files?.[0] || null)}
                      className="bg-slate-950 border-slate-800 text-xs"
                    />
                  </div>
                </div>

                {/* Favicon File */}
                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 block">أيقونة المتصفح (Favicon)</label>
                  <div className="flex items-center gap-4">
                    {faviconPreview && (
                      <div className="h-10 w-10 rounded border border-slate-800 bg-slate-950 p-1 flex items-center justify-center">
                        <img src={faviconPreview} alt="Favicon Preview" className="max-h-full max-w-full object-contain" />
                      </div>
                    )}
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange("favicon", e.target.files?.[0] || null)}
                      className="bg-slate-950 border-slate-800 text-xs"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Palette className="h-4 w-4 text-cyan-400" /> ألوان الهوية البصرية (Runtime Theme Tokens)
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">
                  ألوان الثيم الديناميكية التي تنطبق على المنصة في الوقت الفعلي.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
                {/* Primary Color */}
                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 block">اللون الرئيسي (Primary Color)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={formState.primary_color}
                      onChange={(e) => handleInputChange("primary_color", e.target.value)}
                      className="h-10 w-12 rounded cursor-pointer bg-transparent border-0"
                    />
                    <Input
                      value={formState.primary_color}
                      onChange={(e) => handleInputChange("primary_color", e.target.value)}
                      className="bg-slate-950 border-slate-800 font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Secondary Color */}
                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 block">اللون الثانوي (Secondary Color)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={formState.secondary_color}
                      onChange={(e) => handleInputChange("secondary_color", e.target.value)}
                      className="h-10 w-12 rounded cursor-pointer bg-transparent border-0"
                    />
                    <Input
                      value={formState.secondary_color}
                      onChange={(e) => handleInputChange("secondary_color", e.target.value)}
                      className="bg-slate-950 border-slate-800 font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Accent Color */}
                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 block">لون التميز والتأكيد (Accent Color)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={formState.accent_color}
                      onChange={(e) => handleInputChange("accent_color", e.target.value)}
                      className="h-10 w-12 rounded cursor-pointer bg-transparent border-0"
                    />
                    <Input
                      value={formState.accent_color}
                      onChange={(e) => handleInputChange("accent_color", e.target.value)}
                      className="bg-slate-950 border-slate-800 font-mono text-xs"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: About Us CMS */}
        <TabsContent value="about" className="mt-6">
          <AboutCmsTab />
        </TabsContent>

        {/* Tab 3: Core Media & Banners */}
        <TabsContent value="media" className="mt-6 space-y-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-emerald-400" /> محتوى الصفحة الرئيسية والبنرات
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                تعديل النصوص التسويقية، صورة البانر الرئيسية، والفيديو التعريفي.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <div>
                <label className="text-xs text-slate-300 font-medium mb-1 block">عنوان البانر الرئيسي (Hero Title)</label>
                <Input
                  value={formState.hero_title}
                  onChange={(e) => handleInputChange("hero_title", e.target.value)}
                  className="bg-slate-950 border-slate-800 font-bold"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium mb-1 block">الوصف الفرعي (Hero Subtitle)</label>
                <Textarea
                  value={formState.hero_subtitle}
                  onChange={(e) => handleInputChange("hero_subtitle", e.target.value)}
                  className="bg-slate-950 border-slate-800 h-24 text-xs"
                />
              </div>

              {/* Hero Banner Image */}
              <div>
                <label className="text-xs text-slate-300 font-medium mb-1 block">صورة البانر الرئيسية (Hero Banner Image)</label>
                {heroBannerPreview && (
                  <div className="mb-2 h-40 w-full rounded border border-slate-800 bg-slate-950 overflow-hidden relative">
                    <img src={heroBannerPreview} alt="Hero Banner" className="w-full h-full object-cover" />
                  </div>
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange("hero_banner", e.target.files?.[0] || null)}
                  className="bg-slate-950 border-slate-800 text-xs"
                />
              </div>

              {/* Promo Video */}
              <div>
                <label className="text-xs text-slate-300 font-medium mb-1 block">الفيديو التعريفي للمنصة (Promo Video File)</label>
                {promoVideoPreview && (
                  <div className="mb-2 rounded border border-slate-800 bg-slate-950 overflow-hidden p-2">
                    <video src={promoVideoPreview} controls className="w-full max-h-48 rounded" />
                  </div>
                )}
                <Input
                  type="file"
                  accept="video/*"
                  onChange={(e) => handleFileChange("promo_video", e.target.files?.[0] || null)}
                  className="bg-slate-950 border-slate-800 text-xs"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Links & Support */}
        <TabsContent value="links" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-400" /> روابط الدعم والشروط والأحكام
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 block">بريد الدعم الفني</label>
                  <Input
                    value={formState.support_email}
                    onChange={(e) => handleInputChange("support_email", e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 block">رقم هاتف التواصل والدعم</label>
                  <Input
                    value={formState.support_phone}
                    onChange={(e) => handleInputChange("support_phone", e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 block">رابط الشروط والأحكام (Terms URL)</label>
                  <Input
                    value={formState.terms_url}
                    onChange={(e) => handleInputChange("terms_url", e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 block">رابط سياسة الخصوصية (Privacy URL)</label>
                  <Input
                    value={formState.privacy_url}
                    onChange={(e) => handleInputChange("privacy_url", e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 block">رابط الأسئلة الشائعة (FAQ URL)</label>
                  <Input
                    value={formState.faq_url}
                    onChange={(e) => handleInputChange("faq_url", e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs font-mono"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-purple-400" /> روابط التواصل الاجتماعي (Social Links)
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                    <Facebook className="h-3.5 w-3.5 text-blue-500" /> Facebook
                  </label>
                  <Input
                    value={formState.facebook_url}
                    onChange={(e) => handleInputChange("facebook_url", e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                    <Twitter className="h-3.5 w-3.5 text-sky-400" /> Twitter / X
                  </label>
                  <Input
                    value={formState.twitter_url}
                    onChange={(e) => handleInputChange("twitter_url", e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                    <Linkedin className="h-3.5 w-3.5 text-blue-400" /> LinkedIn
                  </label>
                  <Input
                    value={formState.linkedin_url}
                    onChange={(e) => handleInputChange("linkedin_url", e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                    <Youtube className="h-3.5 w-3.5 text-red-500" /> YouTube
                  </label>
                  <Input
                    value={formState.youtube_url}
                    onChange={(e) => handleInputChange("youtube_url", e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                    <Instagram className="h-3.5 w-3.5 text-pink-500" /> Instagram
                  </label>
                  <Input
                    value={formState.instagram_url}
                    onChange={(e) => handleInputChange("instagram_url", e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs font-mono"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 4: Live Preview Mode */}
        <TabsContent value="preview" className="mt-6">
          <Card className="bg-slate-950 border-slate-800 overflow-hidden">
            <CardHeader className="bg-slate-900/60 border-b border-slate-800">
              <CardTitle className="text-base font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2 text-emerald-400">
                  <Eye className="h-5 w-5" /> المعاينة التفاعلية المباشرة (Live Preview Before Publishing)
                </span>
                <span className="text-xs font-mono text-slate-400">PREVIEW MODE ACTIVE</span>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-6 space-y-8">
              {/* Fake Navigation Header */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800 shadow">
                <div className="flex items-center gap-3">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="h-8 object-contain" />
                  ) : (
                    <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-xs">
                      {formState.site_name ? formState.site_name.trim().slice(0, 2).toUpperCase() : "LOGO"}
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-sm text-slate-100">{formState.site_name || "اسم المنصة"}</div>
                    <div className="text-[10px] text-slate-400">{formState.site_tagline || "الشعار اللفظي للمنصة"}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    style={{ backgroundColor: formState.primary_color }}
                    className="text-white text-xs shadow"
                  >
                    زر تجريبي
                  </Button>
                </div>
              </div>

              {/* Fake Hero Banner */}
              <div className="relative rounded-2xl overflow-hidden p-8 border border-slate-800 bg-slate-900/80 min-h-[260px] flex items-center justify-between">
                {heroBannerPreview && (
                  <img
                    src={heroBannerPreview}
                    alt="Hero Banner"
                    className="absolute inset-0 w-full h-full object-cover opacity-25"
                  />
                )}

                <div className="relative z-10 max-w-xl space-y-3">
                  <h2 className="text-2xl font-black text-white leading-tight">
                    {formState.hero_title || "عنوان البانر الرئيسي"}
                  </h2>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    {formState.hero_subtitle || "الوصف التعريفي للبانر الرئيسي يظهر هنا عند إدخاله."}
                  </p>

                  <div className="pt-2 flex items-center gap-3">
                    <Button style={{ backgroundColor: formState.primary_color }} className="text-white text-xs">
                      استكشف الدورات
                    </Button>
                    <Button variant="outline" style={{ borderColor: formState.secondary_color, color: formState.secondary_color }} className="text-xs">
                      فيديو المنصة
                    </Button>
                  </div>
                </div>

                {promoVideoPreview && (
                  <div className="relative z-10 hidden lg:block w-72 h-40 rounded-xl overflow-hidden border border-slate-700 shadow-2xl bg-black">
                    <video src={promoVideoPreview} controls className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              {/* Fake Footer Social Bar */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
                <div className="text-slate-400">
                  © {new Date().getFullYear()} {formState.site_name || "اسم المنصة"}
                  {formState.support_email ? ` — الدعم: ${formState.support_email}` : ""}
                  {formState.support_phone ? ` | ${formState.support_phone}` : ""}
                </div>

                <div className="flex items-center gap-3 text-slate-300">
                  {formState.facebook_url && <Facebook className="h-4 w-4 text-blue-500" />}
                  {formState.twitter_url && <Twitter className="h-4 w-4 text-sky-400" />}
                  {formState.linkedin_url && <Linkedin className="h-4 w-4 text-blue-400" />}
                  {formState.youtube_url && <Youtube className="h-4 w-4 text-red-500" />}
                  {formState.instagram_url && <Instagram className="h-4 w-4 text-pink-500" />}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
