import React, { useState, useEffect } from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Settings, Save, ShieldAlert, Globe, BellRing, DollarSign, Mail } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { usePlatformTheme } from "@/hooks/usePlatformTheme";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPatch } from "@/lib/http";

export default function AdminSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: themeData } = usePlatformTheme();

  const [siteName, setSiteName] = useState(themeData?.site_name || "كورسات");
  const [supportEmail, setSupportEmail] = useState(themeData?.support_email || "support@courssat.online");
  const [supportPhone, setSupportPhone] = useState(themeData?.support_phone || "+20 100 000 0000");
  const [enableRegistration, setEnableRegistration] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  useEffect(() => {
    if (themeData) {
      if (themeData.site_name) setSiteName(themeData.site_name);
      if (themeData.support_email) setSupportEmail(themeData.support_email);
      if (themeData.support_phone) setSupportPhone(themeData.support_phone);
    }
  }, [themeData]);

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPatch("/common/settings/", payload),
    onSuccess: () => {
      toast({ title: "تم الحفظ بنجاح", description: "تم تحديث إعدادات المنصة العامة بنجاح." });
      queryClient.invalidateQueries({ queryKey: ["platform-theme"] });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "خطأ في الحفظ",
        description: err.message || "فشل تحديث إعدادات المنصة.",
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      site_name: siteName,
      support_email: supportEmail,
      support_phone: supportPhone,
    });
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 dir-rtl space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-slate-900 via-primary/90 to-slate-900 p-6 rounded-3xl text-white shadow-xl">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-3">
              <Settings className="w-8 h-8 text-primary-foreground" />
              إعدادات المنصة والإدارة العامة
            </h1>
            <p className="text-slate-300 mt-1 text-sm">
              التحكم في الإعدادات الهيكلية، قنوات الاتصال، وإعدادات النظام والأمان.
            </p>
          </div>
          <Button onClick={handleSave} disabled={saveMutation.isPending} className="gradient-cta text-white font-bold gap-2 rounded-xl shadow-lg">
            <Save size={16} />
            <span>{saveMutation.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* General Settings */}
          <Card className="border-border/60 rounded-2xl shadow-xs">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Globe size={20} className="text-primary" />
                المعلومات العامة والهوية
              </CardTitle>
              <CardDescription>الاسم الرسمي وقنوات التفاهم الظاهرة للمستخدمين</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">اسم المنصة</label>
                <Input value={siteName} onChange={(e) => setSiteName(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">بريد الدعم</label>
                <Input value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">هاتف الدعم / واتساب</label>
                <Input value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} className="rounded-xl font-mono" />
              </div>
            </CardContent>
          </Card>

          {/* System Control Settings */}
          <Card className="border-border/60 rounded-2xl shadow-xs">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <ShieldAlert size={20} className="text-amber-500" />
                تحكم النظام والأمان
              </CardTitle>
              <CardDescription>تفعيل التسجيل وصيانة المنصة والتنبيهات</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm">تفعيل التسجيل الجديد</h4>
                  <p className="text-xs text-muted-foreground">السماح لطلاب ومدرسين جُدد بإنشاء حسابات</p>
                </div>
                <Switch checked={enableRegistration} onCheckedChange={setEnableRegistration} />
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <div>
                  <h4 className="font-bold text-sm text-amber-600">وضع الصيانة (Maintenance Mode)</h4>
                  <p className="text-xs text-muted-foreground">إغلاق الواجهة العامة وإظهار صفحة الصيانة</p>
                </div>
                <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
