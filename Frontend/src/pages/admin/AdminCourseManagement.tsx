import React from 'react';
import Layout from '@/components/layout/Layout';
import { useAdminCourses, useDeleteCourse } from '@/features/admin';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

const AdminCourseManagement = () => {
  const { data: courses, isLoading } = useAdminCourses();
  const { mutate: deleteCourse, isPending: isDeleting } = useDeleteCourse();

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">إدارة الدورات</h1>
        </div>
        
        {isLoading ? (
          <div className="h-64 bg-muted animate-pulse rounded-lg" />
        ) : !courses || courses.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">لا يوجد دورات</p>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>عنوان الدورة</TableHead>
                  <TableHead>المدرب</TableHead>
                  <TableHead>التصنيف</TableHead>
                  <TableHead>السعر</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell className="font-medium max-w-[200px] truncate" title={course.title}>
                      {course.title}
                    </TableCell>
                    <TableCell>
                      {typeof course.instructor === "string"
                        ? course.instructor
                        : (course.instructor as any)?.name || "مدرب معتمد"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {typeof course.category === "string"
                          ? course.category
                          : (course.category as any)?.name || "عام"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {course.isFree ? <Badge variant="secondary">مجاني</Badge> : formatCurrency(course.price)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={course.status === 'published' ? 'default' : 'secondary'}>
                        {course.status === 'published' ? 'منشور' : 'مسودة'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" title="تعديل">
                          <Edit size={16} />
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="icon" 
                          onClick={() => deleteCourse(course.id)}
                          disabled={isDeleting}
                          title="حذف"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminCourseManagement;
