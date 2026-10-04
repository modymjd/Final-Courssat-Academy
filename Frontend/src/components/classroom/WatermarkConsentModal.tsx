import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { ShieldAlert, Download, Loader2, AlertCircle, FileCheck2 } from "lucide-react";
import {
  recordStudentFileConsent,
  downloadWatermarkedLessonPdf,
} from "@/features/courses/api";

export interface WatermarkConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  lessonId: number;
  courseId?: number;
  lessonTitle: string;
  onSuccess?: () => void;
}

export const WatermarkConsentModal: React.FC<WatermarkConsentModalProps> = ({
  isOpen,
  onClose,
  lessonId,
  courseId,
  lessonTitle,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [agreed, setAgreed] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!agreed || isDownloading) return;

    setIsDownloading(true);
    try {
      // 1. Record student consent
      try {
        await recordStudentFileConsent(lessonId);
      } catch {
        // Non-blocking if consent was already recorded or endpoint unavailable
      }

      // 2. Download watermarked blob
      const { blob, filename } = await downloadWatermarkedLessonPdf(lessonId, courseId);

      // 3. Trigger browser download
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      const cleanTitle = lessonTitle ? lessonTitle.replace(/[/\\?%*:|"<>]/g, "-") : `Lesson_${lessonId}`;
      link.download = filename && filename.endsWith(".pdf") ? filename : `Lesson_${cleanTitle}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);

      toast({
        title: "تم بدء تنزيل الملف الموسوم بنجاح 🔒",
        description: `تم وسم الملف ببياناتك الأمنية وجاري حفظه باسم ${cleanTitle}.pdf`,
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      if (status === 429) {
        toast({
          variant: "destructive",
          title: "تجاوز حد التنزيل المسموح",
          description:
            err.message ||
            "لقد تجاوزت الحد المسموح لتنزيل الملفات (5 ملفات خلال 10 دقائق). يرجى الانتظار.",
          duration: 7000,
        });
      } else if (status === 404) {
        toast({
          variant: "destructive",
          title: "الملف غير متوفر",
          description: "عذراً، هذا الملف غير متاح للتنزيل حالياً أو أن صلاحية الوصول مقيدة.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "فشل تنزيل الملف",
          description:
            err?.message ||
            "حدث خطأ غير متوقع أثناء تجهيز الملف المختوم، يرجى المحاولة مرة أخرى لاحقاً.",
        });
      }
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isDownloading) onClose(); }}>
      <DialogContent
        className="sm:max-w-lg rounded-2xl p-6 text-foreground bg-card border border-border shadow-2xl space-y-4"
        dir="rtl"
      >
        <DialogHeader className="text-right space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-lg sm:text-xl font-black">
                إشعار الختم المائي والمسؤولية القانونية
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                حماية المحتوى الأكاديمي الرقمي لمنصة كورسات
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Security Alert Box */}
        <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/25 text-xs sm:text-sm leading-relaxed text-foreground space-y-2">
          <div className="flex items-center gap-2 font-bold text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>تنبيه أمني مشدد:</span>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            الملف المرفق مخصص لك وموسوم بعلامتك المائية الشخصية (الاسم، الرقم القومي، كود الطالب STU-XXXXX، ومعرّف التتبع الأمني). يحظر تماماً مشاركة أو نشر هذا الملف بأي وسيلة منعاً للمساءلة القانونية وإلغاء الحساب.
          </p>
        </div>

        {/* Lesson Information */}
        <div className="p-3 bg-muted/40 rounded-xl border border-border/70 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-foreground font-medium truncate">
            <FileCheck2 className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate">{lessonTitle}</span>
          </div>
          <span className="text-muted-foreground font-mono shrink-0 ms-2">PDF آمن</span>
        </div>

        {/* Agreement Checkbox */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-card/60 hover:bg-muted/30 transition-colors">
          <Checkbox
            id="watermark-agree"
            checked={agreed}
            onCheckedChange={(val) => setAgreed(Boolean(val))}
            disabled={isDownloading}
            className="mt-0.5 w-5 h-5 rounded-md border-primary/50 text-primary focus-visible:ring-2 focus-visible:ring-primary shrink-0"
          />
          <Label
            htmlFor="watermark-agree"
            className="text-xs sm:text-sm font-semibold leading-relaxed cursor-pointer select-none"
          >
            أقر بعلمي بأن الملف مراقب رقمياً وأتحمل المسؤولية القانونية الكاملة
          </Label>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isDownloading}
            className="w-full sm:w-auto rounded-xl font-bold text-xs sm:text-sm min-h-[44px]"
          >
            إلغاء
          </Button>

          <Button
            type="button"
            onClick={handleDownload}
            disabled={!agreed || isDownloading}
            className="w-full sm:w-auto gap-2 rounded-xl font-bold text-xs sm:text-sm min-h-[44px] bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري ختم الملف وتنزيله...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>تأكيد وتحميل الملف المختوم</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WatermarkConsentModal;
