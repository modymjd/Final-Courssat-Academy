import React, { useState } from "react";
import {
  Megaphone,
  Send,
  Users,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useInstructorCourses } from "@/features/instructor/hooks";
import { useToast } from "@/components/ui/use-toast";
import { apiPost } from "@/lib/http";

interface BroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BroadcastModal({ isOpen, onClose }: BroadcastModalProps) {
  const { toast } = useToast();
  const { data: courses = [] } = useInstructorCourses();

  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);

  const handleSendBroadcast = async () => {
    if (!selectedCourseId) {
      toast({ title: "خطأ", description: "يرجى اختيار الدورة التعليمية المستهدفة.", variant: "destructive" });
      return;
    }
    if (!title.trim() || !message.trim()) {
      toast({ title: "خطأ", description: "يرجى كتابة عنوان الإعلان ونص الرسالة.", variant: "destructive" });
      return;
    }

    setIsSending(true);
    try {
      const res = await apiPost<{ detail: string; recipients_count: number }>("/notifications/broadcast/", {
        course_id: Number(selectedCourseId),
        title: title.trim(),
        message: message.trim(),
      });
      toast({
        title: "تم البث بنجاح",
        description: res?.detail || "تم إرسال الإعلان لجميع الطلاب المسجلين بالدورة.",
      });
      setTitle("");
      setMessage("");
      onClose();
    } catch {
      toast({ title: "خطأ", description: "حدث خطأ أثناء بث الإعلان. يرجى المحاولة مرة أخرى.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent size="md" className="dir-rtl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Megaphone className="w-6 h-6 text-indigo-600" />
            بث إعلان عام لجميع الطلاب (Broadcast)
          </DialogTitle>
          <DialogDescription>
            إرسال إشعار فوري لجميع الطلاب المسجلين في دورة أو مجموعة محددة.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain space-y-4 py-2 custom-scrollbar">
          {/* Target Course Selector */}
          <div>
            <label className="text-sm font-semibold mb-1 block">الدورة المستهدفة</label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full h-10 px-3 rounded-md border text-sm bg-white dark:bg-slate-900"
            >
              <option value="">-- اختر الدورة التعليمية --</option>
              {courses.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Announcement Title */}
          <div>
            <label className="text-sm font-semibold mb-1 block">عنوان الإعلان</label>
            <Input
              placeholder="مثال: تغيير موعد المحاضرة القادمة"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Announcement Message */}
          <div>
            <label className="text-sm font-semibold mb-1 block">نص الإعلان التفصيلي</label>
            <Textarea
              placeholder="اكتب تفاصيل الإعلان والتنبيهات الموجهة للطلاب..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            onClick={handleSendBroadcast}
            disabled={isSending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 font-bold"
          >
            <Send className="w-4 h-4" />
            {isSending ? "جاري البث..." : "إرسال وبث الإعلان"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
