import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  Award,
  Search,
  Calendar,
  User,
  BookOpen,
  Loader2,
} from "lucide-react";
import { apiGet } from "@/lib/http";
import Layout from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface CertificateData {
  id: number;
  serial: string;
  student_name: string;
  course_title: string;
  instructor_name: string;
  grade_percentage: number;
  issue_date: string;
}

export default function VerifyCertificatePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [serial, setSerial] = useState(searchParams.get("serial") || "");
  const [inputValue, setInputValue] = useState(searchParams.get("serial") || "");
  const [status, setStatus] = useState<"idle" | "loading" | "valid" | "invalid">("idle");
  const [certificate, setCertificate] = useState<CertificateData | null>(null);

  useEffect(() => {
    if (serial) {
      verifyCertificate(serial);
    }
  }, [serial]);

  const verifyCertificate = async (serialNumber: string) => {
    if (!serialNumber.trim()) return;
    setStatus("loading");
    setCertificate(null);

    try {
      const data = await apiGet<CertificateData>(`/certificates/verify/${serialNumber.trim()}/`);
      setCertificate(data);
      setStatus("valid");
    } catch (err: any) {
      setStatus("invalid");
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setSearchParams({ serial: inputValue.trim() });
      setSerial(inputValue.trim());
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Layout>
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 bg-slate-50/50 dark:bg-slate-900/10 dir-rtl" dir="rtl">
        <div className="w-full max-w-2xl text-center mb-8">
          <Badge variant="outline" className="mb-4 text-emerald-600 bg-emerald-50 border-emerald-200">
            التحقق الرقمي
          </Badge>
          <h1 className="text-3xl md:text-4xl font-extrabold mb-4">التحقق من صحة الشهادة</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            أدخل الرقم التسلسلي للشهادة (Serial Number) للتحقق من صحتها وموثوقيتها عبر منصة EduSmart.
          </p>
        </div>

        <Card className="w-full max-w-2xl border-border/60 shadow-lg bg-card/60 glass rounded-3xl overflow-hidden mb-8">
          <CardContent className="p-2 sm:p-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="رقم الشهادة التسلسلي (مثال: CERT-12345678)"
                  className="pr-12 h-14 rounded-2xl border-muted bg-background text-lg shadow-sm font-mono text-left dir-ltr"
                  dir="ltr"
                />
              </div>
              <Button
                type="submit"
                disabled={status === "loading" || !inputValue.trim()}
                className="h-14 px-8 rounded-2xl bg-primary text-primary-foreground font-bold shadow-md hover:shadow-lg transition-all"
              >
                {status === "loading" ? <Loader2 className="w-5 h-5 animate-spin" /> : "تحقق"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {status === "loading" && (
          <div className="flex flex-col items-center gap-4 text-muted-foreground py-12">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="animate-pulse">جاري التحقق من السجلات...</p>
          </div>
        )}

        {status === "invalid" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl"
          >
            <Card className="border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 rounded-3xl shadow-sm">
              <CardContent className="p-8 text-center flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center mb-4">
                  <XCircle className="w-10 h-10 text-rose-600 dark:text-rose-400" />
                </div>
                <h2 className="text-2xl font-bold text-rose-700 dark:text-rose-400 mb-2">شهادة غير صالحة</h2>
                <p className="text-rose-600/80 dark:text-rose-400/80 max-w-sm">
                  عذراً، لم نتمكن من العثور على شهادة مطابقة للرقم التسلسلي المدخل. يرجى التأكد من الرقم والمحاولة مرة أخرى.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {status === "valid" && certificate && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl"
          >
            <Card className="border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20 rounded-3xl shadow-xl overflow-hidden relative">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-teal-500" />
              <CardContent className="p-8">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                  <div className="flex-shrink-0 w-32 h-32 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/50 dark:to-teal-900/50 flex items-center justify-center shadow-inner border border-emerald-200/50">
                    <Award className="w-16 h-16 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  
                  <div className="flex-1 text-center md:text-right space-y-4">
                    <div className="flex items-center justify-center md:justify-start gap-2 text-emerald-600 dark:text-emerald-400 font-bold mb-2">
                      <CheckCircle className="w-5 h-5" />
                      <span>شهادة معتمدة وموثقة</span>
                    </div>
                    
                    <h2 className="text-2xl font-extrabold text-foreground">{certificate.student_name}</h2>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-sm">
                      <div className="space-y-1">
                        <div className="text-muted-foreground flex items-center justify-center md:justify-start gap-1.5">
                          <BookOpen className="w-4 h-4" /> الدورة التعليمية
                        </div>
                        <div className="font-semibold">{certificate.course_title}</div>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="text-muted-foreground flex items-center justify-center md:justify-start gap-1.5">
                          <User className="w-4 h-4" /> المدرب
                        </div>
                        <div className="font-semibold">{certificate.instructor_name}</div>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="text-muted-foreground flex items-center justify-center md:justify-start gap-1.5">
                          <Calendar className="w-4 h-4" /> تاريخ الإصدار
                        </div>
                        <div className="font-semibold">{formatDate(certificate.issue_date)}</div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-muted-foreground flex items-center justify-center md:justify-start gap-1.5">
                          <Award className="w-4 h-4" /> التقدير
                        </div>
                        <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {certificate.grade_percentage}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 pt-6 border-t border-border/50 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
                  <div className="font-mono bg-muted/50 px-3 py-1.5 rounded-lg border dir-ltr">
                    {certificate.serial}
                  </div>
                  <div>تم التحقق بنجاح عبر منصة EduSmart</div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
