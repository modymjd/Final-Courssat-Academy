import React, { useState, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  User as UserIcon, Bell, Shield, Paintbrush, Smartphone, CheckCircle, Loader2, KeyRound, 
  SendHorizontal, RefreshCw, GraduationCap, MapPin, Users, Info, Copy, Camera,
  BookOpen, School, Globe, Heart, Compass, Layers, Award, CheckCircle2, Building2, Phone, Sparkles
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EGYPTIAN_GOVERNORATES, validateEgyptianNationalId } from '@/components/auth/register/egyptianValidation';
import { getCitiesByGovernorate } from '@/data/egyptLocations';
import { getGradesForStage, getTracksForGrade, STAGE_LABELS, GRADE_LABELS, TRACK_LABELS } from '@/lib/curriculumData';
import { useAuth } from '@/features/auth';
import { changePassword } from '@/features/users/api';
import { http, apiGet } from '@/lib/http';
import { logger } from '@/lib/logger';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { useToast } from '@/components/ui/use-toast';
import { UserAvatar } from '@/components/common/UserAvatar';
import { useQueryClient } from '@tanstack/react-query';

const Settings = () => {
  const queryClient = useQueryClient();
  const { user, updateUser, setUserData } = useAuth();
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const studentProfile = (user as any)?.student_profile || (user as any)?.studentProfile || {};
  const guardian = studentProfile?.guardian || {};

  // Form states initialized & synchronized with user
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [nationalId, setNationalId] = useState(user?.nationalId || (user as any)?.national_id || '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth || (user as any)?.date_of_birth || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [governorate, setGovernorate] = useState(user?.governorate || '');
  const [city, setCity] = useState(user?.city || '');
  const [bio, setBio] = useState(user?.bio || '');

  const availableCities = React.useMemo(() => {
    return getCitiesByGovernorate(governorate);
  }, [governorate]);

  const nidAnalysis = React.useMemo(() => validateEgyptianNationalId(nationalId), [nationalId]);

  const handleNationalIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNationalId(val);
    if (val.length === 14) {
      const analysis = validateEgyptianNationalId(val);
      if (analysis.valid && analysis.governorate && analysis.governorate !== governorate) {
        setGovernorate(analysis.governorate);
        setCity('');
      }
      if (analysis.valid && analysis.dob && !dateOfBirth) {
        setDateOfBirth(analysis.dob);
      }
    }
  };


  // Student specific
  const [educationLevel, setEducationLevel] = useState(user?.educationLevel || studentProfile?.educationLevel || studentProfile?.education_level || '');
  const [schoolName, setSchoolName] = useState(user?.schoolName || studentProfile?.schoolName || studentProfile?.school_name || '');
  const [gradeLevel, setGradeLevel] = useState(user?.gradeLevel || studentProfile?.gradeLevel || studentProfile?.grade_level || '');
  const [educationalTrack, setEducationalTrack] = useState(user?.educationalTrack || studentProfile?.educationalTrack || studentProfile?.educational_track || '');
  const [secondLanguage, setSecondLanguage] = useState(user?.secondLanguage || studentProfile?.secondLanguage || studentProfile?.second_language || '');
  const [religion, setReligion] = useState(user?.religion || studentProfile?.religion || '');
  const [universityName, setUniversityName] = useState(user?.universityName || studentProfile?.universityName || studentProfile?.university_name || '');
  const [facultyName, setFacultyName] = useState(user?.facultyName || studentProfile?.facultyName || studentProfile?.faculty_name || '');

  // Guardian specific
  const [guardianName, setGuardianName] = useState(guardian?.fullName || guardian?.full_name || '');
  const [guardianPhone, setGuardianPhone] = useState(guardian?.phone || '');
  const [guardianRelationship, setGuardianRelationship] = useState(guardian?.relationship || 'father');
  const [guardianNationalId, setGuardianNationalId] = useState(guardian?.nationalId || guardian?.national_id || '');

  const [isSaving, setIsSaving] = useState(false);

  const availableGrades = React.useMemo(() => {
    return getGradesForStage(educationLevel);
  }, [educationLevel]);

  const availableTracks = React.useMemo(() => {
    return getTracksForGrade(educationLevel, gradeLevel);
  }, [educationLevel, gradeLevel]);

  const handleEducationLevelChange = (level: string) => {
    setEducationLevel(level);
    setGradeLevel('');
    setEducationalTrack('');
    if (level === 'university') {
      setSchoolName('');
    } else {
      setUniversityName('');
      setFacultyName('');
    }
  };

  const handleGradeLevelChange = (grade: string) => {
    setGradeLevel(grade);
    const tracks = getTracksForGrade(educationLevel, grade);
    if (tracks.length === 0) {
      setEducationalTrack('');
    } else if (educationalTrack && !tracks.some((t) => t.id === educationalTrack)) {
      setEducationalTrack(tracks[0]?.id || '');
    }
  };

  useEffect(() => {
    if (user) {
      const sp = (user as any).student_profile || (user as any).studentProfile || {};
      const gr = sp.guardian || {};
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setPhone(user.phone || '');
      setNationalId(user.nationalId || (user as any).national_id || '');
      setDateOfBirth(user.dateOfBirth || (user as any).date_of_birth || '');
      setGender(user.gender || '');
      setGovernorate(user.governorate || '');
      setCity(user.city || '');
      setBio(user.bio || '');
      setEducationLevel(user.educationLevel || sp.educationLevel || sp.education_level || '');
      setSchoolName(user.schoolName || sp.schoolName || sp.school_name || '');
      setGradeLevel(user.gradeLevel || sp.gradeLevel || sp.grade_level || '');
      setEducationalTrack(user.educationalTrack || sp.educationalTrack || sp.educational_track || '');
      setSecondLanguage(user.secondLanguage || sp.secondLanguage || sp.second_language || '');
      setReligion(user.religion || sp.religion || '');
      setUniversityName(user.universityName || sp.universityName || sp.university_name || '');
      setFacultyName(user.facultyName || sp.facultyName || sp.faculty_name || '');
      setGuardianName(gr.fullName || gr.full_name || '');
      setGuardianPhone(gr.phone || '');
      setGuardianRelationship(gr.relationship || 'father');
      setGuardianNationalId(gr.nationalId || gr.national_id || '');
    }
  }, [user]);

  // Password Modal states
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Notification Preferences states
  const [examAlerts, setExamAlerts] = useState(true);
  const [emailDigest, setEmailDigest] = useState(true);

  // Telegram states
  const [telegramInfo, setTelegramInfo] = useState<any>(null);
  const [isLoadingTelegram, setIsLoadingTelegram] = useState(false);

  const fetchTelegramInfo = async () => {
    setIsLoadingTelegram(true);
    try {
      const data = await apiGet('/notifications/telegram/link-info/');
      setTelegramInfo(data);
    } catch (err) {
      logger.error('Failed to fetch Telegram info', err);
    } finally {
      setIsLoadingTelegram(false);
    }
  };

  useEffect(() => {
    fetchTelegramInfo();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const payload: Record<string, any> = {
        first_name: firstName,
        last_name: lastName,
        phone,
        national_id: nationalId,
        date_of_birth: dateOfBirth,
        gender,
        governorate,
        city,
        bio,
      };

      if (user?.role === 'student') {
        payload.education_level = educationLevel;
        payload.school_name = schoolName;
        payload.grade_level = gradeLevel;
        payload.educational_track = educationalTrack;
        payload.second_language = secondLanguage;
        payload.religion = religion;
        payload.university_name = universityName;
        payload.faculty_name = facultyName;

        if (guardianName.trim() || guardianPhone.trim() || guardianNationalId.trim()) {
          if (!guardianName.trim() || !guardianPhone.trim()) {
            toast({
              title: 'بيانات ولي الأمر غير مكتملة',
              description: 'يرجى إدخال اسم ولي الأمر ورقم هاتفه معاً لحفظ بيانات ولي الأمر.',
              variant: 'destructive',
            });
            setIsSaving(false);
            return;
          }
          const phoneRegex = /^01[0125]\d{8}$/;
          if (!phoneRegex.test(guardianPhone.trim())) {
            toast({
              title: 'رقم هاتف ولي الأمر غير صحيح',
              description: 'يجب أن يكون رقم مصري مكون من 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015.',
              variant: 'destructive',
            });
            setIsSaving(false);
            return;
          }
          payload.guardian = {
            full_name: guardianName.trim(),
            phone: guardianPhone.trim(),
            relationship: guardianRelationship || 'father',
            national_id: guardianNationalId.trim() || null,
          };
        }
      }

      await updateUser(payload);

      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });

      toast({
        title: 'تم حفظ التغييرات بنجاح! ✨',
        description: 'تم تحديث بياناتك الأكاديمية والشخصية بنجاح.',
      });
    } catch (err: any) {
      toast({
        title: 'خطأ في الحفظ',
        description: err.message || err.detail || 'تعذر تحديث بيانات الحساب. تأكد من صحة البيانات.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

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
      toast({
        title: "فشل تحديث الصورة",
        description: err.response?.data?.message || err.message || "حدث خطأ أثناء رفع الصورة.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast({ title: 'تنبيه', description: 'يرجى إدخال كلمة المرور الحالية.', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: 'كلمة المرور ضعيفة', description: 'يجب أن تتكون من 8 أحرف أو أرقام على الأقل.', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'خطأ', description: 'كلمة المرور الجديدة غير متطابقة.', variant: 'destructive' });
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword({ old_password: currentPassword, new_password: newPassword });
      setIsPasswordModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: 'نجاح 🔒', description: 'تم تغيير كلمة المرور بنجاح.' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message || err.detail || 'تعذر تغيير كلمة المرور.', variant: 'destructive' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const InputField = ({ label, type = "text", value, onChange, required = false, disabled = false, placeholder = "", options = [], maxLength, icon: Icon }: any) => (
    <div className="w-full">
      <Label className="text-[13px] mb-2 font-medium text-foreground/90 flex items-center gap-1.5">
        {Icon && <Icon size={15} className="text-primary" />}
        <span>{label}</span> {required && <span className="text-destructive">*</span>}
      </Label>
      {type === 'select' ? (
        <Select
          value={value || undefined}
          onValueChange={(val) => {
            if (onChange) {
              onChange({ target: { value: val } });
            }
          }}
          disabled={disabled}
        >
          <SelectTrigger className="w-full h-[46px] p-3 rounded-xl border border-border/80 bg-card hover:border-primary/50 text-sm focus:ring-2 focus:ring-primary/20 transition-all duration-200 disabled:opacity-50">
            <SelectValue placeholder={placeholder || "اختر..."} />
          </SelectTrigger>
          <SelectContent dir="rtl" className="max-h-60">
            {options.map((opt: any) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : type === 'textarea' ? (
        <textarea
          value={value || ""}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          rows={3}
          className="w-full p-3 rounded-xl border border-border/80 bg-card hover:border-primary/50 outline-none text-sm focus:ring-2 focus:ring-primary/20 transition-all duration-200 resize-none"
          required={required}
        />
      ) : (
        <div className="relative">
          {Icon && (
            <Icon className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={16} />
          )}
          <input
            type={type}
            value={value || ""}
            onChange={onChange}
            disabled={disabled}
            placeholder={placeholder}
            maxLength={maxLength}
            className={`w-full p-3 rounded-xl border border-border/80 bg-card hover:border-primary/50 outline-none text-sm focus:ring-2 focus:ring-primary/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted/30 ${
              Icon ? "ps-9" : ""
            }`}
            required={required}
          />
        </div>
      )}
    </div>
  );

  return (
    <Layout>
      <div className="container mx-auto py-10 px-4 max-w-5xl space-y-8 animate-in-fade">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">الإعدادات</h1>
            <p className="text-sm text-muted-foreground mt-2 font-medium">إدارة معلوماتك الشخصية، التعليمية، الخصوصية والمظهر.</p>
          </div>
        </div>

        <Tabs defaultValue="account" className="flex flex-col md:flex-row gap-8">
          <TabsList className="flex flex-row md:flex-col justify-start h-auto bg-card/40 backdrop-blur-md border border-border/40 p-2.5 rounded-2xl gap-2 w-full md:w-64 overflow-x-auto shrink-0 shadow-sm">
            <TabsTrigger value="account" className="justify-start gap-3 rounded-xl text-[13px] font-semibold py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200">
              <UserIcon size={18} /> البيانات الأساسية
            </TabsTrigger>
            {user?.role === 'student' && (
              <TabsTrigger value="education" className="justify-start gap-3 rounded-xl text-[13px] font-semibold py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200">
                <GraduationCap size={18} /> المنهج وولي الأمر
              </TabsTrigger>
            )}
            <TabsTrigger value="notifications" className="justify-start gap-3 rounded-xl text-[13px] font-semibold py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200">
              <Bell size={18} /> التنبيهات والربط
            </TabsTrigger>
            <TabsTrigger value="privacy" className="justify-start gap-3 rounded-xl text-[13px] font-semibold py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200">
              <Shield size={18} /> الأمان والأجهزة
            </TabsTrigger>
            <TabsTrigger value="appearance" className="justify-start gap-3 rounded-xl text-[13px] font-semibold py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200">
              <Paintbrush size={18} /> المظهر
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-w-0">
            <form onSubmit={handleSaveProfile}>
              
              {/* Account Settings */}
              <TabsContent value="account" className="mt-0 focus-visible:outline-none">
                <div className="space-y-6">
                  <Card className="glass border-border/50 rounded-2xl shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/20 border-b border-border/30 pb-5">
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <UserIcon className="w-5 h-5 text-primary" /> المعلومات الشخصية
                      </CardTitle>
                      <CardDescription>البيانات الأساسية لحسابك في المنصة</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      {/* Avatar Upload Banner */}
                      <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-muted/30 border border-border/40">
                        <div className="relative group shrink-0">
                          <UserAvatar
                            src={user?.avatar}
                            name={`${firstName} ${lastName}`}
                            role={user?.role}
                            size="2xl"
                            className="shadow-md"
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploadingAvatar}
                            className="absolute bottom-0 end-0 p-2.5 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 active:scale-95 transition-all duration-200"
                            title="تغيير الصورة الشخصية"
                          >
                            {isUploadingAvatar ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Camera className="w-4 h-4" />
                            )}
                          </button>
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleAvatarChange}
                            accept="image/*"
                            className="hidden"
                          />
                        </div>
                        <div className="space-y-1.5 text-center sm:text-start flex-1">
                          <h4 className="font-bold text-base text-foreground">الصورة الشخصية</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            تدعم المنصة صيغ JPG, PNG, WEBP. يتم تحويل الصور تلقائياً لصيغة WebP فائقة الجودة لتقليل استهلاك البيانات وسرعة التحميل.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2 text-xs rounded-xl h-8 px-4"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploadingAvatar}
                          >
                            {isUploadingAvatar ? "جاري الرفع والمعالجة..." : "رفع صورة جديدة"}
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <InputField label="الاسم الأول" value={firstName} onChange={(e: any) => setFirstName(e.target.value)} required />
                        <InputField label="اسم العائلة" value={lastName} onChange={(e: any) => setLastName(e.target.value)} required />
                        <InputField label="البريد الإلكتروني" value={user?.email || ""} disabled type="email" />
                        <InputField label="رقم الهاتف" type="tel" value={phone} onChange={(e: any) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" required />
                        <div className="w-full space-y-1.5">
                          <Label className="text-[13px] font-medium text-foreground/90 block">الرقم القومي</Label>
                          <input
                            type="text"
                            maxLength={14}
                            value={nationalId}
                            onChange={handleNationalIdChange}
                            placeholder="14 رقم"
                            className="w-full p-3 rounded-xl border border-border/80 bg-card hover:border-primary/50 outline-none text-sm focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                          />
                          {nationalId.length === 14 && nidAnalysis.valid && (
                            <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                              ✓ رقم صحيح (المحافظة: {nidAnalysis.governorate})
                            </p>
                          )}
                        </div>
                        <InputField label="تاريخ الميلاد" type="date" value={dateOfBirth} onChange={(e: any) => setDateOfBirth(e.target.value)} />
                        <InputField 
                          label="النوع" 
                          type="select" 
                          value={gender} 
                          onChange={(e: any) => setGender(e.target.value)} 
                          options={[{label: 'ذكر', value: 'male'}, {label: 'أنثى', value: 'female'}]}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="glass border-border/50 rounded-2xl shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/20 border-b border-border/30 pb-5">
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-primary" /> الموقع الجغرافي والنبذة
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="w-full">
                          <Label className="text-[13px] mb-2 font-medium text-foreground/90 block">المحافظة</Label>
                          <Select
                            value={governorate || undefined}
                            onValueChange={(val) => {
                              setGovernorate(val);
                              setCity('');
                            }}
                          >
                            <SelectTrigger className="w-full h-[46px] p-3 rounded-xl border border-border/80 bg-card hover:border-primary/50 text-sm focus:ring-2 focus:ring-primary/20 transition-all duration-200">
                              <SelectValue placeholder="اختر المحافظة" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60" dir="rtl">
                              {EGYPTIAN_GOVERNORATES.map((gov: string) => (
                                <SelectItem key={gov} value={gov}>
                                  {gov}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="w-full">
                          <Label className="text-[13px] mb-2 font-medium text-foreground/90 block">المدينة / المركز / الحي</Label>
                          <Select
                            value={city || undefined}
                            onValueChange={setCity}
                            disabled={!governorate || availableCities.length === 0}
                          >
                            <SelectTrigger className="w-full h-[46px] p-3 rounded-xl border border-border/80 bg-card hover:border-primary/50 text-sm focus:ring-2 focus:ring-primary/20 transition-all duration-200 disabled:opacity-50">
                              <SelectValue placeholder={!governorate ? "يرجى اختيار المحافظة أولاً" : "اختر المدينة"} />
                            </SelectTrigger>
                            <SelectContent className="max-h-60" dir="rtl">
                              {availableCities.map((c: any) => (
                                <SelectItem key={c.id || c.nameAr} value={c.nameAr}>
                                  {c.nameAr}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <InputField label="نبذة عنك (Bio)" type="textarea" value={bio} onChange={(e: any) => setBio(e.target.value)} placeholder="اكتب نبذة مختصرة عنك..." />
                    </CardContent>
                  </Card>
                  
                  <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={isSaving} className="gradient-cta text-white h-12 px-8 rounded-xl font-bold shadow-md hover:shadow-lg transition-all duration-200">
                      {isSaving ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> جاري الحفظ...</> : 'حفظ التغييرات'}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Education & Guardian */}
              {user?.role === 'student' && (
                <TabsContent value="education" className="mt-0 focus-visible:outline-none">
                  <div className="space-y-6">
                    {/* Egyptian Curriculum Banner */}
                    <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-l from-primary/10 via-primary/5 to-transparent border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                      <div className="flex items-start gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0 text-primary shadow-xs">
                          <GraduationCap size={24} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-foreground">المنهج والمسار التعليمي المصري</h3>
                            <Badge variant="secondary" className="text-[10px] px-2.5 py-0.5 font-bold bg-primary/10 text-primary border-primary/25">
                              وزارة التربية والتعليم
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            تحديد مرحلتك وصفك الدراسي يخصص بنوك الأسئلة، يرشح المقررات الدراسية لصفك، ويرسل إشعارات الامتحانات المجدولة لصفك فور نشرها.
                          </p>
                        </div>
                      </div>
                      {educationLevel && (
                        <Badge variant="outline" className="bg-background text-primary border-primary/30 text-xs px-3.5 py-1.5 font-bold shrink-0 shadow-xs">
                          {STAGE_LABELS[educationLevel as keyof typeof STAGE_LABELS] || educationLevel}
                        </Badge>
                      )}
                    </div>

                    {/* Visual Educational Stages Selection */}
                    <Card className="glass border-border/60 rounded-3xl shadow-xs overflow-hidden">
                      <CardHeader className="bg-muted/20 border-b border-border/30 pb-4">
                        <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                          <BookOpen className="w-5 h-5 text-primary" /> المرحلة الدراسية المعتمدة
                        </CardTitle>
                        <CardDescription className="text-xs">اختر مرحلتك التعليمية الحالية لتخصيص محتوى المنصة</CardDescription>
                      </CardHeader>
                      <CardContent className="p-5 sm:p-6 space-y-6">
                        {/* Interactive Stage Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {[
                            {
                              id: 'primary',
                              label: 'المرحلة الابتدائية',
                              subtitle: 'الصفوف 1 - 6',
                              desc: 'التأسيس والمفاهيم ومنهج Connect والعلوم والرياضيات',
                              icon: School,
                              accent: 'from-blue-500/20 to-blue-600/5 text-blue-600 dark:text-blue-400',
                            },
                            {
                              id: 'prep',
                              label: 'المرحلة الإعدادية',
                              subtitle: 'الصفوف 1 - 3 إعدادي',
                              desc: 'الشهادة الإعدادية وتأسيس اللغات والعلوم والدراسات',
                              icon: Compass,
                              accent: 'from-emerald-500/20 to-emerald-600/5 text-emerald-600 dark:text-emerald-400',
                            },
                            {
                              id: 'secondary',
                              label: 'المرحلة الثانوية العامة',
                              subtitle: 'الصفوف 1 - 3 ثانوي',
                              desc: 'الثانوية العامة وشعب علمي علوم وعلمي رياضة وأدبي',
                              icon: GraduationCap,
                              accent: 'from-purple-500/20 to-purple-600/5 text-purple-600 dark:text-purple-400',
                            },
                            {
                              id: 'baccalaureate',
                              label: 'نظام البكالوريا المصرية',
                              subtitle: 'التمهيدي والمسارات',
                              desc: 'النظام الحديث ومسارات الطب والهندسة وإدارة الأعمال',
                              icon: Award,
                              accent: 'from-amber-500/20 to-amber-600/5 text-amber-600 dark:text-amber-400',
                            },
                            {
                              id: 'university',
                              label: 'المرحلة الجامعية والمعاهد',
                              subtitle: 'التعليم الأكاديمي',
                              desc: 'الكليات والمعاهد التخصصية والشهادات العليا',
                              icon: Building2,
                              accent: 'from-rose-500/20 to-rose-600/5 text-rose-600 dark:text-rose-400',
                            },
                          ].map((stage) => {
                            const isSelected = educationLevel === stage.id;
                            const StageIcon = stage.icon;
                            return (
                              <button
                                key={stage.id}
                                type="button"
                                onClick={() => handleEducationLevelChange(stage.id)}
                                className={`p-4 rounded-2xl border text-start transition-all duration-200 cursor-pointer flex flex-col justify-between relative group ${
                                  isSelected
                                    ? "border-primary bg-primary/5 ring-2 ring-primary/25 shadow-sm"
                                    : "border-border/70 bg-card hover:border-primary/40 hover:bg-muted/30"
                                }`}
                              >
                                <div className="flex items-start justify-between w-full mb-2.5">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${stage.accent} shadow-2xs`}>
                                    <StageIcon size={20} />
                                  </div>
                                  {isSelected ? (
                                    <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 gap-1 font-bold">
                                      <CheckCircle2 size={12} /> محدد
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 text-muted-foreground border-border">
                                      {stage.subtitle}
                                    </Badge>
                                  )}
                                </div>
                                <div>
                                  <h4 className="font-bold text-sm text-foreground mb-1">{stage.label}</h4>
                                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{stage.desc}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Grade Level Selection Chips */}
                        {educationLevel !== 'university' && availableGrades.length > 0 && (
                          <div className="space-y-3 pt-2 border-t border-border/40">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-bold text-foreground flex items-center gap-2">
                                <span>الصف الدراسي المقيد به</span>
                                <span className="text-destructive">*</span>
                              </Label>
                              {gradeLevel && (
                                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30 font-semibold">
                                  {GRADE_LABELS[gradeLevel as keyof typeof GRADE_LABELS] || gradeLevel}
                                </Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                              {availableGrades.map((g) => {
                                const isSelected = gradeLevel === g.id;
                                return (
                                  <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => handleGradeLevelChange(g.id)}
                                    className={`p-3 rounded-2xl border text-sm font-semibold flex items-center justify-between transition-all duration-200 text-start cursor-pointer ${
                                      isSelected
                                        ? "bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/20 scale-[1.01]"
                                        : "bg-card border-border/80 text-foreground hover:border-primary/50 hover:bg-muted/30"
                                    }`}
                                  >
                                    <span className="truncate">{g.name}</span>
                                    {isSelected ? (
                                      <CheckCircle2 size={16} className="text-primary-foreground shrink-0 ms-2" />
                                    ) : (
                                      <div className="w-4 h-4 rounded-full border border-border shrink-0 ms-2" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Track Selection Pills */}
                        {availableTracks.length > 0 && (
                          <div className="space-y-3 pt-2 border-t border-border/40 animate-in-fade">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-bold text-foreground flex items-center gap-2">
                                <span>الشعبة / المسار التخصصي الأكاديمي</span>
                                <span className="text-destructive">*</span>
                              </Label>
                              {educationalTrack && (
                                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30 font-semibold">
                                  {TRACK_LABELS[educationalTrack] || educationalTrack}
                                </Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                              {availableTracks.map((t) => {
                                const isSelected = educationalTrack === t.id;
                                return (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setEducationalTrack(t.id)}
                                    className={`p-4 rounded-2xl border text-start transition-all duration-200 cursor-pointer ${
                                      isSelected
                                        ? "bg-primary/10 border-primary text-foreground ring-2 ring-primary/30 shadow-sm"
                                        : "bg-card border-border/80 text-foreground hover:border-primary/50 hover:bg-muted/20"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="font-bold text-sm text-foreground">{t.name}</span>
                                      {isSelected && <CheckCircle2 size={16} className="text-primary shrink-0" />}
                                    </div>
                                    {t.description && (
                                      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                                        {t.description}
                                      </p>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Institution, Language & Religion Inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-border/40">
                          {educationLevel === 'university' ? (
                            <>
                              <InputField
                                label="اسم الجامعة / الأكاديمية"
                                icon={Building2}
                                value={universityName}
                                onChange={(e: any) => setUniversityName(e.target.value)}
                                placeholder="مثال: جامعة القاهرة"
                                required
                              />
                              <InputField
                                label="الكلية / المعهد"
                                icon={School}
                                value={facultyName}
                                onChange={(e: any) => setFacultyName(e.target.value)}
                                placeholder="مثال: كلية الهندسة"
                                required
                              />
                            </>
                          ) : (
                            <InputField
                              label="اسم المدرسة"
                              icon={School}
                              value={schoolName}
                              onChange={(e: any) => setSchoolName(e.target.value)}
                              placeholder="مثال: مدرسة المتفوقين الثانوية"
                            />
                          )}

                          <InputField
                            label="اللغة الأجنبية الثانية"
                            icon={Globe}
                            type="select"
                            value={secondLanguage}
                            onChange={(e: any) => setSecondLanguage(e.target.value)}
                            options={[
                              { label: 'بدون لغة ثانية / لم يحدد بعد', value: '' },
                              { label: 'اللغة الفرنسية', value: 'french' },
                              { label: 'اللغة الألمانية', value: 'german' },
                              { label: 'اللغة الإيطالية', value: 'italian' },
                              { label: 'اللغة الإسبانية', value: 'spanish' },
                            ]}
                            placeholder="اختر اللغة الثانية..."
                          />

                          <InputField
                            label="التربية الدينية"
                            icon={Heart}
                            type="select"
                            value={religion}
                            onChange={(e: any) => setReligion(e.target.value)}
                            options={[
                              { label: 'لم يحدد', value: '' },
                              { label: 'التربية الدينية الإسلامية', value: 'islamic' },
                              { label: 'التربية الدينية المسيحية', value: 'christian' },
                            ]}
                            placeholder="اختر المنهج الديني..."
                          />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Guardian Information Card */}
                    <Card className="glass border-border/60 rounded-3xl shadow-xs overflow-hidden">
                      <CardHeader className="bg-muted/20 border-b border-border/30 pb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                              <Users className="w-5 h-5 text-primary" /> بيانات ولي الأمر والمتابعة الأسرية
                            </CardTitle>
                            <CardDescription className="text-xs mt-0.5">
                              ربط ولي الأمر لاستقبال تقارير الدرجات والمتابعة الدورية عبر تيليجرام والواتساب
                            </CardDescription>
                          </div>
                          {telegramInfo?.isLinked && (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs gap-1 font-bold">
                              <CheckCircle2 size={12} /> متصل بتيليجرام
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="p-5 sm:p-6 space-y-5">
                        {/* Guardian Relationship Pills */}
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-foreground">صلة القرابة</Label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { id: 'father', label: 'أب' },
                              { id: 'mother', label: 'أم' },
                              { id: 'guardian', label: 'ولي أمر / وصي آخر' },
                            ].map((rel) => {
                              const isSelected = guardianRelationship === rel.id;
                              return (
                                <button
                                  key={rel.id}
                                  type="button"
                                  onClick={() => setGuardianRelationship(rel.id)}
                                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                      : "bg-card border-border/80 text-muted-foreground hover:text-foreground hover:border-primary/40"
                                  }`}
                                >
                                  {rel.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <InputField
                            label="اسم ولي الأمر الكامل"
                            icon={UserIcon}
                            value={guardianName}
                            onChange={(e: any) => setGuardianName(e.target.value)}
                            placeholder="الاسم الثلاثي أو الرباعي"
                          />
                          <InputField
                            label="رقم هاتف ولي الأمر"
                            icon={Phone}
                            type="tel"
                            value={guardianPhone}
                            onChange={(e: any) => setGuardianPhone(e.target.value)}
                            placeholder="01xxxxxxxxx"
                          />
                          <div className="w-full space-y-1.5 md:col-span-2">
                            <Label className="text-[13px] font-medium text-foreground/90 flex items-center gap-1.5">
                              <Shield size={15} className="text-primary" />
                              <span>الرقم القومي لولي الأمر (اختياري)</span>
                            </Label>
                            <input
                              type="text"
                              value={guardianNationalId}
                              onChange={(e) => setGuardianNationalId(e.target.value)}
                              placeholder="14 رقم للتحقق الرسمي والربط الدقيق"
                              maxLength={14}
                              className="w-full p-3 rounded-xl border border-border/80 bg-card hover:border-primary/50 outline-none text-sm focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                            />
                            {guardianNationalId.length === 14 && validateEgyptianNationalId(guardianNationalId).valid && (
                              <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                                <CheckCircle2 size={13} /> رقم قومي مصري صالح
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="flex justify-end pt-2">
                      <Button type="submit" disabled={isSaving} className="gradient-cta text-white h-12 px-8 rounded-xl font-bold shadow-md hover:shadow-lg transition-all duration-200">
                        {isSaving ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> جاري الحفظ...</> : 'حفظ التغييرات'}
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              )}
            </form>

            {/* Notifications */}
            <TabsContent value="notifications" className="mt-0 focus-visible:outline-none">
              <div className="space-y-6">
                <Card className="glass border-border/50 rounded-2xl shadow-sm overflow-hidden">
                  <CardHeader className="bg-muted/20 border-b border-border/30 pb-5">
                    <CardTitle className="text-lg font-bold">تفضيلات الإشعارات</CardTitle>
                    <CardDescription>التحكم في التنبيهات التي ترغب في تلقيها</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-1">
                    <div className="flex items-center justify-between py-4 border-b border-border/40">
                      <div>
                        <p className="font-semibold text-foreground text-sm">تنبيهات المواعيد والاختبارات الحاسمة</p>
                        <p className="text-muted-foreground text-xs mt-1">إرسال تنبيه فور اقتراب موعد تسليم التكليف أو الاختبار</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={examAlerts}
                        onChange={(e) => {
                          setExamAlerts(e.target.checked);
                          toast({ title: 'تم التحديث', description: 'تم حفظ تفضيل إشعارات الاختبارات.' });
                        }}
                        className="w-5 h-5 rounded-md border-border accent-primary cursor-pointer transition-all"
                      />
                    </div>
                    <div className="flex items-center justify-between py-4 border-b border-border/40">
                      <div>
                        <p className="font-semibold text-foreground text-sm">إشعارات البريد الإلكتروني الأسبوعية</p>
                        <p className="text-muted-foreground text-xs mt-1">تلقي ملخص النشاط الأسبوعي والتقدم الدراسي</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={emailDigest}
                        onChange={(e) => {
                          setEmailDigest(e.target.checked);
                          toast({ title: 'تم التحديث', description: 'تم حفظ تفضيل البريد الإلكتروني.' });
                        }}
                        className="w-5 h-5 rounded-md border-border accent-primary cursor-pointer transition-all"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass border-border/50 rounded-2xl shadow-sm overflow-hidden">
                  <CardHeader className="bg-sky-50 dark:bg-sky-950/20 border-b border-sky-100 dark:border-sky-900/50 pb-5">
                    <CardTitle className="text-lg font-bold flex items-center gap-2 text-sky-700 dark:text-sky-400">
                      <SendHorizontal className="w-5 h-5" />
                      ربط حساب تيليجرام لولي الأمر
                    </CardTitle>
                    <CardDescription className="text-sky-600/80 dark:text-sky-400/80">اربط حسابك لاستقبال التقارير الأسبوعية والإشعارات الهامة فوراً</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    {isLoadingTelegram ? (
                      <div className="flex items-center justify-center py-6 gap-3 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin" /> جاري التحميل...
                      </div>
                    ) : telegramInfo?.isLinked ? (
                      <div className="p-5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400 mb-1.5 text-base">
                            <CheckCircle className="w-5 h-5" />
                            الحساب مرتبط بنجاح
                          </div>
                          <p className="text-emerald-600/90 dark:text-emerald-400/80 text-sm">
                            تم الربط بواسطة: <strong className="font-semibold">{telegramInfo.linkedParentName || 'ولي الأمر'}</strong>
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={fetchTelegramInfo} className="gap-2 shrink-0 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border-emerald-300 dark:border-emerald-800">
                          <RefreshCw className="w-4 h-4" /> تحديث الحالة
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex gap-3 text-sky-800 dark:text-sky-300 bg-sky-50/50 dark:bg-sky-900/10 p-4 rounded-xl border border-sky-100 dark:border-sky-900/30">
                          <Info className="w-5 h-5 shrink-0 mt-0.5" />
                          <p className="text-sm leading-relaxed font-medium">
                            لم يتم ربط حساب تيليجرام بعد. يرجى إرسال الرابط التالي لولي الأمر للربط ليتمكن من متابعة مستواك الدراسي والتقارير الدورية بانتظام.
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                          <div className="relative w-full">
                            <input 
                              readOnly 
                              value={telegramInfo?.botDirectLink || ''} 
                              onClick={(e) => (e.target as HTMLInputElement).select()}
                              placeholder={isLoadingTelegram ? "جاري جلب الرابط..." : (telegramInfo?.botDirectLink ? "" : "الرابط غير متوفر حالياً، اضغط تحديث")}
                              className="w-full p-3.5 pl-12 rounded-xl border border-border/80 bg-background text-left dir-ltr text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-copy" 
                            />
                            {telegramInfo?.botDirectLink && (
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(telegramInfo.botDirectLink);
                                  toast({ title: 'تم النسخ', description: 'تم نسخ الرابط بنجاح' });
                                }}
                                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                                title="نسخ الرابط"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <Button
                            onClick={() => {
                              if (telegramInfo?.botDirectLink) {
                                window.open(telegramInfo.botDirectLink, '_blank');
                              }
                            }}
                            disabled={!telegramInfo?.botDirectLink}
                            className="w-full sm:w-auto bg-[#0088cc] hover:bg-[#0077b3] text-white gap-2 rounded-xl h-12 px-6 shrink-0 shadow-sm transition-all disabled:opacity-50"
                          >
                            <SendHorizontal className="w-5 h-5" />
                            فتح في تيليجرام
                          </Button>
                        </div>
                        <div className="flex justify-end pt-2">
                           <Button variant="ghost" size="sm" onClick={fetchTelegramInfo} className="gap-2 text-muted-foreground hover:text-foreground rounded-xl">
                             <RefreshCw className="w-4 h-4" /> تحديث الحالة
                           </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Privacy & Security */}
            <TabsContent value="privacy" className="mt-0 focus-visible:outline-none">
              <Card className="glass border-border/50 rounded-2xl shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/20 border-b border-border/30 pb-5">
                  <CardTitle className="text-lg font-bold">الأمان والجلسات النشطة</CardTitle>
                  <CardDescription>إدارة كلمة المرور والأجهزة المسجلة في حسابك</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="p-4 rounded-xl bg-card border border-border/60 flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-full bg-primary/10 text-primary">
                        <Smartphone className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-sm mb-0.5">الجلسة الحالية</p>
                        <p className="text-xs text-muted-foreground">متصفح ويب • IP: 127.0.0.1</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="px-3 py-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/30 rounded-full font-semibold">نشط الآن</Badge>
                  </div>
                  
                  <div className="pt-2">
                    <h3 className="text-sm font-bold mb-3">حماية الحساب</h3>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsPasswordModalOpen(true)}
                      className="h-12 px-6 rounded-xl gap-2 hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-all font-medium"
                    >
                      <KeyRound size={18} />
                      تغيير كلمة المرور
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Appearance */}
            <TabsContent value="appearance" className="mt-0 focus-visible:outline-none">
              <Card className="glass border-border/50 rounded-2xl shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/20 border-b border-border/30 pb-5">
                  <CardTitle className="text-lg font-bold">مظهر التطبيق والسمة</CardTitle>
                  <CardDescription>تخصيص الألوان والسمة الداكنة أو الفاتحة</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between p-5 rounded-xl bg-card border border-border/60 shadow-xs">
                    <div>
                      <p className="font-bold text-foreground text-sm mb-1">الوضع الليلي / الفاتح</p>
                      <p className="text-muted-foreground text-xs">اختر المظهر المريح لعينيك أثناء الدراسة والمراجعة</p>
                    </div>
                    <ThemeToggle />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Password Change Dialog Modal */}
      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent size="md" dir="rtl" className="p-0 overflow-hidden dir-rtl">
          <DialogHeader className="p-5 sm:p-6 bg-muted/20 border-b border-border/30 shrink-0">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <KeyRound size={22} className="text-primary" />
              تغيير كلمة المرور
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1.5">
              يرجى إدخال كلمة المرور الحالية ثم إضافة كلمة المرور الجديدة وتأكيدها.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleChangePassword} className="flex-1 overflow-y-auto overscroll-contain space-y-5 p-5 sm:p-6 custom-scrollbar">
            <InputField label="كلمة المرور الحالية" type="password" value={currentPassword} onChange={(e: any) => setCurrentPassword(e.target.value)} required />
            <InputField label="كلمة المرور الجديدة" type="password" value={newPassword} onChange={(e: any) => setNewPassword(e.target.value)} required />
            <InputField label="تأكيد كلمة المرور الجديدة" type="password" value={confirmPassword} onChange={(e: any) => setConfirmPassword(e.target.value)} required />

            <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-3 pt-4 border-t border-border/40">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPasswordModalOpen(false)}
                className="h-11 px-6 rounded-xl w-full sm:w-auto"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={isChangingPassword}
                className="gradient-cta text-white h-11 px-6 rounded-xl font-bold transition-all w-full sm:w-auto"
              >
                {isChangingPassword ? <><Loader2 size={18} className="animate-spin ml-2" /> جاري التحديث...</> : 'تحديث كلمة المرور'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Settings;
