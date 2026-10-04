import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Plus,
  BookOpen,
  FileText,
  KeyRound,
  ClipboardList,
  DollarSign,
  Users,
  ChevronDown,
} from "lucide-react";

interface InstructorHeaderProps {
  userName?: string;
}

export const InstructorHeader: React.FC<InstructorHeaderProps> = ({ userName }) => {
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "صباح الخير" : "مساء الخير";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent p-4 sm:p-6 rounded-3xl border border-primary/20 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Badge className="bg-primary/15 text-primary hover:bg-primary/20 border-primary/30 text-xs px-2.5 py-0.5 font-medium rounded-full">
            مركز القيادة الأكاديمي 🚀
          </Badge>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            • المنظومة التعليمية الذكية
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-foreground">
          {greeting}، د. {userName || "المحاضر"} 👨‍🏫
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          إليك ملخص اليوم الأكاديمي، متابعة الطلاب، أوراق التصحيح، ومؤشرات الأداء المالي
        </p>
      </div>

      <div className="flex items-center gap-2.5 self-start md:self-auto">
        <Button
          asChild
          className="gradient-cta text-white font-bold text-xs sm:text-sm rounded-2xl shadow-sm hover:shadow-md transition-all gap-1.5"
        >
          <Link to="/instructor/courses/new">
            <Plus size={16} />
            <span>دورة جديدة</span>
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="bg-card font-bold text-xs sm:text-sm rounded-2xl border-border/80 hover:bg-muted/50 gap-1.5 shadow-sm"
            >
              <Zap size={16} className="text-amber-500 fill-amber-500" />
              <span>إجراء سريع</span>
              <ChevronDown size={14} className="text-muted-foreground mr-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-2xl p-1.5 shadow-xl border-border/70">
            <DropdownMenuLabel className="text-xs font-bold text-muted-foreground px-2 py-1.5">
              روابط العمليات السريعة
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
              <Link to="/instructor/courses/new" className="flex items-center gap-2.5 py-2">
                <BookOpen size={16} className="text-primary" />
                <span className="font-semibold text-xs">إنشاء كورس جديد</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
              <Link to="/instructor/exams/builder" className="flex items-center gap-2.5 py-2">
                <FileText size={16} className="text-indigo-500" />
                <span className="font-semibold text-xs">بناء اختبار أو واجب</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
              <Link to="/instructor/activation-codes" className="flex items-center gap-2.5 py-2">
                <KeyRound size={16} className="text-amber-500" />
                <span className="font-semibold text-xs">توليد أكواد التفعيل</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
              <Link to="/instructor/tasks" className="flex items-center gap-2.5 py-2">
                <ClipboardList size={16} className="text-emerald-500" />
                <span className="font-semibold text-xs">منظم المهام والكانبان</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
              <Link to="/instructor/students" className="flex items-center gap-2.5 py-2">
                <Users size={16} className="text-blue-500" />
                <span className="font-semibold text-xs">سجل وقائمة الطلاب</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
              <Link to="/instructor/earnings" className="flex items-center gap-2.5 py-2">
                <DollarSign size={16} className="text-emerald-600" />
                <span className="font-semibold text-xs">المحفظة وسحب الأرباح</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
};

export default InstructorHeader;
