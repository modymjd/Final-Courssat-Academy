import React from 'react';
import Layout from '@/components/layout/Layout';
import { useAdminUsers, useDeleteUser } from '@/features/admin';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';

const AdminUserManagement = () => {
  const { data: users, isLoading } = useAdminUsers();
  const { mutate: deleteUser, isPending: isDeleting } = useDeleteUser();

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-6">إدارة المستخدمين</h1>
        
        {isLoading ? (
          <div className="h-64 bg-muted animate-pulse rounded-lg" />
        ) : !users || users.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">لا يوجد مستخدمين</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>البريد الإلكتروني</TableHead>
                  <TableHead>الدور</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.firstName} {user.lastName}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'destructive' : user.role === 'instructor' ? 'default' : 'secondary'}>
                        {user.role === 'admin' ? 'مدير' : user.role === 'instructor' ? 'مدرب' : 'طالب'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="destructive" 
                        size="icon" 
                        onClick={() => deleteUser(user.id)}
                        disabled={isDeleting || user.role === 'admin'}
                      >
                        <Trash2 size={16} />
                      </Button>
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

export default AdminUserManagement;
