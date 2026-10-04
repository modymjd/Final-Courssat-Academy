import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useKanbanTasks,
  useAcademicTasks,
  useCreateAcademicTask,
  useUpdateAcademicTask,
  useDeleteAcademicTask,
} from "@/features/instructor";
import type { AcademicTask, TaskPriority, TaskStatus, TaskType } from "@/types";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  LayoutGrid,
  List,
  Trash2,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  User,
  GraduationCap,
  Calendar as CalendarIcon,
} from "lucide-react";

const PRIORITY_BADGES: Record<TaskPriority, { label: string; className: string }> = {
  URGENT: { label: "عاجلة جداً", className: "bg-red-500/15 text-red-600 border-red-500/30" },
  HIGH: { label: "عالية", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  MEDIUM: { label: "متوسطة", className: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  LOW: { label: "منخفضة", className: "bg-gray-500/15 text-gray-600 border-gray-500/30" },
};

const TASK_TYPE_ICONS: Record<TaskType, React.ReactNode> = {
  MANUAL: <CheckCircle2 size={14} className="text-primary" />,
  GRADING: <GraduationCap size={14} className="text-amber-500" />,
  BOOKING_REQUEST: <CalendarIcon size={14} className="text-emerald-500" />,
  UNANSWERED_QA: <BookOpen size={14} className="text-blue-500" />,
  AT_RISK_ALERT: <AlertTriangle size={14} className="text-red-500" />,
};

export default function InstructorTaskManager() {
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [taskType, setTaskType] = useState<TaskType>("MANUAL");

  const { data: kanbanData, isLoading: isKanbanLoading } = useKanbanTasks();
  const { data: listTasks, isLoading: isListLoading } = useAcademicTasks();

  const createMutation = useCreateAcademicTask();
  const updateMutation = useUpdateAcademicTask();
  const deleteMutation = useDeleteAcademicTask();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createMutation.mutate(
      { title, description, priority, task_type: taskType, status: "PENDING" },
      {
        onSuccess: () => {
          setTitle("");
          setDescription("");
          setIsCreateOpen(false);
        },
      }
    );
  };

  const handleStatusMove = (id: number, nextStatus: TaskStatus) => {
    updateMutation.mutate({ id, data: { status: nextStatus } });
  };

  const filterByPriority = (tasks?: AcademicTask[]) => {
    if (!tasks || !Array.isArray(tasks)) return [];
    if (priorityFilter === "ALL") return tasks;
    return tasks.filter((t) => t.priority === priorityFilter);
  };


  const isLoading = viewMode === "kanban" ? isKanbanLoading : isListLoading;

  return (
    <Layout>
      <div className="container mx-auto px-3 sm:px-6 py-6 sm:py-8 dir-rtl space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              منظّم المهام الأكاديمية 📋
            </h1>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
              إدارة المهام الأكاديمية والتصحيح وتنبيهات التعثر بنظام القوائم والـ Kanban
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className="bg-muted p-1 rounded-xl flex items-center gap-1 border border-border/50">
              <Button
                variant={viewMode === "kanban" ? "default" : "ghost"}
                size="sm"
                className="h-8 rounded-lg text-xs font-bold gap-1"
                onClick={() => setViewMode("kanban")}
              >
                <LayoutGrid size={14} />
                <span>Kanban</span>
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                className="h-8 rounded-lg text-xs font-bold gap-1"
                onClick={() => setViewMode("list")}
              >
                <List size={14} />
                <span>قائمة</span>
              </Button>
            </div>

            {/* Create Task Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-cta text-white font-bold text-xs gap-1.5 rounded-xl">
                  <Plus size={16} />
                  <span>مهمة جديدة</span>
                </Button>
              </DialogTrigger>
              <DialogContent size="md" className="dir-rtl" dir="rtl">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold">إضافة مهمة أكاديمية جديدة</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="flex-1 overflow-y-auto overscroll-contain space-y-4 pt-2 custom-scrollbar">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground">عنوان المهمة</label>
                    <Input
                      placeholder="مثال: تصحيح واجب الفصل الثاني"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground">الوصف / ملاحظات</label>
                    <Textarea
                      placeholder="ملاحظات تفصيلية حول المهمة..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="rounded-xl"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground">الأولوية</label>
                      <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOW">منخفضة</SelectItem>
                          <SelectItem value="MEDIUM">متوسطة</SelectItem>
                          <SelectItem value="HIGH">عالية</SelectItem>
                          <SelectItem value="URGENT">عاجلة جداً</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground">نوع المهمة</label>
                      <Select value={taskType} onValueChange={(v) => setTaskType(v as TaskType)}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MANUAL">يدوية</SelectItem>
                          <SelectItem value="GRADING">تصحيح</SelectItem>
                          <SelectItem value="BOOKING_REQUEST">حجز جلسة</SelectItem>
                          <SelectItem value="UNANSWERED_QA">سؤال طالب</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11 gradient-cta text-white font-bold mt-2 rounded-xl"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? "جاري الإضافة..." : "حفظ المهمة"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Priority Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <span className="text-xs font-bold text-muted-foreground shrink-0">تصفية حسب الأولوية:</span>
          {["ALL", "URGENT", "HIGH", "MEDIUM", "LOW"].map((p) => (
            <Button
              key={p}
              variant={priorityFilter === p ? "default" : "outline"}
              size="sm"
              className="rounded-xl text-xs shrink-0 h-7 px-3"
              onClick={() => setPriorityFilter(p)}
            >
              {p === "ALL" ? "الكل" : PRIORITY_BADGES[p as TaskPriority]?.label}
            </Button>
          ))}
        </div>

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-muted animate-pulse rounded-2xl" />
            ))}
          </div>
        )}

        {/* KANBAN VIEW */}
        {!isLoading && viewMode === "kanban" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Column 1: Pending */}
            <KanbanColumn
              title="قيد الانتظار"
              badgeColor="bg-amber-500/10 text-amber-600"
              tasks={filterByPriority(kanbanData?.pending)}
              onMove={handleStatusMove}
              onDelete={(id) => deleteMutation.mutate(id)}
              currentStatus="PENDING"
            />
            {/* Column 2: In Progress */}
            <KanbanColumn
              title="جاري التنفيذ"
              badgeColor="bg-blue-500/10 text-blue-600"
              tasks={filterByPriority(kanbanData?.in_progress)}
              onMove={handleStatusMove}
              onDelete={(id) => deleteMutation.mutate(id)}
              currentStatus="IN_PROGRESS"
            />
            {/* Column 3: Completed */}
            <KanbanColumn
              title="مكتملة"
              badgeColor="bg-emerald-500/10 text-emerald-600"
              tasks={filterByPriority(kanbanData?.completed)}
              onMove={handleStatusMove}
              onDelete={(id) => deleteMutation.mutate(id)}
              currentStatus="COMPLETED"
            />
          </div>
        )}

        {/* LIST VIEW */}
        {!isLoading && viewMode === "list" && (
          <Card className="border-border/60 rounded-2xl overflow-hidden shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">قائمة المهام ({filterByPriority(listTasks).length})</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border/40">
              {filterByPriority(listTasks).length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-8">لا توجد مهام مطابقة للمحددات</p>
              ) : (
                filterByPriority(listTasks).map((task) => (
                  <div key={task.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 rounded-full mt-0.5"
                        onClick={() =>
                          handleStatusMove(
                            task.id,
                            task.status === "COMPLETED" ? "PENDING" : "COMPLETED"
                          )
                        }
                      >
                        <CheckCircle2
                          size={18}
                          className={task.status === "COMPLETED" ? "text-emerald-500 fill-emerald-500/20" : "text-muted-foreground"}
                        />
                      </Button>
                      <div>
                        <h4 className={`text-sm font-semibold leading-tight ${task.status === "COMPLETED" ? "line-through text-muted-foreground" : ""}`}>
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            {TASK_TYPE_ICONS[task.task_type]}
                            <span>{task.task_type}</span>
                          </span>
                          {task.course_title && (
                            <span className="flex items-center gap-1">
                              <BookOpen size={12} />
                              <span>{task.course_title}</span>
                            </span>
                          )}
                          {task.student_name && (
                            <span className="flex items-center gap-1">
                              <User size={12} />
                              <span>{task.student_name}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={`text-[10px] ${PRIORITY_BADGES[task.priority]?.className}`}>
                        {PRIORITY_BADGES[task.priority]?.label}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-red-500 rounded-lg"
                        onClick={() => deleteMutation.mutate(task.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

function KanbanColumn({
  title,
  badgeColor,
  tasks = [],
  onMove,
  onDelete,
  currentStatus,
}: {
  title: string;
  badgeColor: string;
  tasks: AcademicTask[];
  onMove: (id: number, nextStatus: TaskStatus) => void;
  onDelete: (id: number) => void;
  currentStatus: TaskStatus;
}) {
  return (
    <div className="bg-muted/40 p-3 sm:p-4 rounded-2xl border border-border/50 min-h-[450px] flex flex-col">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-sm">{title}</h3>
          <Badge className={`text-[10px] px-2 rounded-full font-bold ${badgeColor}`}>
            {tasks.length}
          </Badge>
        </div>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="border border-dashed border-border/70 rounded-xl p-6 text-center text-xs text-muted-foreground">
            لا توجد مهام
          </div>
        ) : (
          tasks.map((task) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card p-3.5 rounded-xl border border-border/60 shadow-sm space-y-2.5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-semibold text-xs sm:text-sm leading-snug line-clamp-2">
                  {task.title}
                </h4>
                <Badge variant="outline" className={`text-[10px] shrink-0 ${PRIORITY_BADGES[task.priority]?.className}`}>
                  {PRIORITY_BADGES[task.priority]?.label}
                </Badge>
              </div>

              {task.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {task.description}
                </p>
              )}

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1 border-t border-border/30 flex-wrap">
                <span className="flex items-center gap-1">
                  {TASK_TYPE_ICONS[task.task_type]}
                </span>
                {task.course_title && (
                  <span className="truncate max-w-[120px] font-medium text-foreground">
                    {task.course_title}
                  </span>
                )}
              </div>

              {/* Status Action Controls */}
              <div className="flex items-center justify-between pt-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-red-500 rounded-lg"
                  onClick={() => onDelete(task.id)}
                >
                  <Trash2 size={13} />
                </Button>

                <div className="flex items-center gap-1">
                  {currentStatus !== "PENDING" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] px-2 rounded-lg gap-1"
                      onClick={() => onMove(task.id, currentStatus === "COMPLETED" ? "IN_PROGRESS" : "PENDING")}
                    >
                      <ArrowRight size={12} />
                      <span>سابق</span>
                    </Button>
                  )}
                  {currentStatus !== "COMPLETED" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] px-2 rounded-lg gap-1"
                      onClick={() => onMove(task.id, currentStatus === "PENDING" ? "IN_PROGRESS" : "COMPLETED")}
                    >
                      <span>التالي</span>
                      <ArrowLeft size={12} />
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
