import React, { useState, useRef } from 'react';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/features/auth';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, User as UserIcon, Phone, MapPin, Calendar, CreditCard, GraduationCap, Users, School, BookOpen, Camera, Loader2, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import http from '@/lib/http';

const Profile = () => {
  const { user, setUserData } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  
  if (!user) return null;

  const sp = (user as any).student_profile || (user as any).studentProfile || {};
  const gr = sp.guardian || {};

  const educationLevelLabels: Record<string, string> = {
    'primary': 'ابتدائي',
    'prep': 'إعدادي',
    'secondary': 'ثانوي',
    'university': 'جامعي'
  };

  const relationshipLabels: Record<string, string> = {
    'father': 'أب',
    'mother': 'أم',
    'guardian': 'وصي'
  };

  const InfoItem = ({ icon: Icon, label, value }: { icon: any, label: string, value: string | undefined | null }) => (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="p-2 rounded-full bg-primary/10 text-primary shrink-0 mt-0.5">
        <Icon size={18} />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{value || <span className="text-muted-foreground/50 italic">غير متوفر</span>}</p>
      </div>
    </div>
  );

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "حجم الصورة كبير",
        description: "يجب ألا يتجاوز حجم الصورة 10 ميجابايت.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      setIsUploadingAvatar(true);
      const res = await http.post("/accounts/me/avatar/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.user) {
        setUserData(res.data.user);
      }
      toast({
        title: "تم تحديث الصورة الشخصية بنجاح! 🎉",
        description: "تم تحويل الصورة تلقائياً لصيغة WebP فائقة السرعة.",
      });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "فشل رفع الصورة الشخصية.";
      toast({
        title: "تعذر تحديث الصورة",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Layout>
      <div className="container max-w-5xl mx-auto py-10 px-4 space-y-8 animate-fade-in dir-rtl">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">الملف الشخصي</h1>
            <p className="text-sm text-muted-foreground mt-1 font-medium">استعرض بياناتك الشخصية والتعليمية المسجلة لدينا.</p>
          </div>
          <Button asChild className="gradient-cta text-white font-bold h-11 px-6 rounded-xl shadow-md hover:shadow-lg transition-all gap-2">
            <Link to="/settings">
              <Edit size={18} />
              تعديل البيانات
            </Link>
          </Button>
        </div>

        {/* Hero Card */}
        <Card className="glass border-border/50 rounded-2xl shadow-sm overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-primary/80 to-emerald-400/80"></div>
          <CardContent className="p-6 relative">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-end -mt-16 mb-4">
              <div className="relative group shrink-0">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarChange}
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                  className="hidden"
                />
                <UserAvatar
                  src={user.avatar}
                  name={user.fullName}
                  role={user.role}
                  size="hero"
                  showRoleBadge={true}
                  className="border-4 border-card shadow-md"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer"
                  title="تغيير الصورة الشخصية (WebP تلقائي)"
                >
                  {isUploadingAvatar ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <Camera className="w-6 h-6 mb-0.5" />
                      <span className="text-[10px] font-bold">تغيير الصورة</span>
                    </>
                  )}
                </button>
              </div>
              <div className="flex-1 space-y-2">
                <h2 className="text-3xl font-bold">{user.fullName}</h2>
                <div className="flex items-center gap-3">
                  <p className="text-muted-foreground font-medium">{user.email}</p>
                  <Badge variant={user.role === 'admin' ? 'destructive' : user.role === 'instructor' ? 'default' : 'secondary'} className="rounded-full px-3 py-1 font-bold">
                    {user.role === 'admin' ? 'مدير' : user.role === 'instructor' ? 'مدرب' : 'طالب'}
                  </Badge>
                </div>
              </div>
            </div>
            
            {user.bio && (
              <div className="mt-6 p-4 rounded-xl bg-muted/30 border border-border/50">
                <p className="text-sm leading-relaxed text-foreground/90">
                  <span className="font-bold block mb-1">نبذة:</span>
                  {user.bio}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Grids */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Personal Info */}
          <Card className="glass border-border/50 rounded-2xl shadow-sm">
            <CardHeader className="bg-muted/20 border-b border-border/30 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-primary" /> البيانات الأساسية
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-1 gap-1">
              <InfoItem icon={Phone} label="رقم الهاتف" value={user.phone} />
              <InfoItem icon={Calendar} label="تاريخ الميلاد" value={(user as any).date_of_birth || user.dateOfBirth} />
              <InfoItem icon={UserIcon} label="النوع" value={user.gender === 'male' ? 'ذكر' : user.gender === 'female' ? 'أنثى' : ''} />
              <InfoItem icon={CreditCard} label="الرقم القومي" value={(user as any).national_id || user.nationalId} />
              <InfoItem icon={MapPin} label="العنوان" value={[user.governorate, user.city].filter(Boolean).join(' - ')} />
            </CardContent>
          </Card>

          {/* Education Info (If Student) */}
          {user.role === 'student' && (
            <div className="space-y-6">
              <Card className="glass border-border/50 rounded-2xl shadow-sm">
                <CardHeader className="bg-muted/20 border-b border-border/30 pb-4">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-primary" /> البيانات التعليمية
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-1 gap-1">
                  <InfoItem icon={BookOpen} label="المرحلة الدراسية" value={educationLevelLabels[sp.education_level || sp.educationLevel] || ''} />
                  
                  {(sp.education_level === 'university' || sp.educationLevel === 'university') ? (
                    <>
                      <InfoItem icon={School} label="الجامعة" value={sp.university_name || sp.universityName} />
                      <InfoItem icon={GraduationCap} label="الكلية" value={sp.faculty_name || sp.facultyName} />
                    </>
                  ) : (
                    <>
                      <InfoItem icon={School} label="المدرسة" value={sp.school_name || sp.schoolName} />
                      <InfoItem icon={GraduationCap} label="الصف الدراسي" value={sp.grade_level || sp.gradeLevel} />
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="glass border-border/50 rounded-2xl shadow-sm">
                <CardHeader className="bg-muted/20 border-b border-border/30 pb-4">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" /> بيانات ولي الأمر
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-1 gap-1">
                  <InfoItem icon={UserIcon} label="الاسم" value={gr.full_name || gr.fullName} />
                  <InfoItem icon={Users} label="صلة القرابة" value={relationshipLabels[gr.relationship] || ''} />
                  <InfoItem icon={Phone} label="رقم الهاتف" value={gr.phone} />
                  <InfoItem icon={CreditCard} label="الرقم القومي" value={gr.national_id || gr.nationalId} />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Profile;
