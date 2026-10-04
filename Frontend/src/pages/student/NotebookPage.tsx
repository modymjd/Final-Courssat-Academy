import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Plus, Trash2, Tag, Download, LayoutList, LayoutGrid,
  ArrowRight, Code, CheckSquare, AlignLeft, Video, ArrowUp, ArrowDown,
  BookOpen, X, Menu, Search, Sparkles
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FeatureGate } from "@/components/FeatureGate";
import { useEnrollments } from "@/features/courses/hooks";
import {
  useStudentNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  useBulkImportNotes,
} from "@/features/courses/hooks/useNotes";
import type { StudentNoteCreateInput } from "@/types/note";

interface NoteBlock {
  id: string;
  type: "heading" | "text" | "checklist" | "code" | "timestamp";
  content: string;
  timestampSeconds?: number;
  checked?: boolean;
}

interface NoteItem {
  id: string;
  serverId?: number;
  courseId?: number | null;
  lessonId?: number | null;
  title: string;
  courseName: string;
  tags: string[];
  updatedAt: string;
  blocks: NoteBlock[];
  isPinned?: boolean;
}

const formatSecondsToMMSS = (seconds: number = 0) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const parseMMSSToSeconds = (str: string) => {
  if (!str) return 0;
  const parts = str.split(':').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  const parsedInt = parseInt(str, 10);
  return isNaN(parsedInt) ? 0 : parsedInt;
};

import { useAuth } from "@/features/auth";

export const NotebookPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const storageKey = user?.id ? `edusmart_student_notebook_${user.id}` : "edusmart_student_notebook";

  // Backend Notes API Integration
  const { data: remoteNotesData } = useStudentNotes({ pageSize: 100 });
  const createNoteMutation = useCreateNote();
  const updateNoteMutation = useUpdateNote();
  const deleteNoteMutation = useDeleteNote();
  const bulkImportMutation = useBulkImportNotes();

  // Local storage persistence fallback
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [activeNoteId, setActiveNoteId] = useState<string>(notes[0]?.id || "note-1");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourseFilter, setSelectedCourseFilter] = useState("all");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const migrationAttemptedRef = useRef(false);

  // Background Fail-Safe Migration from localStorage to Backend
  useEffect(() => {
    if (!user?.id || migrationAttemptedRef.current) return;

    const rawLocal = localStorage.getItem(storageKey);
    if (!rawLocal) return;

    let localNotes: NoteItem[] = [];
    try {
      localNotes = JSON.parse(rawLocal);
    } catch {
      return;
    }

    if (!Array.isArray(localNotes) || localNotes.length === 0) return;

    migrationAttemptedRef.current = true;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const payloadNotes: StudentNoteCreateInput[] = localNotes.map((n) => {
      let clientId = n.id;
      if (!uuidRegex.test(clientId)) {
        clientId = crypto.randomUUID();
      }

      const textContent = (n.blocks || [])
        .filter((b) => b.type === "text" || b.type === "heading")
        .map((b) => b.content)
        .join("\n\n")
        .slice(0, 5000);

      return {
        client_id: clientId,
        title: (n.title || "ملاحظة بدون عنوان").slice(0, 255),
        content: textContent || n.title || "",
        tags: n.tags || [],
        blocks: n.blocks || [],
        is_pinned: false,
      };
    });

    bulkImportMutation.mutate(payloadNotes, {
      onSuccess: () => {
        // Fail-safe: only rename to backup after 200 OK
        localStorage.setItem(`${storageKey}_migrated_backup`, rawLocal);
        localStorage.removeItem(storageKey);
      },
      onError: (err) => {
        // If error, local storage is untouched and will retry next visit!
        console.warn("Failed to migrate local notes to backend:", err);
      },
    });
  }, [user?.id, storageKey, bulkImportMutation]);

  // Synchronize remote notes to local state when loaded.
  // The backend is the source of truth; never inject placeholder/demo notes.
  useEffect(() => {
    if (remoteNotesData?.data) {
      const mappedNotes: NoteItem[] = remoteNotesData.data.map((n) => {
        const blocks: NoteBlock[] =
          n.blocks && Array.isArray(n.blocks) && n.blocks.length > 0
            ? (n.blocks as NoteBlock[])
            : [
                {
                  id: "b-1",
                  type: "text",
                  content: n.content || "لا يوجد محتوى",
                },
              ];

        return {
          id: String(n.id),
          serverId: n.id,
          courseId: n.course_id,
          lessonId: n.lesson_id,
          title: n.title,
          courseName: n.course_title || "عام",
          tags: n.tags || [],
          updatedAt: new Date(n.updated_at || n.created_at).toLocaleDateString("ar-EG"),
          blocks,
          isPinned: n.is_pinned,
        };
      });

      setNotes(mappedNotes);
      if (!mappedNotes.some((n) => n.id === activeNoteId)) {
        setActiveNoteId(mappedNotes[0]?.id || "");
      }
    }
  }, [remoteNotesData]);

  // Real Backend Enrollments API Integration
  const { data: enrollmentsRaw } = useEnrollments();
  const enrollmentsList = useMemo(() => {
    if (Array.isArray(enrollmentsRaw)) return enrollmentsRaw;
    return (enrollmentsRaw as any)?.results || (enrollmentsRaw as any)?.data || [];
  }, [enrollmentsRaw]);

  const enrolledCourseTitles = useMemo(() => {
    return (enrollmentsList || [])
      .map((e: any) => e.course_title || e.course?.title || e.courseTitle)
      .filter(Boolean);
  }, [enrollmentsList]);

  const availableCourses: string[] = useMemo(() => {
    return enrolledCourseTitles.length > 0
      ? (Array.from(new Set([...enrolledCourseTitles, "عام"])) as string[])
      : ["عام"];
  }, [enrolledCourseTitles]);

  const activeNote = notes.find((n) => n.id === activeNoteId) || notes[0];

  // Debounced backend update sync
  const updateTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  const syncNoteToBackend = useCallback(
    (note: NoteItem) => {
      const serverId = note.serverId ?? (Number(note.id) > 0 ? Number(note.id) : undefined);
      if (!serverId || isNaN(serverId)) return;

      if (updateTimeoutRef.current[note.id]) {
        clearTimeout(updateTimeoutRef.current[note.id]);
      }

      updateTimeoutRef.current[note.id] = setTimeout(() => {
        const textContent = (note.blocks || [])
          .filter((b) => b.type === "text" || b.type === "heading")
          .map((b) => b.content)
          .join("\n\n")
          .slice(0, 5000);

        updateNoteMutation.mutate({
          id: serverId,
          data: {
            title: (note.title || "ملاحظة بدون عنوان").slice(0, 255),
            content: textContent,
            tags: note.tags,
            blocks: note.blocks,
          },
        });
      }, 800);
    },
    [updateNoteMutation]
  );

  // Note CRUD
  const handleCreateNote = async () => {
    const tempId = "temp-" + Date.now();
    const newBlock: NoteBlock = {
      id: "b-init",
      type: "text",
      content: "ابدأ تدوين أفكارك وملاحظاتك هنا...",
    };
    const newNote: NoteItem = {
      id: tempId,
      title: "ملاحظة جديدة بدون عنوان",
      courseName: "عام",
      tags: ["ملاحظة_جديدة"],
      updatedAt: "الآن",
      blocks: [newBlock],
    };

    setNotes((prev) => [newNote, ...prev]);
    setActiveNoteId(tempId);
    setIsMobileSidebarOpen(false);

    try {
      const created = await createNoteMutation.mutateAsync({
        client_id: crypto.randomUUID(),
        title: newNote.title,
        content: newBlock.content,
        tags: newNote.tags,
        blocks: newNote.blocks,
      });

      setNotes((prev) =>
        prev.map((n) =>
          n.id === tempId
            ? {
                ...n,
                id: String(created.id),
                serverId: created.id,
              }
            : n
        )
      );
      setActiveNoteId(String(created.id));
    } catch {
      // Local fallback remains active
    }
  };

  const handleDeleteNote = async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (notes.length <= 1) return;

    const targetNote = notes.find((n) => n.id === noteId);
    const filtered = notes.filter((n) => n.id !== noteId);
    setNotes(filtered);
    if (activeNoteId === noteId) {
      setActiveNoteId(filtered[0]?.id || "");
    }

    const serverId = targetNote?.serverId ?? (Number(noteId) > 0 ? Number(noteId) : undefined);
    if (serverId && !isNaN(serverId)) {
      try {
        await deleteNoteMutation.mutateAsync(serverId);
      } catch {
        // Handled
      }
    }
  };

  const handleUpdateNoteMeta = (field: "title" | "courseName" | "tags", value: any) => {
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== activeNoteId) return n;
        const updated = { ...n, [field]: value, updatedAt: "الآن" };
        syncNoteToBackend(updated);
        return updated;
      })
    );
  };

  // Block CRUD & Reordering
  const handleAddBlock = (type: NoteBlock["type"]) => {
    if (!activeNote) return;
    const newBlock: NoteBlock = {
      id: "b-" + Date.now(),
      type,
      content:
        type === "heading"
          ? "عنوان فرعي جديد"
          : type === "checklist"
          ? "مهمة دراسية جديدة"
          : "نص جديد...",
      timestampSeconds: type === "timestamp" ? 120 : undefined,
    };

    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== activeNoteId) return n;
        const updated = { ...n, blocks: [...n.blocks, newBlock] };
        syncNoteToBackend(updated);
        return updated;
      })
    );
  };

  const handleUpdateBlock = (blockId: string, content: string, checked?: boolean) => {
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== activeNoteId) return n;
        const updated = {
          ...n,
          blocks: n.blocks.map((b) =>
            b.id === blockId ? { ...b, content, checked: checked ?? b.checked } : b
          ),
        };
        syncNoteToBackend(updated);
        return updated;
      })
    );
  };

  const handleDeleteBlock = (blockId: string) => {
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== activeNoteId) return n;
        const updated = {
          ...n,
          blocks: n.blocks.filter((b) => b.id !== blockId),
        };
        syncNoteToBackend(updated);
        return updated;
      })
    );
  };

  const handleMoveBlock = (index: number, direction: "up" | "down") => {
    if (!activeNote) return;
    const blocks = [...activeNote.blocks];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;

    const temp = blocks[index];
    blocks[index] = blocks[targetIndex];
    blocks[targetIndex] = temp;

    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== activeNoteId) return n;
        const updated = { ...n, blocks };
        syncNoteToBackend(updated);
        return updated;
      })
    );
  };

  const handleExportPDF = () => {
    window.print();
  };

  const filteredNotes = notes.filter(n => {
    const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCourse = selectedCourseFilter === "all" || n.courseName === selectedCourseFilter;
    return matchesSearch && matchesCourse;
  });

  return (
    <FeatureGate feature="notes">
      <div className="min-h-screen bg-background text-foreground flex flex-col dir-rtl font-sans selection:bg-primary/20">
        {/* Header Bar - Fully Responsive for Mobile & Desktop */}
        <header className="border-b border-border/60 bg-card/80 backdrop-blur-xl px-3 sm:px-6 py-2.5 flex items-center justify-between sticky top-0 z-30 non-printable">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button size="icon" variant="ghost" className="md:hidden rounded-xl h-9 w-9 shrink-0" onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}>
              <Menu className="w-5 h-5 text-primary" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-1 text-xs text-muted-foreground hover:text-foreground px-2">
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              <span className="hidden sm:inline">الرئيسية</span>
            </Button>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <h1 className="font-bold text-sm sm:text-base md:text-lg line-clamp-1">الدفتر الذكي</h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* View Switcher: List / Grid */}
            <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border/50">
              <button
                onClick={() => setViewMode("list")}
                title="عرض القائمة"
                className={`p-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === "list"
                    ? "bg-background text-primary shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                title="عرض الشبكة (Grid)"
                className={`p-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === "grid"
                    ? "bg-background text-primary shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            <Button size="sm" onClick={handleExportPDF} variant="outline" className="gap-1 text-xs rounded-xl hidden sm:flex px-3">
              <Download className="w-3.5 h-3.5" />
              <span>تصدير PDF</span>
            </Button>

            <Button size="sm" onClick={handleCreateNote} className="gap-1.5 gradient-cta text-white shadow-md rounded-xl text-xs font-bold px-3">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">ملاحظة جديدة</span>
              <span className="sm:hidden">جديدة</span>
            </Button>
          </div>
        </header>

        {/* Workspace Layout */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Mobile Sidebar Slide-over Drawer Backdrop */}
          <AnimatePresence>
            {isMobileSidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 md:hidden"
                onClick={() => setIsMobileSidebarOpen(false)}
              />
            )}
          </AnimatePresence>

          {/* Sidebar Note List */}
          <aside className={`w-80 border-r border-border/60 bg-card/40 p-4 space-y-4 flex flex-col shrink-0 non-printable transition-all duration-200 ${
            isMobileSidebarOpen
              ? "fixed inset-y-0 right-0 z-50 bg-background shadow-2xl w-80 max-w-[85vw]"
              : "hidden md:flex"
          }`}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" />
                الملاحظات ({notes.length})
              </h2>
              {isMobileSidebarOpen && (
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => setIsMobileSidebarOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="بحث..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-background/80 text-xs rounded-xl border-border/60 pr-8"
              />
            </div>

            <select
              value={selectedCourseFilter}
              onChange={e => setSelectedCourseFilter(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-border/60 bg-background text-foreground outline-none cursor-pointer"
            >
              <option value="all">كافة المواد المربوطة</option>
              {availableCourses.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
              {filteredNotes.map(n => (
                <Card
                  key={n.id}
                  onClick={() => {
                    setActiveNoteId(n.id);
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`p-3.5 cursor-pointer transition-all duration-150 rounded-2xl border relative group ${
                    n.id === activeNoteId
                      ? "bg-primary/10 border-primary shadow-xs"
                      : "hover:bg-muted/40 border-border/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-xs leading-snug line-clamp-1 text-foreground">{n.title}</p>
                    <button
                      onClick={e => handleDeleteNote(n.id, e)}
                      title="حذف الملاحظة"
                      className="md:opacity-0 md:group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity p-1 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-2.5 text-[10px] text-muted-foreground">
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md font-semibold">{n.courseName}</span>
                    <span>{n.updatedAt}</span>
                  </div>
                </Card>
              ))}
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8">
            {viewMode === "grid" ? (
              /* Grid View Mode */
              <div className="max-w-6xl mx-auto space-y-6 non-printable">
                <div className="flex items-center justify-between border-b pb-4">
                  <h2 className="font-bold text-base sm:text-lg">كافة الملاحظات (عرض الشبكة)</h2>
                  <Button size="sm" onClick={() => setViewMode("list")} variant="outline" className="text-xs gap-1.5 rounded-xl">
                    <LayoutList className="w-3.5 h-3.5" /> العودة للمحرر
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredNotes.map(n => (
                    <Card
                      key={n.id}
                      onClick={() => {
                        setActiveNoteId(n.id);
                        setViewMode("list");
                      }}
                      className="p-5 cursor-pointer hover:border-primary transition-all duration-200 rounded-2xl flex flex-col justify-between space-y-4 shadow-xs group"
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <h3 className="font-bold text-sm leading-snug">{n.title}</h3>
                          <button
                            onClick={e => handleDeleteNote(n.id, e)}
                            className="text-muted-foreground hover:text-destructive md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                          {n.blocks.map(b => b.content).join(" ")}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t pt-3 text-[11px] text-muted-foreground">
                        <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                          {n.courseName}
                        </Badge>
                        <span>{n.updatedAt}</span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              /* Active Note Block Canvas Editor & Printable Area */
              activeNote && (
                <div className="max-w-4xl mx-auto space-y-6 printable-note-area pb-20 sm:pb-8">
                  {/* Mobile Drawer Trigger Bar on active note */}
                  <div className="md:hidden flex items-center justify-between p-2.5 bg-muted/40 rounded-2xl border border-border/50 text-xs font-semibold non-printable">
                    <button
                      onClick={() => setIsMobileSidebarOpen(true)}
                      className="flex items-center gap-2 text-primary font-bold hover:underline"
                    >
                      <Menu className="w-4 h-4" />
                      <span>قائمة الملاحظات ({notes.length})</span>
                    </button>
                    <span className="text-[11px] text-muted-foreground line-clamp-1 max-w-[160px]">{activeNote.title}</span>
                  </div>

                  {/* Note Meta Header */}
                  <div className="space-y-4 border-b border-border/60 pb-6 non-printable">
                    <input
                      type="text"
                      value={activeNote.title}
                      onChange={e => handleUpdateNoteMeta("title", e.target.value)}
                      placeholder="عنوان الملاحظة..."
                      className="w-full text-xl sm:text-2xl md:text-3xl font-extrabold bg-transparent outline-none text-foreground border-b border-transparent focus:border-border py-1"
                    />

                    {/* Course Link Selector & Tags */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 text-xs">
                      <div className="flex items-center gap-1.5 bg-muted/50 px-3 py-2 rounded-xl border border-border/60 w-full sm:w-auto">
                        <BookOpen className="w-4 h-4 text-primary shrink-0" />
                        <span className="font-semibold text-muted-foreground shrink-0">المادة:</span>
                        <select
                          value={activeNote.courseName}
                          onChange={e => handleUpdateNoteMeta("courseName", e.target.value)}
                          className="bg-transparent outline-none font-bold text-primary cursor-pointer w-full"
                        >
                          {availableCourses.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-1.5 bg-muted/50 px-3 py-2 rounded-xl border border-border/60 w-full sm:w-auto">
                        <Tag className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="font-semibold text-muted-foreground shrink-0">الوسوم:</span>
                        <input
                          type="text"
                          value={activeNote.tags.join(", ")}
                          onChange={e => handleUpdateNoteMeta("tags", e.target.value.split(",").map(t => t.trim()))}
                          className="bg-transparent outline-none font-medium w-full"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Print-Only Pure Header */}
                  <div className="hidden print:block border-b-2 border-primary pb-4 mb-6">
                    <h1 className="text-2xl font-bold">{activeNote.title}</h1>
                    <div className="flex gap-4 text-xs text-slate-600 mt-2">
                      <span>المادة: {activeNote.courseName}</span>
                      <span>الوسوم: {activeNote.tags.join(", ")}</span>
                    </div>
                  </div>

                  {/* Touch-Optimized Horizontal Scroll Block Add Toolbar */}
                  <div className="space-y-2 non-printable">
                    <span className="text-xs font-semibold text-muted-foreground block">إضافة عنصر محتوى:</span>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none touch-pan-x">
                      <Button size="sm" variant="outline" onClick={() => handleAddBlock("text")} className="gap-1.5 text-xs rounded-xl shrink-0">
                        <AlignLeft className="w-3.5 h-3.5 text-primary" /> نص
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleAddBlock("heading")} className="gap-1.5 text-xs rounded-xl font-bold shrink-0">
                        عنوان فرعي
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleAddBlock("checklist")} className="gap-1.5 text-xs rounded-xl shrink-0">
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-500" /> قائمة مهمات
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleAddBlock("timestamp")} className="gap-1.5 text-xs rounded-xl text-amber-600 border-amber-500/30 shrink-0">
                        <Video className="w-3.5 h-3.5" /> تايم ستاب فيديو
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleAddBlock("code")} className="gap-1.5 text-xs rounded-xl font-mono shrink-0">
                        <Code className="w-3.5 h-3.5 text-blue-500" /> كود برمجي
                      </Button>
                    </div>
                  </div>

                  {/* Dynamic Blocks Container */}
                  <div className="space-y-4">
                    {activeNote.blocks.map((block, index) => (
                      <div key={block.id} className="group relative flex items-start gap-2 p-2 sm:p-2.5 rounded-2xl transition-all border border-transparent hover:border-border/50 hover:bg-muted/20">
                        {/* Always Visible Touch Reordering & Delete Actions on Mobile */}
                        <div className="flex flex-col items-center gap-1 pt-1 shrink-0 non-printable md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleMoveBlock(index, "up")}
                            disabled={index === 0}
                            title="تحريك لأعلى"
                            className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-20 active:scale-95"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleMoveBlock(index, "down")}
                            disabled={index === activeNote.blocks.length - 1}
                            title="تحريك لأسفل"
                            className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-20 active:scale-95"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteBlock(block.id)}
                            title="حذف العنصر"
                            className="p-1.5 text-muted-foreground hover:text-destructive active:scale-95"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Block Content Renderers */}
                        <div className="flex-1 min-w-0">
                          {block.type === "heading" && (
                            <input
                              type="text"
                              value={block.content}
                              onChange={e => handleUpdateBlock(block.id, e.target.value)}
                              className="w-full text-base sm:text-lg md:text-xl font-bold bg-transparent outline-none border-b border-transparent focus:border-border/60 py-1"
                            />
                          )}

                          {block.type === "text" && (
                            <textarea
                              value={block.content}
                              onChange={e => handleUpdateBlock(block.id, e.target.value)}
                              rows={2}
                              className="w-full text-xs sm:text-sm bg-transparent outline-none resize-none py-1 text-foreground leading-relaxed"
                            />
                          )}

                          {block.type === "checklist" && (
                            <div className="flex items-center gap-2.5 w-full">
                              <input
                                type="checkbox"
                                checked={block.checked}
                                onChange={e => handleUpdateBlock(block.id, block.content, e.target.checked)}
                                className="w-5 h-5 rounded border-border accent-primary cursor-pointer shrink-0"
                              />
                              <input
                                type="text"
                                value={block.content}
                                onChange={e => handleUpdateBlock(block.id, e.target.value)}
                                className={`w-full text-xs sm:text-sm bg-transparent outline-none ${block.checked ? "line-through text-muted-foreground" : ""}`}
                              />
                            </div>
                          )}

                          {block.type === "timestamp" && (
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl text-xs font-medium text-amber-700 dark:text-amber-400 w-full">
                              <div className="flex items-center gap-2 flex-1">
                                <Video className="w-4 h-4 shrink-0 text-amber-600" />
                                <input
                                  type="text"
                                  value={block.content}
                                  onChange={e => handleUpdateBlock(block.id, e.target.value)}
                                  placeholder="ملاحظة الفيديو..."
                                  className="bg-transparent outline-none w-full text-xs font-semibold"
                                />
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 border-t sm:border-t-0 sm:border-r border-amber-500/20 pt-2 sm:pt-0 sm:pr-3">
                                {/* Editable Time Input (mm:ss) */}
                                <input
                                  type="text"
                                  value={formatSecondsToMMSS(block.timestampSeconds || 0)}
                                  onChange={e => {
                                    const secs = parseMMSSToSeconds(e.target.value);
                                    setNotes(prev => prev.map(n => {
                                      if (n.id !== activeNoteId) return n;
                                      const updated = {
                                        ...n,
                                        blocks: n.blocks.map(b => b.id === block.id ? { ...b, timestampSeconds: secs } : b)
                                      };
                                      syncNoteToBackend(updated);
                                      return updated;
                                    }));
                                  }}
                                  title="تعديل وقت التايم ستاب (دقيقة:ثانية)"
                                  className="w-14 text-center font-mono text-xs bg-background/80 border border-amber-500/30 rounded-lg py-1 px-1 font-bold text-amber-900 dark:text-amber-200 outline-none focus:border-amber-600"
                                />

                                {/* Interactive Video Jump Link Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const time = block.timestampSeconds || 0;
                                    if (activeNote.courseId && activeNote.lessonId) {
                                      navigate(`/course/${activeNote.courseId}/lesson/${activeNote.lessonId}?t=${time}`);
                                    } else {
                                      navigate(`/dashboard`);
                                    }
                                  }}
                                  title={`▶ انقر للانتقال المباشر للفيديو عند الدقيقة ${formatSecondsToMMSS(block.timestampSeconds || 0)}`}
                                  className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded-lg font-mono text-xs font-bold shadow-xs transition-transform active:scale-95 cursor-pointer"
                                >
                                  <span>▶</span>
                                  <span>{formatSecondsToMMSS(block.timestampSeconds || 0)}</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {block.type === "code" && (
                            <textarea
                              value={block.content}
                              onChange={e => handleUpdateBlock(block.id, e.target.value)}
                              rows={4}
                              className="w-full font-mono text-xs p-3 bg-card border border-border/80 rounded-xl outline-none text-emerald-500 dark:text-emerald-400"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </main>
        </div>

        {/* Mobile Floating Action Button (FAB) for instant note creation */}
        <div className="fixed bottom-6 left-6 z-30 md:hidden non-printable">
          <Button
            size="icon"
            onClick={handleCreateNote}
            className="w-13 h-13 rounded-full gradient-cta text-white shadow-2xl shadow-primary/40 flex items-center justify-center active:scale-90 transition-transform"
            aria-label="ملاحظة جديدة"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </FeatureGate>
  );
};

export default NotebookPage;
