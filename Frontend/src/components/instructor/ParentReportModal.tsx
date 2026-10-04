import React, { useState } from "react";
import {
  Send,
  Mail,
  SendHorizontal,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { apiPost } from "@/lib/http";

interface ParentReportModalProps {
  studentId: number | null;
  studentName?: string;
  reportData?: Record<string, any>;
  isOpen: boolean;
  onClose: () => void;
}

export function ParentReportModal({ studentId, studentName, reportData, isOpen, onClose }: ParentReportModalProps) {
  const { toast } = useToast();
  const [channel, setChannel] = useState<"EMAIL" | "TELEGRAM" | "WHATSAPP">("TELEGRAM");
  const [isSending, setIsSending] = useState<boolean>(false);

  const handleSendReport = async () => {
    if (!studentId) return;
    setIsSending(true);

    try {
      await apiPost("/notifications/parent-reports/send/", {
        student_id: studentId,
        channel: channel,
        report_data: reportData || {},
      });
      toast({
        title: "تم إرسال التقرير",
        description: `تم إرسال تقرير الأداء لولي أمر الطالب ${studentName || ""} بنجاح عبر ${channel}.`,
      });
      onClose();
    } catch {
      toast({ title: "خطأ", description: "حدث خطأ أثناء إرسال التقرير. يرجى المحاولة مرة أخرى.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent size="md" className="dir-rtl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <SendHorizontal className="w-6 h-6 text-emerald-600" />
            إرسال تقرير الأداء لولي الأمر
          </DialogTitle>
          <DialogDescription>
            تصدير تقرير نسبة الحضور والدرجات وإرساله مباشرة لولي أمر <strong>{studentName || "الطالب"}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain space-y-4 py-2 custom-scrollbar">
          {/* Channel Selection */}
          <div>
            <label className="text-sm font-semibold mb-2 block">اختر قناة الإرسال</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setChannel("EMAIL")}
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                  channel === "EMAIL"
                    ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                }`}
              >
                <Mail className="w-5 h-5 text-blue-600" />
                <span className="text-xs">البريد الإلكتروني</span>
                <Badge variant="outline" className="text-[9px] mt-1">مجاني</Badge>
              </button>

              <button
                type="button"
                onClick={() => setChannel("TELEGRAM")}
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                  channel === "TELEGRAM"
                    ? "border-sky-600 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-bold"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                }`}
              >
                <SendHorizontal className="w-5 h-5 text-sky-500" />
                <span className="text-xs">Telegram Bot</span>
                <Badge variant="outline" className="text-[9px] mt-1 bg-sky-50 text-sky-700 border-sky-200">رسمي</Badge>
              </button>

              <button
                type="button"
                onClick={() => setChannel("WHATSAPP")}
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                  channel === "WHATSAPP"
                    ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                }`}
              >
                <MessageSquare className="w-5 h-5 text-emerald-600" />
                <span className="text-xs">WhatsApp API</span>
                <Badge variant="outline" className="text-[9px] mt-1 bg-amber-50 text-amber-700 border-amber-200">مدفوع</Badge>
              </button>
            </div>
          </div>

          {/* WhatsApp API Warning Notice */}
          {channel === "WHATSAPP" && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>تنبيه مزود الخدمة:</strong> يتطلب إرسال الرسائل عبر WhatsApp Business API رصيد رسائل مدفوع بالمنصة.
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            onClick={handleSendReport}
            disabled={isSending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold"
          >
            <Send className="w-4 h-4" />
            {isSending ? "جاري الإرسال..." : "إرسال التقرير الآن"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
