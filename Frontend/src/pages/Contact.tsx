import React, { useState } from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Mail, Phone, MapPin, Send, MessageSquare, Clock } from "lucide-react";
import { usePlatformTheme } from "@/hooks/usePlatformTheme";
import { useToast } from "@/components/ui/use-toast";

export default function Contact() {
  const { data: themeData } = usePlatformTheme();
  const { toast } = useToast();
  const siteName = themeData?.site_name?.replace(/ - إديوسمارت|إديوسمارت| - EduSmart|EduSmart/g, "") || "كورسات";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) {
      toast({ title: "خطأ", description: "يرجى ملء جميع الحقول المطلوبة.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      toast({ title: "تم الإرسال بنجاح", description: "شكراً لتواصلك معنا! سيتم الرد عليك خلال 24 ساعة." });
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    }, 1000);
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 dir-rtl max-w-5xl space-y-8" dir="rtl">
        {/* Header */}
        <div className="text-center space-y-3 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-8 rounded-3xl border border-primary/20">
          <div className="w-14 h-14 bg-primary/15 text-primary rounded-2xl flex items-center justify-center mx-auto mb-2">
            <MessageSquare size={32} />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">تواصل معنا</h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto">
            نحن هنا لمساعدتك! يسعد فريق دعم {siteName} الإجابة على استفساراتك واستقبال مقترحاتك على مدار الساعة.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Info Side */}
          <div className="space-y-4 lg:col-span-1">
            <Card className="border-border/60 rounded-2xl shadow-xs">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 mt-1">
                    <Mail size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">البريد الإلكتروني للدعم</h4>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">medoalhetawy123@gmail.com</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 shrink-0 mt-1">
                    <Phone size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">رقم الهاتف / واتساب</h4>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5 font-bold text-emerald-600">01020335023</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 shrink-0 mt-1">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">المقر الرئيسي</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">دسوق، محافظة كفر الشيخ، جمهورية مصر العربية</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 shrink-0 mt-1">
                    <Clock size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">مواعيد العمل</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">الأحد - الخميس (9:00 ص - 6:00 م)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Form Side */}
          <div className="lg:col-span-2">
            <Card className="border-border/60 rounded-2xl shadow-xs">
              <CardHeader>
                <CardTitle className="text-xl font-bold">أرسل لنا رسالة جديدة</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground">الاسم الكامل *</label>
                      <Input
                        placeholder="أدخل اسمك الكريم"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground">البريد الإلكتروني *</label>
                      <Input
                        type="email"
                        placeholder="example@domain.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground">موضوع الرسالة</label>
                    <Input
                      placeholder="استفسار، اقتراح، أو طلب دعم أثنائي"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground">نص الرسالة *</label>
                    <Textarea
                      placeholder="اكتب تفاصيل استفسارك هنا..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={5}
                      required
                      className="rounded-xl"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full gradient-cta text-white font-bold gap-2 rounded-xl py-2.5"
                  >
                    <Send size={16} />
                    <span>{isSubmitting ? "جاري الإرسال..." : "إرسال الرسالة"}</span>
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
