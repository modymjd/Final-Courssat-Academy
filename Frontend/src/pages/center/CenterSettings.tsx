import React, { useState, useEffect } from "react";
import {
  Settings,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileCheck,
  Globe,
  Bell,
  Save,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { useCenterSettings, useUpdateCenterSettings } from "@/features/center";

export default function CenterSettings() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useCenterSettings();
  const updateSettingsMutation = useUpdateCenterSettings();

  const [formData, setFormData] = useState({
    institution_name: "",
    institution_type: "center",
    address: "",
    license_number: "",
    website: "",
    phone: "",
    email: "",
    full_name: "",
    notify_on_redemption: true,
    notify_on_quota_low: true,
    notify_on_admin_review: true,
  });

  useEffect(() => {
    if (settings) {
      const notifs = (settings.notification_preferences || (settings as any).notificationPreferences) as
        | {
            notify_on_redemption?: boolean;
            notify_on_quota_low?: boolean;
            notify_on_admin_review?: boolean;
            notifyOnRedemption?: boolean;
            notifyOnQuotaLow?: boolean;
            notifyOnAdminReview?: boolean;
          }
        | undefined;
      setFormData({
        institution_name: settings.institution_name || (settings as any).institutionName || "",
        institution_type: settings.institution_type || (settings as any).institutionType || "center",
        address: settings.address || "",
        license_number: settings.license_number || (settings as any).licenseNumber || "",
        website: settings.website || "",
        phone: settings.phone || "",
        email: settings.email || "",
        full_name: settings.full_name || (settings as any).fullName || "",
        notify_on_redemption: notifs?.notify_on_redemption ?? notifs?.notifyOnRedemption ?? true,
        notify_on_quota_low: notifs?.notify_on_quota_low ?? notifs?.notifyOnQuotaLow ?? true,
        notify_on_admin_review: notifs?.notify_on_admin_review ?? notifs?.notifyOnAdminReview ?? true,
      });
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await updateSettingsMutation.mutateAsync({
        institution_name: formData.institution_name,
        institution_type: formData.institution_type,
        address: formData.address,
        license_number: formData.license_number,
        website: formData.website,
        notification_preferences: {
          notify_on_redemption: formData.notify_on_redemption,
          notify_on_quota_low: formData.notify_on_quota_low,
          notify_on_admin_review: formData.notify_on_admin_review,
        },
      });

      toast({
        title: "تم حفظ الإعدادات بنجاح 🎉",
        description: "تم تحديث بيانات المركز التعليمي وخيارات الإشعارات.",
      });
    } catch (err: any) {
      toast({
        title: "خطأ في الحفظ",
        description: err?.message || "تعذر تحديث إعدادات المركز.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-blue-950/80 via-slate-900 to-indigo-950/80 p-6 rounded-2xl border border-blue-800/40 shadow-lg">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
            <Settings className="w-8 h-8 text-blue-400" />
            إعدادات المركز التعليمي
          </h1>
          <p className="text-blue-200/80 mt-1 text-sm">
            تحديث البيانات الرسمية للمؤسسة، وسائل التواصل، وتفضيلات تنبيهات النظام.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Institution Info Card */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader>
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              البيانات الرسمية للمؤسسة
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              الاسم الرسمي المعتمد الذي يظهر على مستندات الأكواد والشهادات
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">اسم السنتر / المركز الأكاديمي</label>
                <Input
                  value={formData.institution_name}
                  onChange={(e) => setFormData({ ...formData, institution_name: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">رقم السجل / الترخيص الأكاديمي</label>
                <Input
                  placeholder="مثال: LIC-2026-99"
                  value={formData.license_number}
                  onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-white font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">العنوان والمقر الرئيسي</label>
                <Input
                  placeholder="المدينة، الحي، الشارع الرئيسي..."
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">الموقع الإلكتروني أو صفحة التواصل</label>
                <Input
                  placeholder="https://..."
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-white"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Details Card */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader>
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-400" />
              بيانات التواصل والمفوض الرسمي
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              بيانات الحساب ومسؤول التنسيق بالسنتر
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">اسم المسؤول / المفوض</label>
                <Input
                  disabled
                  value={formData.full_name}
                  className="bg-slate-950/60 border-slate-800 text-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">البريد الإلكتروني للحساب</label>
                <Input
                  disabled
                  value={formData.email}
                  className="bg-slate-950/60 border-slate-800 text-slate-400 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">رقم الهاتف</label>
                <Input
                  disabled
                  value={formData.phone || "—"}
                  className="bg-slate-950/60 border-slate-800 text-slate-400 font-mono"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader>
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              تفضيلات الإشعارات والتنبيهات
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              حدد التنبيهات الفورية التي ترغب في استلامها
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 divide-y divide-slate-800/80">
            <div className="flex items-center justify-between pt-3 first:pt-0">
              <div>
                <div className="text-sm font-semibold text-white">إشعار عند تفعيل كود طالب</div>
                <div className="text-xs text-slate-400">تلقي إشعار لحظي فور قيام أي طالب بتفعيل كود بنجاح</div>
              </div>
              <Switch
                checked={formData.notify_on_redemption}
                onCheckedChange={(checked) => setFormData({ ...formData, notify_on_redemption: checked })}
              />
            </div>

            <div className="flex items-center justify-between pt-3">
              <div>
                <div className="text-sm font-semibold text-white">تنبيه عند اقتراب نفاد الكوتة</div>
                <div className="text-xs text-slate-400">تنبيه استباقي عندما يتبقى أقل من 10 أكواد في كوتة المركز</div>
              </div>
              <Switch
                checked={formData.notify_on_quota_low}
                onCheckedChange={(checked) => setFormData({ ...formData, notify_on_quota_low: checked })}
              />
            </div>

            <div className="flex items-center justify-between pt-3">
              <div>
                <div className="text-sm font-semibold text-white">إشعار مراجعة طلبات الكوتة</div>
                <div className="text-xs text-slate-400">إشعار فوري عند اعتماد أو رفض طلب زيادة الكوتة من إدارة المنصة</div>
              </div>
              <Switch
                checked={formData.notify_on_admin_review}
                onCheckedChange={(checked) => setFormData({ ...formData, notify_on_admin_review: checked })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="submit"
            disabled={updateSettingsMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2"
          >
            <Save className="w-4 h-4" />
            {updateSettingsMutation.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
          </Button>
        </div>
      </form>
    </div>
  );
}
