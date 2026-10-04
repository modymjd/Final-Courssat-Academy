import React, { useState } from "react";
import {
  Users,
  Search,
  Download,
  AlertTriangle,
  RefreshCw,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCenterStudents } from "@/features/center";

function formatDateSafe(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("ar-EG");
  } catch {
    return "-";
  }
}

export default function CenterStudents() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: students = [], isLoading, isError, refetch } = useCenterStudents();

  const filteredStudents = students.filter(
    (s) =>
      s.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.student_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportCSV = () => {
    if (!filteredStudents || filteredStudents.length === 0) {
      return;
    }

    const headers = ["ID", "اسم الطالب", "البريد الإلكتروني", "تاريخ الانضمام", "الحالة"];
    const rows = filteredStudents.map((s) => [
      s.student_id,
      s.student_name || "طالب",
      s.student_email || "-",
      formatDateSafe(s.joined_at),
      s.is_active ? "نشط" : "غير نشط",
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `center_students_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 dir-rtl" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-blue-950/80 via-slate-900 to-indigo-950/80 p-6 rounded-2xl border border-blue-800/40 shadow-lg text-white">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-400" />
              إدارة طلاب السنتر
            </h1>
            <p className="text-blue-200 mt-1 text-sm md:text-base">
              متابعة الطلاب المنضمين للسنتر وإدارة حالاتهم.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleExportCSV}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-2"
            >
              <Download className="w-4 h-4" />
              تصدير CSV
            </Button>
          </div>
        </div>

        {/* Filter Controls */}
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="البحث باسم الطالب أو البريد الإلكتروني..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10 text-sm"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-2 shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
              تحديث
            </Button>
          </CardContent>
        </Card>

        {/* Main Table Container */}
        <Card className="border shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b py-3 px-6">
            <CardTitle className="text-lg font-bold flex items-center justify-between">
              <span>قائمة الطلاب ({filteredStudents.length})</span>
              {isLoading && <span className="text-sm font-normal text-blue-600 animate-pulse">جاري التحميل...</span>}
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading && (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded animate-pulse w-full" />
                ))}
              </div>
            )}

            {isError && !isLoading && (
              <div className="p-12 text-center space-y-4">
                <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">تعذر تحميل بيانات الطلاب</h3>
                <Button onClick={() => refetch()} className="gap-2 bg-blue-600 hover:bg-blue-700">
                  <RefreshCw className="w-4 h-4" />
                  إعادة المحاولة
                </Button>
              </div>
            )}

            {!isLoading && !isError && filteredStudents.length === 0 && (
              <div className="p-12 text-center space-y-4">
                <UserX className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto" />
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">لا يوجد طلاب</h3>
                <p className="text-gray-500 text-sm max-w-md mx-auto">
                  لم يتم العثور على طلاب مطابقين أو لم ينضم أي طالب للسنتر بعد.
                </p>
              </div>
            )}

            {!isLoading && !isError && filteredStudents.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                      <TableHead className="text-right">اسم الطالب</TableHead>
                      <TableHead className="text-right">البريد الإلكتروني</TableHead>
                      <TableHead className="text-right">تاريخ الانضمام</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => (
                      <TableRow key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                        <TableCell className="font-semibold text-gray-900 dark:text-gray-100">
                          {student.student_name || `طالب #${student.student_id}`}
                        </TableCell>
                        <TableCell className="text-gray-600 dark:text-gray-300 dir-ltr text-right">
                          {student.student_email || "غير متوفر"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {formatDateSafe(student.joined_at)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={student.is_active ? "default" : "secondary"}>
                            {student.is_active ? "نشط" : "غير نشط"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  );
}
