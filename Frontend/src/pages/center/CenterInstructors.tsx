import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GraduationCap,
  Search,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Sparkles,
  Lock,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import http from "@/lib/http";

interface CenterInstructorItem {
  id: number;
  instructor_id: number;
  full_name: string;
  email: string;
  phone: string;
  teacher_uid: string;
  specialization: string;
  qualification: string;
  subject: string;
  student_quota: number;
  is_active: boolean;
  is_approved: boolean;
  joined_at: string;
  active_students_count: number;
}

export default function CenterInstructors() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedInstructor, setSelectedInstructor] = useState<CenterInstructorItem | null>(null);

  // Existing teacher form state
  const [existingUid, setExistingUid] = useState("");
  const [existingSubject, setExistingSubject] = useState("");
  const [existingQuota, setExistingQuota] = useState<number>(30);

  // New teacher form state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newNid, setNewNid] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newQuota, setNewQuota] = useState<number>(30);

  // Newly created credentials state
  const [newCredentials, setNewCredentials] = useState<{ name: string; email: string; tempPass: string; uid: string } | null>(null);

  // Fetch instructors query
  const { data: instructors = [], isLoading, isError, refetch } = useQuery<CenterInstructorItem[]>({
    queryKey: ["center-instructors"],
    queryFn: async () => {
      const res = await http.get("/accounts/center/instructors/");
      return res.data;
    },
  });

  // Link existing teacher mutation
  const linkExistingMutation = useMutation({
    mutationFn: async (payload: { teacher_uid: string; subject: string; student_quota: number }) => {
      const res = await http.post("/accounts/center/instructors/link/", payload);
      return res.data;
    },
    onSuccess: () => {
      toast({ title: "تم ربط المعلم بنجاح", description: "تمت إضافة المعلم إلى سنترك التعليمي." });
      queryClient.invalidateQueries({ queryKey: ["center-instructors"] });
      setIsAddModalOpen(false);
      setExistingUid("");
      setExistingSubject("");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || "فشل ربط المعلم. تأكد من كود المعلم UID.";
      toast({ title: "خطأ", description: msg, variant: "destructive" });
    },
  });

  // Provision new teacher mutation
  const provisionNewMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await http.post("/accounts/center/instructors/create-and-link/", payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast({ title: "تم إنشاء الحساب بنجاح", description: "تم توليد حساب المعلم وربطه بالسنتر." });
      setNewCredentials({
        name: data.email,
        email: data.email,
        tempPass: data.temporary_password,
        uid: data.teacher_uid,
      });
      queryClient.invalidateQueries({ queryKey: ["center-instructors"] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || "فشل إنشاء حساب المعلم.";
      toast({ title: "خطأ", description: msg, variant: "destructive" });
    },
  });

  // Edit instructor mutation
  const editInstructorMutation = useMutation({
    mutationFn: async ({ id, subject, student_quota }: { id: number; subject: string; student_quota: number }) => {
      const res = await http.patch(`/accounts/center/instructors/${id}/`, {
        subject,
        student_quota,
      });
      return res.data;
    },
    onSuccess: () => {
      toast({ title: "تم التعديل", description: "تم تحديث بيانات وكوتة المعلم بنجاح." });
      queryClient.invalidateQueries({ queryKey: ["center-instructors"] });
      setIsEditModalOpen(false);
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل تحديث بيانات المعلم.", variant: "destructive" });
    },
  });

  // Unlink instructor mutation
  const unlinkMutation = useMutation({
    mutationFn: async (id: number) => {
      await http.delete(`/accounts/center/instructors/${id}/`);
    },
    onSuccess: () => {
      toast({ title: "تم فك الارتباط", description: "تم إلغاء ربط المعلم بالسنتر." });
      queryClient.invalidateQueries({ queryKey: ["center-instructors"] });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل فك ارتباط المعلم.", variant: "destructive" });
    },
  });

  const filtered = instructors.filter(
    (i) =>
      i.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.teacher_uid?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalQuota = instructors.reduce((acc, curr) => acc + (curr.student_quota || 0), 0);

  return (
    <div className="space-y-6 dir-rtl" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-950/80 via-slate-900 to-indigo-950/80 p-6 rounded-2xl border border-blue-800/40 shadow-lg text-white">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/15 text-primary">
                <GraduationCap size={24} />
              </div>
              <h1 className="text-2xl font-black text-foreground">إدارة مدرسي ودكاترة السنتر</h1>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              متابعة هيئة التدريس، تخصيص كوتة الطلاب لكل مادة، وإصدار المعرفات الفريدة (Teacher UIDs).
            </p>
          </div>

          <Button
            onClick={() => {
              setNewCredentials(null);
              setIsAddModalOpen(true);
            }}
            className="gradient-cta text-white font-bold rounded-xl gap-2 shadow-xs"
          >
            <Plus size={16} />
            <span>إضافة / ربط معلم جديد</span>
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="rounded-2xl border shadow-2xs">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground">إجمالي المعلمين المعتمدين</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-black text-foreground font-mono">{instructors.length} معلم</div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border shadow-2xs">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground">إجمالي الكوتة المخصصة للطلاب</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-black text-primary font-mono">{totalQuota} مقعد</div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border shadow-2xs">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground">المعلمون النشطون</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-black text-emerald-600 font-mono">
                {instructors.filter((i) => i.is_active).length} نشط
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="البحث باسم المعلم، البريد، المادة، أو كود المعلم (Teacher UID)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10 rounded-xl"
            />
          </div>
          <Button variant="outline" onClick={() => refetch()} className="rounded-xl gap-1.5 text-xs">
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            <span>تحديث</span>
          </Button>
        </div>

        {/* Table */}
        <Card className="rounded-2xl border overflow-hidden shadow-xs">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">جاري تحميل قائمة المعلمين...</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground space-y-2">
                <GraduationCap size={40} className="mx-auto text-muted-foreground/40" />
                <p className="text-sm font-bold">لم يتم العثور على معلمين مرتبطين بالسنتر.</p>
                <p className="text-xs">اضغط على زر "إضافة / ربط معلم جديد" لإضافة أول معلم.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-right font-bold text-xs">المعلم</TableHead>
                      <TableHead className="text-right font-bold text-xs">كود المعلم (Teacher UID)</TableHead>
                      <TableHead className="text-right font-bold text-xs">المادة التدريسية</TableHead>
                      <TableHead className="text-right font-bold text-xs">كوتة الطلاب المخصصة</TableHead>
                      <TableHead className="text-right font-bold text-xs">الحالة</TableHead>
                      <TableHead className="text-center font-bold text-xs">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((inst) => (
                      <TableRow key={inst.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-bold text-sm">
                          <div>
                            <div className="text-foreground">{inst.full_name}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">{inst.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs font-bold bg-primary/5 text-primary border-primary/20">
                            {inst.teacher_uid || "غير متوفر"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-foreground">
                          {inst.subject || inst.specialization || "عام"}
                        </TableCell>
                        <TableCell className="text-xs font-mono font-bold">
                          {inst.student_quota > 0 ? (
                            <span className="text-primary">{inst.student_quota} طالب</span>
                          ) : (
                            <span className="text-muted-foreground">سعة مشتركة</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={inst.is_active ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}>
                            {inst.is_active ? "نشط" : "معطل"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setSelectedInstructor(inst);
                                setIsEditModalOpen(true);
                              }}
                              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                            >
                              <Edit2 size={14} />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                if (window.confirm(`هل أنت متأكد من فك ارتباط المعلم (${inst.full_name}) بالسنتر؟`)) {
                                  unlinkMutation.mutate(inst.id);
                                }
                              }}
                              className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ================= MODAL: ADD / LINK INSTRUCTOR ================= */}
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogContent className="max-w-lg dir-rtl text-right p-6 rounded-3xl" dir="rtl">
            <DialogHeader className="space-y-1 text-right">
              <DialogTitle className="text-xl font-bold">إضافة معلم إلى هيئة التدريس بالسنتر</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                اختر ربط حساب مسجل مسبقاً بكود المعلم الفريد أو إنشاء حساب فوري لمعلم جديد.
              </DialogDescription>
            </DialogHeader>

            {newCredentials ? (
              <div className="space-y-4 my-3 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={28} />
                </div>
                <h3 className="font-bold text-sm text-foreground">تم إنشاء حساب المعلم بنجاح!</h3>
                <div className="p-4 rounded-2xl bg-muted/60 border text-right font-mono text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">كود المعلم:</span>
                    <span className="font-bold text-primary">{newCredentials.uid}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">البريد الإلكتروني:</span>
                    <span>{newCredentials.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">كلمة المرور المؤقتة:</span>
                    <span className="text-amber-600 font-bold">{newCredentials.tempPass}</span>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `مرحباً بك في السنتر!\nبيانات حسابك في EduSmart:\nالبريد: ${newCredentials.email}\nكلمة المرور المؤقتة: ${newCredentials.tempPass}\nكود المعلم: ${newCredentials.uid}`
                    );
                    toast({ title: "تم النسخ", description: "تم نسخ بيانات الدخول إلى الحافظة." });
                  }}
                  variant="outline"
                  className="w-full rounded-xl gap-2 font-bold text-xs"
                >
                  <Copy size={14} />
                  <span>نسخ بيانات الدخول لمشاركتها مع المعلم</span>
                </Button>

                <Button onClick={() => setIsAddModalOpen(false)} className="w-full gradient-cta text-white font-bold rounded-xl">
                  تم الانتهاء
                </Button>
              </div>
            ) : (
              <Tabs defaultValue="link_existing" className="w-full mt-2">
                <TabsList className="grid grid-cols-2 rounded-xl mb-4">
                  <TabsTrigger value="link_existing" className="text-xs font-bold">
                    معلم مسجل (Teacher UID)
                  </TabsTrigger>
                  <TabsTrigger value="create_new" className="text-xs font-bold">
                    معلم جديد (حساب فوري)
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1: Link Existing */}
                <TabsContent value="link_existing" className="space-y-3.5">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-muted-foreground">كود المعلم الفريد (Teacher UID) *</Label>
                    <Input
                      placeholder="مثال: TCH-8B291"
                      value={existingUid}
                      onChange={(e) => setExistingUid(e.target.value)}
                      className="rounded-xl font-mono uppercase text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      * يظهر كود المعلم في ملفه الشخصي أو لوحة تحكم المعلم.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-muted-foreground">المادة التدريسية</Label>
                      <Input
                        placeholder="فيزياء، كيمياء..."
                        value={existingSubject}
                        onChange={(e) => setExistingSubject(e.target.value)}
                        className="rounded-xl text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-muted-foreground">كوتة الطلاب المخصصة</Label>
                      <Input
                        type="number"
                        min={0}
                        value={existingQuota}
                        onChange={(e) => setExistingQuota(Number(e.target.value))}
                        className="rounded-xl text-sm font-mono"
                      />
                    </div>
                  </div>

                  <Button
                    type="button"
                    disabled={linkExistingMutation.isPending}
                    onClick={() =>
                      linkExistingMutation.mutate({
                        teacher_uid: existingUid.trim().toUpperCase(),
                        subject: existingSubject.trim(),
                        student_quota: existingQuota,
                      })
                    }
                    className="w-full gradient-cta text-white font-bold rounded-xl gap-2 mt-2"
                  >
                    <UserCheck size={16} />
                    <span>{linkExistingMutation.isPending ? "جاري الربط..." : "تأكيد ربط المعلم"}</span>
                  </Button>
                </TabsContent>

                {/* Tab 2: Create New */}
                <TabsContent value="create_new" className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-muted-foreground">الاسم بالكامل *</Label>
                    <Input
                      placeholder="أحمد محمد حسن"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="rounded-xl text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-muted-foreground">البريد الإلكتروني *</Label>
                      <Input
                        type="email"
                        placeholder="teacher@example.com"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className="rounded-xl text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-muted-foreground">رقم الهاتف</Label>
                      <Input
                        placeholder="010XXXXXXXX"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        className="rounded-xl text-sm font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-muted-foreground">المادة التدريسية</Label>
                      <Input
                        placeholder="رياضيات، لغة عربية..."
                        value={newSubject}
                        onChange={(e) => setNewSubject(e.target.value)}
                        className="rounded-xl text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-muted-foreground">كوتة الطلاب</Label>
                      <Input
                        type="number"
                        min={0}
                        value={newQuota}
                        onChange={(e) => setNewQuota(Number(e.target.value))}
                        className="rounded-xl text-sm font-mono"
                      />
                    </div>
                  </div>

                  <Button
                    type="button"
                    disabled={provisionNewMutation.isPending}
                    onClick={() =>
                      provisionNewMutation.mutate({
                        full_name: newName.trim(),
                        email: newEmail.trim().toLowerCase(),
                        phone: newPhone.trim(),
                        national_id: newNid.trim(),
                        subject: newSubject.trim(),
                        student_quota: newQuota,
                      })
                    }
                    className="w-full gradient-cta text-white font-bold rounded-xl gap-2 mt-2"
                  >
                    <Plus size={16} />
                    <span>{provisionNewMutation.isPending ? "جاري إنشاء الحساب..." : "إنشاء حساب المعلم وربطه"}</span>
                  </Button>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        {/* ================= MODAL: EDIT INSTRUCTOR ================= */}
        {selectedInstructor && (
          <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
            <DialogContent className="max-w-md dir-rtl text-right p-6 rounded-3xl" dir="rtl">
              <DialogHeader className="text-right space-y-1">
                <DialogTitle className="text-lg font-bold">تعديل بيانات {selectedInstructor.full_name}</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  تعديل المادة المسندة وكوتة الطلاب المخصصة للمعلم داخل السنتر.
                </DialogDescription>
              </DialogHeader>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  editInstructorMutation.mutate({
                    id: selectedInstructor.id,
                    subject: selectedInstructor.subject,
                    student_quota: selectedInstructor.student_quota,
                  });
                }}
                className="space-y-3.5 my-2"
              >
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-muted-foreground">المادة التدريسية</Label>
                  <Input
                    value={selectedInstructor.subject}
                    onChange={(e) =>
                      setSelectedInstructor({ ...selectedInstructor, subject: e.target.value })
                    }
                    className="rounded-xl text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-muted-foreground">كوتة الطلاب المخصصة (0 لسعة مشتركة)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={selectedInstructor.student_quota}
                    onChange={(e) =>
                      setSelectedInstructor({
                        ...selectedInstructor,
                        student_quota: Number(e.target.value),
                      })
                    }
                    className="rounded-xl text-sm font-mono"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="submit"
                    disabled={editInstructorMutation.isPending}
                    className="flex-1 gradient-cta text-white font-bold rounded-xl"
                  >
                    {editInstructorMutation.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditModalOpen(false)}
                    className="rounded-xl"
                  >
                    إلغاء
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
  );
}
