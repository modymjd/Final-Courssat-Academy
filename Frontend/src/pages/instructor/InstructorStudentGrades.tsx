import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { useInstructorGrades, useUpdateGrade } from '@/features/instructor';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Edit, GraduationCap } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

function formatDateSafe(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "-" : format(d, 'dd MMMM yyyy', { locale: ar });
  } catch {
    return "-";
  }
}

const InstructorStudentGrades = () => {
  const { data: grades, isLoading } = useInstructorGrades();
  const { mutate: updateGrade, isPending: isUpdating } = useUpdateGrade();
  const [editingGrade, setEditingGrade] = useState<number | null>(null);

  const handleUpdateGrade = (id: number) => {
    updateGrade({ id, data: { status: 'published' } });
    setEditingGrade(null);
  };

  const gradeList = Array.isArray(grades) ? grades : [];

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4 dir-rtl" dir="rtl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 rounded-2xl border border-primary/20 shadow-sm">
          <div>
            <h1 className="text-2xl font-extrabold flex items-center gap-3 text-foreground">
              <GraduationCap className="w-8 h-8 text-primary" />
              تقييم درجات الطلاب
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              مراجعة نتائج الاختبارات والتكليفات، وتدقيق درجات الطلاب في دوراتك التعليمية.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="h-64 bg-muted animate-pulse rounded-2xl" />
        ) : gradeList.length === 0 ? (
          <div className="text-center py-16 bg-muted/20 border rounded-2xl">
            <Check className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-30" />
            <h3 className="text-xl font-bold mb-2">لا توجد تسليمات معلقة</h3>
            <p className="text-muted-foreground text-sm">لقد قمت بتقييم جميع التسليمات بنجاح أو لا توجد درجات مسجلة بعد.</p>
          </div>
        ) : (
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold">
                سجل درجات الطلاب ({gradeList.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Desktop View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>اسم الطالب</TableHead>
                      <TableHead>الدورة</TableHead>
                      <TableHead>التكليف / الاختبار</TableHead>
                      <TableHead>الدرجة</TableHead>
                      <TableHead>تاريخ التسليم</TableHead>
                      <TableHead className="text-center">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gradeList.map((grade) => (
                      <TableRow key={grade.id} className="hover:bg-muted/40">
                        <TableCell className="font-bold text-foreground">طالب #{grade.studentId}</TableCell>
                        <TableCell className="font-medium text-muted-foreground">{grade.courseName}</TableCell>
                        <TableCell>{grade.assignmentTitle || 'اختبار تقييمي'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{grade.score}</span>
                            <span className="text-muted-foreground text-xs">/ {grade.maxScore}</span>
                            <Badge
                              variant={grade.percentage >= 90 ? 'default' : grade.percentage >= 50 ? 'secondary' : 'destructive'}
                              className={grade.percentage >= 90 ? 'bg-emerald-600 text-white text-[10px]' : 'text-[10px]'}
                            >
                              {grade.percentage}%
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateSafe(grade.gradedAt)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 h-8 text-xs"
                            onClick={() => handleUpdateGrade(grade.id)}
                            disabled={isUpdating}
                          >
                            <Edit size={13} />
                            نشر الاعتماد
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden space-y-4">
                {gradeList.map((grade) => (
                  <div key={grade.id} className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm">طالب #{grade.studentId}</h4>
                        <p className="text-xs text-muted-foreground">{grade.courseName}</p>
                      </div>
                      <Badge
                        variant={grade.percentage >= 90 ? 'default' : grade.percentage >= 50 ? 'secondary' : 'destructive'}
                        className={grade.percentage >= 90 ? 'bg-emerald-600 text-white text-[11px]' : 'text-[11px]'}
                      >
                        {grade.percentage}% ({grade.score}/{grade.maxScore})
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      <span>{grade.assignmentTitle || 'اختبار تقييمي'}</span> &bull; <span>{formatDateSafe(grade.gradedAt)}</span>
                    </div>

                    <div className="pt-2 border-t border-border flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-9 text-xs w-full justify-center"
                        onClick={() => handleUpdateGrade(grade.id)}
                        disabled={isUpdating}
                      >
                        <Edit size={14} />
                        نشر الاعتماد
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default InstructorStudentGrades;
