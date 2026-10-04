import React, { useState, useRef } from "react";
import { Clock, Plus, Trash2, Edit3, Send, Play, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudentNotes, useCreateNote, useDeleteNote } from "../hooks/useNotes";
import type { StudentNote } from "@/types/note";

interface ClassroomNotesTabProps {
  courseId: number;
  lessonId: number;
  currentTimeRef: React.MutableRefObject<number>;
  onSeek: (seconds: number) => void;
}

const formatSeconds = (seconds: number = 0) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

export const ClassroomNotesTab: React.FC<ClassroomNotesTabProps> = ({
  courseId,
  lessonId,
  currentTimeRef,
  onSeek,
}) => {
  const [content, setContent] = useState("");
  const [pinnedTime, setPinnedTime] = useState<number | null>(null);
  const pinnedTimeRef = useRef<number | null>(null);

  const { data: notesData, isLoading, isError } = useStudentNotes({
    courseId,
    lessonId,
    pageSize: 50,
  });

  const createNoteMutation = useCreateNote();
  const deleteNoteMutation = useDeleteNote();

  const notes: StudentNote[] = notesData?.data || [];

  // Capture playback timestamp on focus
  const handleInputFocus = () => {
    if (pinnedTimeRef.current === null) {
      const current = Math.floor(currentTimeRef.current || 0);
      pinnedTimeRef.current = current;
      setPinnedTime(current);
    }
  };

  const handleUpdatePinnedTime = () => {
    const current = Math.floor(currentTimeRef.current || 0);
    pinnedTimeRef.current = current;
    setPinnedTime(current);
  };

  const handleClearPinnedTime = () => {
    pinnedTimeRef.current = null;
    setPinnedTime(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanContent = content.trim();
    if (!cleanContent) return;

    const time = pinnedTimeRef.current ?? Math.floor(currentTimeRef.current || 0);
    const title = `ملاحظة عند ${formatSeconds(time)}`;

    try {
      await createNoteMutation.mutateAsync({
        client_id: crypto.randomUUID(),
        course_id: courseId,
        lesson_id: lessonId,
        title,
        content: cleanContent,
        timestamp_seconds: time,
        color: "default",
        tags: ["درس"],
      });

      setContent("");
      handleClearPinnedTime();
    } catch {
      // Error handled by query / notification
    }
  };

  const handleDelete = async (noteId: number) => {
    try {
      await deleteNoteMutation.mutateAsync(noteId);
    } catch {
      // Error handled
    }
  };

  return (
    <div className="space-y-4 font-sans text-right" dir="rtl">
      {/* Note Creation Card */}
      <form
        onSubmit={handleSubmit}
        className="p-3.5 bg-card/60 rounded-2xl border border-border/60 shadow-xs space-y-3"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Edit3 className="w-3.5 h-3.5 text-primary" />
            تدوين ملاحظة في هذا الدرس
          </span>
          {pinnedTime !== null ? (
            <div className="flex items-center gap-1.5">
              <Badge
                variant="secondary"
                className="gap-1 font-mono text-xs bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 cursor-pointer"
                onClick={handleUpdatePinnedTime}
                title="اضغط للتحديث إلى التوقيت الحالي"
              >
                <Clock className="w-3 h-3" />
                {formatSeconds(pinnedTime)}
              </Badge>
              <button
                type="button"
                onClick={handleClearPinnedTime}
                className="text-xs text-muted-foreground hover:text-foreground"
                title="إلغاء ربط التوقيت"
              >
                ×
              </button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleUpdatePinnedTime}
              className="h-6 text-[11px] text-muted-foreground hover:text-foreground gap-1 px-2"
            >
              <Clock className="w-3 h-3" />
              ربط بالتوقيت الحالي
            </Button>
          )}
        </div>

        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onFocus={handleInputFocus}
          placeholder="اكتب ملاحظتك هنا... سيتم ربط التوقيت تلقائياً بمجرد البدء بالكتابة"
          rows={3}
          maxLength={5000}
          className="resize-none text-xs rounded-xl border-border/60 bg-background/50 focus:bg-background transition-all"
        />

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-muted-foreground/80">
            {content.length}/5000 حرف
          </span>
          <Button
            type="submit"
            size="sm"
            disabled={!content.trim() || createNoteMutation.isPending}
            className="gap-1.5 text-xs font-bold rounded-xl gradient-cta text-white px-4 h-8"
          >
            <Send className="w-3.5 h-3.5 rtl:rotate-180" />
            <span>حفظ الملاحظة</span>
          </Button>
        </div>
      </form>

      {/* Notes List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-primary" />
            ملاحظاتي في هذا الدرس ({notes.length})
          </h4>
        </div>

        {isLoading ? (
          <div className="space-y-2.5">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : isError ? (
          <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-center text-xs text-destructive flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4" />
            تعذر تحميل الملاحظات حالياً.
          </div>
        ) : notes.length === 0 ? (
          <div className="p-6 rounded-2xl border border-dashed border-border/80 text-center space-y-2 bg-card/20">
            <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-xs font-medium text-muted-foreground">
              لا توجد ملاحظات مدونة في هذا الدرس بعد.
            </p>
            <p className="text-[11px] text-muted-foreground/70">
              اكتب ملاحظتك في الحقل أعلاه مع ربط التوقيت لتسهيل الرجوع للأجزاء الهامة لاحقاً.
            </p>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="group p-3 rounded-xl border border-border/60 bg-card/40 hover:bg-card/70 hover:border-border transition-all space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {note.timestamp_seconds !== null && note.timestamp_seconds !== undefined ? (
                    <button
                      type="button"
                      onClick={() => onSeek(note.timestamp_seconds!)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-mono text-[11px] font-bold transition-colors"
                      title="انقر للانتقال إلى هذا التوقيت في الفيديو"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      {formatSeconds(note.timestamp_seconds)}
                    </button>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      ملاحظة عامة
                    </Badge>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(note.created_at).toLocaleDateString("ar-EG", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(note.id)}
                  disabled={deleteNoteMutation.isPending}
                  className="w-6 h-6 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  title="حذف الملاحظة"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed select-text">
                {note.content}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
