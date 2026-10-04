import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";


import { superAdminGet, superAdminPost, superAdminDelete } from "@/lib/superAdminHttp";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { PageLoading } from "@/components/common/LoadingState";
import {
  Search,
  UserCheck,
  UserX,
  Shield,
  KeyRound,
  Trash2,
  Eye,
  UserCog,
  BookOpen,
  CreditCard,
  History,
  AlertTriangle,
  Mail,
  Calendar,
} from "lucide-react";

export interface ManagedUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  fullName: string;
  role: "student" | "instructor" | "admin" | "super_admin";
  phone: string;
  avatar?: string;
  isActive: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  lastLogin?: string;
  dateJoined: string;
}

export interface UserDetailPayload extends ManagedUser {
  bio?: string;
  coursesEnrolled: Array<{ id: number; title: string; status: string; price: string; categoryName: string; created_at: string }>;
  coursesTaught: Array<{ id: number; title: string; status: string; price: string; categoryName: string; created_at: string }>;
  paymentHistory: Array<{ id: number; order_number: string; amount: string; status: string; payment_method: string; courseTitle: string; created_at: string }>;
  recentAuditLogs: Array<{ id: number; action_type: string; target_model: string; target_id: string; ip_address: string; created_at: string }>;
}

export default function UserManagementPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [roleTab, setRoleTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);

  // Modals state
  const [viewDetailId, setViewDetailId] = useState<number | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<ManagedUser | null>(null);
  const [roleChangeTarget, setRoleChangeTarget] = useState<ManagedUser | null>(null);
  const [newRole, setNewRole] = useState<string>("student");
  const [resetPassTarget, setResetPassTarget] = useState<ManagedUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [confirmEmailInput, setConfirmEmailInput] = useState("");

  // Fetch user list
  const { data: usersData, isLoading } = useQuery({
    queryKey: ["super-admin-users", roleTab, searchQuery, statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (roleTab !== "all") params.role = roleTab;
      if (statusFilter !== "all") params.is_active = statusFilter === "active" ? "true" : "false";
      if (searchQuery.trim()) params.search = searchQuery.trim();
      return superAdminGet<{ data?: ManagedUser[]; results?: ManagedUser[] }>("/super-admin/users/", params);
    },
  });

  const usersList: ManagedUser[] = usersData?.data ?? usersData?.results ?? (Array.isArray(usersData) ? usersData : []);

  // Fetch detailed user
  const { data: userDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ["super-admin-user-detail", viewDetailId],
    queryFn: async () => {
      if (!viewDetailId) return null;
      return superAdminGet<UserDetailPayload>(`/super-admin/users/${viewDetailId}/`);
    },
    enabled: !!viewDetailId,
  });

  // Suspend mutation
  const suspendMutation = useMutation({
    mutationFn: async (user: ManagedUser) => {
      const endpoint = user.isActive ? `/super-admin/users/${user.id}/suspend/` : `/super-admin/users/${user.id}/activate/`;
      return superAdminPost<{ message: string }>(endpoint, { reason: "Super Admin action" });
    },
    onSuccess: (res) => {
      toast({ title: "العملية تمت بنجاح", description: res.message });
      queryClient.invalidateQueries({ queryKey: ["super-admin-users"] });
      setSuspendTarget(null);
    },
    onError: (err: any) => {
      toast({ title: "حدث خطأ", description: err?.message || "فشلت العملية", variant: "destructive" });
    },
  });

  // Role change mutation
  const roleChangeMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      return superAdminPost<{ message: string }>(`/super-admin/users/${userId}/change-role/`, { role });
    },
    onSuccess: (res) => {
      toast({ title: "تغيير الدور", description: res.message });
      queryClient.invalidateQueries({ queryKey: ["super-admin-users"] });
      setRoleChangeTarget(null);
    },
    onError: (err: any) => {
      toast({ title: "خطأ في تغيير الدور", description: err?.message || "فشلت عملية تغيير الدور", variant: "destructive" });
    },
  });

  // Reset password link mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (user: ManagedUser) => {
      return superAdminPost<{ message: string }>(`/super-admin/users/${user.id}/reset-password-link/`);
    },
    onSuccess: (res) => {
      toast({ title: "تم إرسال رابط الإعادة", description: res.message });
      setResetPassTarget(null);
    },
    onError: (err: any) => {
      toast({ title: "فشل الإرسال", description: err?.message || "تعذر إرسال رابط إعادة التعيين", variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (user: ManagedUser) => {
      return superAdminDelete<{ message: string }>(`/super-admin/users/${user.id}/`, {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm_email: confirmEmailInput }),
      });
    },

    onSuccess: (res) => {
      toast({ title: "تم حذف الحساب نهائياً", description: res.message });
      queryClient.invalidateQueries({ queryKey: ["super-admin-users"] });
      setDeleteTarget(null);
      setConfirmEmailInput("");
    },
    onError: (err: any) => {
      toast({ title: "فشل حذف الحساب", description: err?.message || "تأكد من كتابة البريد الإلكتروني بشكل صحيح", variant: "destructive" });
    },
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "super_admin":
        return <Badge className="bg-purple-600 text-white font-semibold">Super Admin</Badge>;
      case "admin":
        return <Badge className="bg-blue-600 text-white font-semibold">Admin</Badge>;
      case "instructor":
        return <Badge className="bg-amber-600 text-white font-semibold">Instructor</Badge>;
      default:
        return <Badge variant="secondary">Student</Badge>;
    }
  };

  const renderUserActions = (usr: ManagedUser, layoutClassName = "justify-center") => (
    <div className={`flex flex-wrap items-center gap-1 ${layoutClassName}`}>

        {/* View details */}
        <Button
          variant="ghost"
          size="icon"
          title="عرض البيانات الشاملة"
          onClick={() => setViewDetailId(usr.id)}
          className="hover:bg-slate-800 text-slate-300"
        >
          <Eye className="h-4 w-4" />
        </Button>

        {/* Change Role */}
        <Button
          variant="ghost"
          size="icon"
          title="تغيير الدور"
          onClick={() => {
            setRoleChangeTarget(usr);
            setNewRole(usr.role);
          }}
          className="hover:bg-slate-800 text-amber-400"
        >
          <Shield className="h-4 w-4" />
        </Button>

        {/* Reset password link */}
        <Button
          variant="ghost"
          size="icon"
          title="إرسال رابط إعادة تعيين كلمة المرور"
          onClick={() => setResetPassTarget(usr)}
          className="hover:bg-slate-800 text-blue-400"
        >
          <KeyRound className="h-4 w-4" />
        </Button>

        {/* Suspend / Activate */}
        <Button
          variant="ghost"
          size="icon"
          title={usr.isActive ? "تعليق الحساب" : "تفعيل الحساب"}
          onClick={() => setSuspendTarget(usr)}
          className={`hover:bg-slate-800 ${usr.isActive ? "text-rose-400" : "text-emerald-400"}`}
        >
          {usr.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
        </Button>

        {/* Delete account */}
        <Button
          variant="ghost"
          size="icon"
          title="حذف الحساب نهائياً"
          onClick={() => {
            setDeleteTarget(usr);
            setConfirmEmailInput("");
          }}
          className="hover:bg-rose-950 text-rose-500"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">إدارة المستخدمين الشاملة</h1>
          <p className="text-slate-400 text-sm mt-1">إدارة حسابات الطلاب، المحاضرين، المهندسين والأدمن مع التوثيق الأمني المحفوظ.</p>
        </div>
      </div>

      {/* Role Tabs */}
      <Tabs defaultValue="all" onValueChange={setRoleTab} className="w-full">
        <TabsList className="bg-slate-900 border border-slate-800 p-1">
          <TabsTrigger value="all">الكل ({usersList.length})</TabsTrigger>
          <TabsTrigger value="student">الطلاب</TabsTrigger>
          <TabsTrigger value="instructor">المحاضرين</TabsTrigger>
          <TabsTrigger value="admin">الأدمن</TabsTrigger>
          <TabsTrigger value="super_admin">Super Admins</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search & Filter controls */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="pt-4 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="البحث بالاسم أو البريد الإلكتروني..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9 bg-slate-950 border-slate-800"
            />
          </div>

          <div className="w-full sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-10 rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="all">جميع الحالات</option>
              <option value="active">نشط فقط</option>
              <option value="suspended">معلّق فقط</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="bg-slate-900 border-slate-800 overflow-hidden">
        <CardHeader className="border-b border-slate-800">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <UserCog className="h-5 w-5 text-indigo-400" /> قائمة المستخدمين المسجلين
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <PageLoading />
          ) : usersList.length === 0 ? (
            <div className="text-center py-12 text-slate-400">لا يوجد مستخدمون يطابقون شروط البحث.</div>
          ) : (
            <>
            {/* Mobile / small tablet: card list (a wide table would hide the action buttons off-screen) */}
            <ul className="md:hidden divide-y divide-slate-800" aria-label="قائمة المستخدمين">
              {usersList.map((usr) => (
                <li key={usr.id} className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-indigo-950 text-indigo-300 flex items-center justify-center font-bold text-sm border border-indigo-800/50">
                      {usr.first_name?.[0] || usr.email[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-100 break-words">{usr.fullName}</div>
                      <div className="text-xs text-slate-400 flex items-start gap-1 break-all">
                        <Mail className="h-3 w-3 mt-0.5 shrink-0" /> {usr.email}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {getRoleBadge(usr.role)}
                    {usr.isActive ? (
                      <Badge variant="outline" className="bg-emerald-950/40 text-emerald-400 border-emerald-800/50">
                        <UserCheck className="h-3 w-3 me-1" /> نشط
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-rose-950/40 text-rose-400 border-rose-800/50">
                        <UserX className="h-3 w-3 me-1" /> معلّق
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 space-y-0.5">
                    <div>آخر دخول: {usr.lastLogin ? new Date(usr.lastLogin).toLocaleString("ar-EG") : "لم يسجل بعد"}</div>
                    <div>الانضمام: {new Date(usr.dateJoined).toLocaleDateString("ar-EG")}</div>
                  </div>
                  <div className="pt-1 border-t border-slate-800/70">{renderUserActions(usr, "justify-start pt-2")}</div>
                </li>
              ))}
            </ul>

            <div className="hidden md:block">
            <Table>
              <TableHeader className="bg-slate-950/60">
                <TableRow className="border-slate-800">
                  <TableHead className="text-right">المستخدم</TableHead>
                  <TableHead className="text-right">الدور الوظيفي</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right hidden 2xl:table-cell">آخر تسجيل دخول</TableHead>
                  <TableHead className="text-right hidden xl:table-cell">تاريخ الانضمام</TableHead>
                  <TableHead className="text-center">الإجراءات والعمليات</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {usersList.map((usr) => (
                  <TableRow key={usr.id} className="border-slate-800 hover:bg-slate-800/40">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 shrink-0 rounded-full bg-indigo-950 text-indigo-300 flex items-center justify-center font-bold text-sm border border-indigo-800/50">
                          {usr.first_name?.[0] || usr.email[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-100">{usr.fullName}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-1 break-all">
                            <Mail className="h-3 w-3 shrink-0" /> {usr.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>{getRoleBadge(usr.role)}</TableCell>

                    <TableCell>
                      {usr.isActive ? (
                        <Badge variant="outline" className="bg-emerald-950/40 text-emerald-400 border-emerald-800/50">
                          <UserCheck className="h-3 w-3 mr-1" /> نشط
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-rose-950/40 text-rose-400 border-rose-800/50">
                          <UserX className="h-3 w-3 mr-1" /> معلّق
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-xs text-slate-400 hidden 2xl:table-cell">
                      {usr.lastLogin ? new Date(usr.lastLogin).toLocaleString("ar-EG") : "لم يسجل بعد"}
                    </TableCell>

                    <TableCell className="text-xs text-slate-400 hidden xl:table-cell">
                      {new Date(usr.dateJoined).toLocaleDateString("ar-EG")}
                    </TableCell>

                    <TableCell>{renderUserActions(usr)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* User Details Modal */}
      <Dialog open={!!viewDetailId} onOpenChange={(open) => !open && setViewDetailId(null)}>
        <DialogContent className="max-w-3xl bg-slate-900 border-slate-800 text-slate-100 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Eye className="h-5 w-5 text-indigo-400" /> تفاصيل ملف المستخدم الحسابية
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              بيانات الدفع، الكورسات المسجلة، والأنشطة الإدارية المسجلة لمستخدم المنصة.
            </DialogDescription>
          </DialogHeader>

          {isLoadingDetail || !userDetail ? (
            <PageLoading />
          ) : (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg bg-slate-950 border border-slate-800">
                <div>
                  <div className="text-xs text-slate-400">الاسم الكامل</div>
                  <div className="font-semibold text-slate-200 mt-0.5">{userDetail.fullName}</div>
                </div>

                <div>
                  <div className="text-xs text-slate-400">البريد الإلكتروني</div>
                  <div className="font-semibold text-slate-200 mt-0.5 text-xs truncate">{userDetail.email}</div>
                </div>

                <div>
                  <div className="text-xs text-slate-400">الدور والحالة</div>
                  <div className="mt-1 flex items-center gap-2">
                    {getRoleBadge(userDetail.role)}
                    <Badge variant={userDetail.isActive ? "default" : "destructive"}>
                      {userDetail.isActive ? "نشط" : "معلق"}
                    </Badge>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-400">رقم الهاتف</div>
                  <div className="font-semibold text-slate-200 mt-0.5 text-xs">{userDetail.phone || "غير محدد"}</div>
                </div>
              </div>

              {/* Courses Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-indigo-300">
                  <BookOpen className="h-4 w-4" /> الدورات والأنشطة التدريسية/التعليمية
                </h3>

                {userDetail.role === "student" ? (
                  userDetail.coursesEnrolled.length === 0 ? (
                    <div className="text-xs text-slate-500 p-3 rounded bg-slate-950">لا يوجد كورسات مسجل فيها حالياً.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {userDetail.coursesEnrolled.map((c) => (
                        <div key={c.id} className="p-3 rounded bg-slate-950 border border-slate-800 text-xs flex justify-between items-center">
                          <div>
                            <div className="font-semibold text-slate-200">{c.title}</div>
                            <div className="text-slate-400">{c.categoryName}</div>
                          </div>
                          <Badge variant="outline">{c.price} EGP</Badge>
                        </div>
                      ))}
                    </div>
                  )
                ) : userDetail.coursesTaught.length === 0 ? (
                  <div className="text-xs text-slate-500 p-3 rounded bg-slate-950">لا يوجد دورات تدريبية بيدرس فيها حالياً.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {userDetail.coursesTaught.map((c) => (
                      <div key={c.id} className="p-3 rounded bg-slate-950 border border-slate-800 text-xs flex justify-between items-center">
                        <div>
                          <div className="font-semibold text-slate-200">{c.title}</div>
                          <div className="text-slate-400">{c.categoryName}</div>
                        </div>
                        <Badge className="bg-indigo-950 text-indigo-300 border-indigo-800">{c.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payments Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-emerald-300">
                  <CreditCard className="h-4 w-4" /> سجل المدفوعات والعمليات الماليّة
                </h3>

                {userDetail.paymentHistory.length === 0 ? (
                  <div className="text-xs text-slate-500 p-3 rounded bg-slate-950">لا يوجد سجل مدفوعات مسجل لهذا الحساب.</div>
                ) : (
                  <div className="space-y-2">
                    {userDetail.paymentHistory.map((p) => (
                      <div key={p.id} className="p-3 rounded bg-slate-950 border border-slate-800 text-xs flex justify-between items-center">
                        <div>
                          <div className="font-semibold text-slate-200">{p.courseTitle}</div>
                          <div className="text-slate-400">طلب #{p.order_number} — {new Date(p.created_at).toLocaleDateString("ar-EG")}</div>
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-emerald-400">{p.amount} EGP</div>
                          <Badge variant="outline" className="text-[10px] mt-0.5">{p.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Audit Logs */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-purple-300">
                  <History className="h-4 w-4" /> سجل الأنشطة والأحداث (Audit Log)
                </h3>

                {userDetail.recentAuditLogs.length === 0 ? (
                  <div className="text-xs text-slate-500 p-3 rounded bg-slate-950">لا يوجد سجل عمليات مسجل.</div>
                ) : (
                  <div className="space-y-2">
                    {userDetail.recentAuditLogs.map((log) => (
                      <div key={log.id} className="p-2.5 rounded bg-slate-950 border border-slate-800 text-xs flex justify-between items-center">
                        <div>
                          <span className="font-semibold text-purple-400">{log.action_type}</span> on {log.target_model}
                          <div className="text-slate-400 text-[10px]">IP: {log.ip_address || "Internal"}</div>
                        </div>
                        <div className="text-slate-400 text-[10px]">{new Date(log.created_at).toLocaleString("ar-EG")}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Suspend / Activate Modal */}
      <Dialog open={!!suspendTarget} onOpenChange={(open) => !open && setSuspendTarget(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {suspendTarget?.isActive ? "تأكيد تعليق الحساب" : "تأكيد تفعيل الحساب"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              هل أنت أمنياً وتأكيدياً متأكد من {suspendTarget?.isActive ? "تعليق" : "تفعيل"} حساب المستخدم {suspendTarget?.email}؟
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="ghost" onClick={() => setSuspendTarget(null)}>إلغاء</Button>
            <Button
              variant={suspendTarget?.isActive ? "destructive" : "default"}
              onClick={() => suspendTarget && suspendMutation.mutate(suspendTarget)}
              disabled={suspendMutation.isPending}
            >
              {suspendMutation.isPending ? "جاري المعالجة..." : suspendTarget?.isActive ? "تعليق الحساب" : "تفعيل الحساب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Modal */}
      <Dialog open={!!roleChangeTarget} onOpenChange={(open) => !open && setRoleChangeTarget(null)}>
        <DialogContent size="sm" className="bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-amber-400">
              <Shield className="h-5 w-5" /> تغيير دور الحساب (Role Privilege)
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              اختر الدور الوظيفي الجديد للمستخدم {roleChangeTarget?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            >
              <option value="student">Student (طالب)</option>
              <option value="instructor">Instructor (محاضر/مدرس)</option>
              <option value="admin">Admin (أدمن)</option>
              <option value="super_admin">Super Admin (سوبر أدمن)</option>
            </select>
          </div>

          <DialogFooter className="gap-2 sm:gap-3">
            <Button variant="ghost" onClick={() => setRoleChangeTarget(null)}>إلغاء</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-500 text-white rounded-xl"
              onClick={() => roleChangeTarget && roleChangeMutation.mutate({ userId: roleChangeTarget.id, role: newRole })}
              disabled={roleChangeMutation.isPending}
            >
              {roleChangeMutation.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Link Modal */}
      <Dialog open={!!resetPassTarget} onOpenChange={(open) => !open && setResetPassTarget(null)}>
        <DialogContent size="sm" className="bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-blue-400">
              <KeyRound className="h-5 w-5" /> إرسال رابط إعادة تعيين كلمة المرور
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              سيتم إرسال توكن آمن مع رابط إعادة التعيين مباشرةً إلى البريد الإلكتروني المسجل: <span className="text-slate-200 font-mono">{resetPassTarget?.email}</span>. لن يتم عرض كلمة المرور الجديدة على الشاشة لأسباب أمنية.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-3">
            <Button variant="ghost" onClick={() => setResetPassTarget(null)}>إلغاء</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl"
              onClick={() => resetPassTarget && resetPasswordMutation.mutate(resetPassTarget)}
              disabled={resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? "جاري الإرسال..." : "إرسال الرابط الآمن"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Danger Zone: Strong Confirmation Delete Modal */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent size="sm" className="bg-slate-900 border-rose-900 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-rose-500">
              <AlertTriangle className="h-5 w-5" /> تأكيد حذف الحساب نهائياً (إجراء خطير)
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              سيؤدي هذا الإجراء إلى حذف كافة بيانات المستخدم بشكل دائم. لتأكيد الحذف، يرجى كتابة البريد الإلكتروني للمستخدم صراحة:
              <div className="font-mono text-slate-200 bg-slate-950 p-2 rounded-xl mt-2 border border-slate-800 text-center select-all">
                {deleteTarget?.email}
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Input
              placeholder="اكتب البريد الإلكتروني للتأكيد..."
              value={confirmEmailInput}
              onChange={(e) => setConfirmEmailInput(e.target.value)}
              className="bg-slate-950 border-rose-900/60 focus:ring-rose-500 font-mono text-xs rounded-xl"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-3">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>إلغاء</Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              disabled={confirmEmailInput.trim().toLowerCase() !== deleteTarget?.email.trim().toLowerCase() || deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              {deleteMutation.isPending ? "جاري الحذف..." : "حذف الحساب نهائياً"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
