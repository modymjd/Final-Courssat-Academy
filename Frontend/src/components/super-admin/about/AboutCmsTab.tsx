import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  superAdminGet, 
  superAdminPatch, 
  superAdminPost, 
  superAdminDelete 
} from "@/lib/superAdminHttp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { PageLoading } from "@/components/common/LoadingState";
import {
  User,
  Building2,
  GraduationCap,
  Users,
  Handshake,
  Mail,
  Save,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Twitter,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

export interface AboutCmsFormData {
  founder_name: string;
  founder_title: string;
  founder_quote: string;
  founder_photo_url?: string | null;

  company_name: string;
  company_tagline: string;
  company_description: string;
  company_logo_url?: string | null;

  platform_name: string;
  platform_tagline: string;
  platform_description: string;

  contact_email: string;
  contact_phone: string;
  facebook_url: string;
  instagram_url: string;
  linkedin_url: string;
  youtube_url: string;
  twitter_url: string;

  team_members?: any[];
  partnerships?: any[];
}

export const AboutCmsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [formState, setFormState] = useState<AboutCmsFormData>({
    founder_name: "",
    founder_title: "",
    founder_quote: "",
    company_name: "",
    company_tagline: "",
    company_description: "",
    platform_name: "",
    platform_tagline: "",
    platform_description: "",
    contact_email: "",
    contact_phone: "",
    facebook_url: "",
    instagram_url: "",
    linkedin_url: "",
    youtube_url: "",
    twitter_url: "",
    team_members: [],
    partnerships: [],
  });

  const [founderPhotoFile, setFounderPhotoFile] = useState<File | null>(null);
  const [founderPhotoPreview, setFounderPhotoPreview] = useState<string>("");
  const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null);
  const [companyLogoPreview, setCompanyLogoPreview] = useState<string>("");

  // New Team Member state
  const [newMember, setNewMember] = useState({ name: "", role: "", quote: "" });
  // New Partnership state
  const [newPartnership, setNewPartnership] = useState({ partner_name: "", date: "", description: "" });

  // Fetch about data from Super Admin API
  const { data: aboutData, isLoading, isError, refetch } = useQuery({
    queryKey: ["super-admin-about"],
    queryFn: async () => {
      return superAdminGet<any>("/super-admin/content/about/");
    },
  });

  useEffect(() => {
    if (aboutData) {
      setFormState({
        founder_name: aboutData.founder_name || aboutData.founderName || "",
        founder_title: aboutData.founder_title || aboutData.founderTitle || "",
        founder_quote: aboutData.founder_quote || aboutData.founderQuote || "",
        company_name: aboutData.company_name || aboutData.companyName || "",
        company_tagline: aboutData.company_tagline || aboutData.companyTagline || "",
        company_description: aboutData.company_description || aboutData.companyDescription || "",
        platform_name: aboutData.platform_name || aboutData.platformName || "",
        platform_tagline: aboutData.platform_tagline || aboutData.platformTagline || "",
        platform_description: aboutData.platform_description || aboutData.platformDescription || "",
        contact_email: aboutData.contact_email || aboutData.contactEmail || "",
        contact_phone: aboutData.contact_phone || aboutData.contactPhone || "",
        facebook_url: aboutData.facebook_url || aboutData.facebookUrl || "",
        instagram_url: aboutData.instagram_url || aboutData.instagramUrl || "",
        linkedin_url: aboutData.linkedin_url || aboutData.linkedinUrl || "",
        youtube_url: aboutData.youtube_url || aboutData.youtubeUrl || "",
        twitter_url: aboutData.twitter_url || aboutData.twitterUrl || "",
        team_members: aboutData.team_members || aboutData.teamMembers || [],
        partnerships: aboutData.partnerships || [],
      });

      const founderPhoto = aboutData.founder_photo_url || aboutData.founderPhotoUrl;
      if (founderPhoto) setFounderPhotoPreview(founderPhoto);

      const companyLogo = aboutData.company_logo_url || aboutData.companyLogoUrl;
      if (companyLogo) setCompanyLogoPreview(companyLogo);
    }
  }, [aboutData]);

  // Main Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      Object.entries(formState).forEach(([key, val]) => {
        if (key !== "team_members" && key !== "partnerships" && val !== undefined && val !== null) {
          formData.append(key, String(val));
        }
      });

      if (founderPhotoFile) formData.append("founder_photo", founderPhotoFile);
      if (companyLogoFile) formData.append("company_logo", companyLogoFile);

      return superAdminPatch<{ message: string; data: any }>("/super-admin/content/about/", formData);
    },
    onSuccess: (res) => {
      toast({ title: "تم التحديث بنجاح", description: res.message || "تم حفظ جميع بيانات صفحة من نحن" });
      queryClient.invalidateQueries({ queryKey: ["super-admin-about"] });
      queryClient.invalidateQueries({ queryKey: ["public-platform-about"] });
    },
    onError: (err: any) => {
      toast({ title: "خطأ في الحفظ", description: err?.message || "فشلت عملية تحديث صفحة من نحن", variant: "destructive" });
    },
  });

  // Team Member Add Mutation
  const addTeamMemberMutation = useMutation({
    mutationFn: async () => {
      return superAdminPost<any>("/super-admin/content/about/team-members/", {
        ...newMember,
        order: (formState.team_members?.length || 0) + 1,
      });
    },
    onSuccess: () => {
      toast({ title: "تم إضافة عضو الفريق" });
      setNewMember({ name: "", role: "", quote: "" });
      queryClient.invalidateQueries({ queryKey: ["super-admin-about"] });
      queryClient.invalidateQueries({ queryKey: ["public-platform-about"] });
    },
  });

  // Team Member Delete Mutation
  const deleteTeamMemberMutation = useMutation({
    mutationFn: async (id: number | string) => {
      return superAdminDelete(`/super-admin/content/about/team-members/${id}/`);
    },
    onSuccess: () => {
      toast({ title: "تم حذف عضو الفريق" });
      queryClient.invalidateQueries({ queryKey: ["super-admin-about"] });
      queryClient.invalidateQueries({ queryKey: ["public-platform-about"] });
    },
  });

  // Partnership Add Mutation
  const addPartnershipMutation = useMutation({
    mutationFn: async () => {
      return superAdminPost<any>("/super-admin/content/about/partnerships/", {
        ...newPartnership,
        order: (formState.partnerships?.length || 0) + 1,
      });
    },
    onSuccess: () => {
      toast({ title: "تم إضافة المحطة للشراكات" });
      setNewPartnership({ partner_name: "", date: "", description: "" });
      queryClient.invalidateQueries({ queryKey: ["super-admin-about"] });
      queryClient.invalidateQueries({ queryKey: ["public-platform-about"] });
    },
  });

  // Partnership Delete Mutation
  const deletePartnershipMutation = useMutation({
    mutationFn: async (id: number | string) => {
      return superAdminDelete(`/super-admin/content/about/partnerships/${id}/`);
    },
    onSuccess: () => {
      toast({ title: "تم حذف المحطة" });
      queryClient.invalidateQueries({ queryKey: ["super-admin-about"] });
      queryClient.invalidateQueries({ queryKey: ["public-platform-about"] });
    },
  });

  const handleInputChange = (field: keyof AboutCmsFormData, value: any) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (field: "founder" | "company", file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (field === "founder") {
      setFounderPhotoFile(file);
      setFounderPhotoPreview(url);
    } else if (field === "company") {
      setCompanyLogoFile(file);
      setCompanyLogoPreview(url);
    }
  };

  if (isLoading) return <PageLoading />;

  if (isError) {
    return (
      <div className="p-12 text-center bg-slate-900 border border-red-900/50 rounded-2xl space-y-4 max-w-md mx-auto my-8">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">تعذر تحميل بيانات صفحة "من نحن"</h2>
        <p className="text-xs text-slate-400">
          حدث خطأ أثناء الاتصال بالخادم لجلب بيانات صفحة من نحن. يرجى التحقق من الجلسة والصلاحيات ثم إعادة المحاولة.
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
    <div className="space-y-8 text-right" dir="rtl">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" /> إدارة صفحة "من نحن" (About Us CMS)
          </h2>
          <p className="text-xs text-slate-400">
            تحديث نصوص المؤسس، الشركة، المنصة، فريق العمل، ومسيرة الشراكات في الوقت الفعلي.
          </p>
        </div>

        <Button
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2 shadow-lg shadow-indigo-900/30"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? "جاري الحفظ..." : "حفظ ونشر التغييرات"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left/Main Column: Founder, Company, Platform & Social */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Section 1: Founder Info */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2 text-indigo-400">
                <User className="w-5 h-5" /> قسم المؤسس (Founder Hero)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 font-medium mb-1 block">اسم المؤسس</label>
                <Input
                  value={formState.founder_name}
                  onChange={(e) => handleInputChange("founder_name", e.target.value)}
                  className="bg-slate-950 border-slate-800"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium mb-1 block">المسمى الوظيفي / اللقب</label>
                <Input
                  value={formState.founder_title}
                  onChange={(e) => handleInputChange("founder_title", e.target.value)}
                  className="bg-slate-950 border-slate-800"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium mb-1 block">كلمة المؤسس (افتتاحية الرؤية)</label>
                <Textarea
                  value={formState.founder_quote}
                  onChange={(e) => handleInputChange("founder_quote", e.target.value)}
                  className="bg-slate-950 border-slate-800 h-28 text-xs"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium mb-1 block">صورة المؤسس (Photo Upload)</label>
                <div className="flex items-center gap-4">
                  {founderPhotoPreview && (
                    <div className="h-16 w-16 rounded-full overflow-hidden border border-slate-700 bg-slate-950">
                      <img src={founderPhotoPreview} alt="Founder Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange("founder", e.target.files?.[0] || null)}
                    className="bg-slate-950 border-slate-800 text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2 & 3: Company & Platform Info */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2 text-emerald-400">
                <Building2 className="w-5 h-5" /> بيانات الشركة والمنصة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 block">اسم الشركة</label>
                  <Input
                    value={formState.company_name}
                    placeholder="أدخل اسم الشركة"
                    onChange={(e) => handleInputChange("company_name", e.target.value)}
                    className="bg-slate-950 border-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 block">شعار الشركة (Tagline)</label>
                  <Input
                    value={formState.company_tagline}
                    placeholder="أدخل شعار الشركة"
                    onChange={(e) => handleInputChange("company_tagline", e.target.value)}
                    className="bg-slate-950 border-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium mb-1 block">وصف الشركة</label>
                <Textarea
                  value={formState.company_description}
                  placeholder="اكتب نبذة تعريفية عن الشركة..."
                  onChange={(e) => handleInputChange("company_description", e.target.value)}
                  className="bg-slate-950 border-slate-800 h-24 text-xs"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium mb-1 block">لوجو الشركة (Company Logo)</label>
                <div className="flex items-center gap-4">
                  {companyLogoPreview && (
                    <div className="h-12 w-24 rounded border border-slate-800 bg-slate-950 p-1 flex items-center justify-center">
                      <img src={companyLogoPreview} alt="Company Logo" className="max-h-full max-w-full object-contain" />
                    </div>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange("company", e.target.files?.[0] || null)}
                    className="bg-slate-950 border-slate-800 text-xs"
                  />
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-300 font-medium mb-1 block">اسم المنصة التعليمية</label>
                    <Input
                      value={formState.platform_name}
                      placeholder="أدخل اسم المنصة التعليمية"
                      onChange={(e) => handleInputChange("platform_name", e.target.value)}
                      className="bg-slate-950 border-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-300 font-medium mb-1 block">شعار المنصة (Tagline)</label>
                    <Input
                      value={formState.platform_tagline}
                      placeholder="أدخل شعار المنصة"
                      onChange={(e) => handleInputChange("platform_tagline", e.target.value)}
                      className="bg-slate-950 border-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 block">وصف ومميزات المنصة</label>
                  <Textarea
                    value={formState.platform_description}
                    placeholder="اكتب وصف ومميزات المنصة..."
                    onChange={(e) => handleInputChange("platform_description", e.target.value)}
                    className="bg-slate-950 border-slate-800 h-24 text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 6: Contact & Social */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2 text-cyan-400">
                <Mail className="w-5 h-5" /> بيانات التواصل والسوشيال ميديا
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 block">بريد الدعم والتواصل</label>
                  <Input
                    value={formState.contact_email}
                    onChange={(e) => handleInputChange("contact_email", e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 block">رقم الهاتف / واتساب</label>
                  <Input
                    value={formState.contact_phone}
                    onChange={(e) => handleInputChange("contact_phone", e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                    <Facebook className="w-3.5 h-3.5 text-blue-500" /> Facebook URL
                  </label>
                  <Input
                    value={formState.facebook_url}
                    onChange={(e) => handleInputChange("facebook_url", e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                    <Instagram className="w-3.5 h-3.5 text-pink-500" /> Instagram URL
                  </label>
                  <Input
                    value={formState.instagram_url}
                    onChange={(e) => handleInputChange("instagram_url", e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                    <Linkedin className="w-3.5 h-3.5 text-blue-400" /> LinkedIn URL
                  </label>
                  <Input
                    value={formState.linkedin_url}
                    onChange={(e) => handleInputChange("linkedin_url", e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                    <Youtube className="w-3.5 h-3.5 text-red-500" /> YouTube URL
                  </label>
                  <Input
                    value={formState.youtube_url}
                    onChange={(e) => handleInputChange("youtube_url", e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs font-mono"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                    <Twitter className="w-3.5 h-3.5 text-sky-400" /> X (Twitter) URL
                  </label>
                  <Input
                    value={formState.twitter_url}
                    onChange={(e) => handleInputChange("twitter_url", e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs font-mono"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Right Column: Dynamic Lists (Team Members & Partnerships) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Section 4: Team Members List */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center justify-between text-amber-400">
                <span className="flex items-center gap-2">
                  <Users className="w-5 h-5" /> فريق العمل (Team Members)
                </span>
                <span className="text-xs font-normal text-slate-400">
                  {formState.team_members?.length || 0} عضو
                </span>
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                إضافة وحذف وتعديل أعضاء الفريق.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Add New Member Input Group */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <p className="text-xs font-bold text-slate-300 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5 text-emerald-400" /> إضافة عضو جديد
                </p>
                <Input
                  placeholder="الاسم الثلاثي"
                  value={newMember.name}
                  onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                  className="bg-slate-900 border-slate-800 text-xs"
                />
                <Input
                  placeholder="الدور / المسمى الوظيفي"
                  value={newMember.role}
                  onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                  className="bg-slate-900 border-slate-800 text-xs"
                />
                <Input
                  placeholder="مقولة قصيرة أو عبارة تعريفية"
                  value={newMember.quote}
                  onChange={(e) => setNewMember({ ...newMember, quote: e.target.value })}
                  className="bg-slate-900 border-slate-800 text-xs"
                />
                <Button
                  size="sm"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                  onClick={() => addTeamMemberMutation.mutate()}
                  disabled={!newMember.name || !newMember.role || addTeamMemberMutation.isPending}
                >
                  إضافة للعرض
                </Button>
              </div>

              {/* Members List */}
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {(!formState.team_members || formState.team_members.length === 0) && (
                  <div className="p-4 text-center rounded-xl bg-slate-950/60 border border-slate-800/80 text-slate-400 text-xs">
                    لا يوجد أعضاء فريق مسجلون حالياً. يمكنك إضافة عضو جديد من النموذج أعلاه.
                  </div>
                )}
                {formState.team_members?.map((member: any, idx: number) => (
                  <div
                    key={member.id || idx}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-200">{member.name}</p>
                      <p className="text-[11px] text-slate-400">{member.role}</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-red-400 hover:text-red-300 hover:bg-red-950/40 h-8 w-8"
                      onClick={() => member.id && deleteTeamMemberMutation.mutate(member.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Section 5: Partnerships Timeline */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center justify-between text-purple-400">
                <span className="flex items-center gap-2">
                  <Handshake className="w-5 h-5" /> تايم لاين الشراكات (Timeline)
                </span>
                <span className="text-xs font-normal text-slate-400">
                  {formState.partnerships?.length || 0} محطة
                </span>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Add New Partnership Group */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <p className="text-xs font-bold text-slate-300 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5 text-purple-400" /> إضافة محطة جديدة
                </p>
                <Input
                  placeholder="اسم الشريك / د. أو أ."
                  value={newPartnership.partner_name}
                  onChange={(e) => setNewPartnership({ ...newPartnership, partner_name: e.target.value })}
                  className="bg-slate-900 border-slate-800 text-xs"
                />
                <Input
                  type="date"
                  value={newPartnership.date}
                  onChange={(e) => setNewPartnership({ ...newPartnership, date: e.target.value })}
                  className="bg-slate-900 border-slate-800 text-xs"
                />
                <Textarea
                  placeholder="وصف طبيعة الشراكة والإنجاز"
                  value={newPartnership.description}
                  onChange={(e) => setNewPartnership({ ...newPartnership, description: e.target.value })}
                  className="bg-slate-900 border-slate-800 h-20 text-xs"
                />
                <Button
                  size="sm"
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
                  onClick={() => addPartnershipMutation.mutate()}
                  disabled={!newPartnership.partner_name || !newPartnership.date || addPartnershipMutation.isPending}
                >
                  إضافة للتايم لاين
                </Button>
              </div>

              {/* Partnerships List */}
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {(!formState.partnerships || formState.partnerships.length === 0) && (
                  <div className="p-4 text-center rounded-xl bg-slate-950/60 border border-slate-800/80 text-slate-400 text-xs">
                    لا توجد محطات شراكة مسجلة حالياً. يمكنك إضافة محطة جديدة من النموذج أعلاه.
                  </div>
                )}
                {formState.partnerships?.map((item: any, idx: number) => (
                  <div
                    key={item.id || idx}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-purple-300">{item.partner_name || item.partnerName}</p>
                      <p className="text-[11px] text-slate-400">{item.date} — {item.description?.slice(0, 45)}...</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-red-400 hover:text-red-300 hover:bg-red-950/40 h-8 w-8"
                      onClick={() => item.id && deletePartnershipMutation.mutate(item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>

      </div>
    </div>
  );
};

export default AboutCmsTab;
