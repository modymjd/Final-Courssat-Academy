import React from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, CheckCircle2, XCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/http";

export interface ApprovalItem {
  id: number;
  type: "course" | "payout";
  typeLabel: string;
  title: string;
  applicant: string;
  date: string;
  status: string;
}

export default function AdminApprovals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const approvalsQuery = useQuery<ApprovalItem[]>({
    queryKey: ["admin-approvals-list"],
    queryFn: () => apiGet<ApprovalItem[]>("/accounts/admin/approvals/"),
    staleTime: 30_000,
  });

  const actionMutation = useMutation({
    mutationFn: async ({ item, action }: { item: ApprovalItem; action: "approve" | "reject" }) => {
      return apiPost(`/accounts/admin/approvals/${item.type}/${item.id}/`, { action });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-approvals-list"] });
      toast({
        title: variables.action === "approve" ? "تم الاعتماد" : "تم الرفض",
        description: variables.action === "approve" ? "تم تنفيذ قرار الاعتماد على المورد الحقيقي." : "تم رفض الطلب بنجاح.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "تعذر تنفيذ العملية",
        description: error.message || "حدث خطأ أثناء تحديث الطلب.",
      });
    },
  });

  const approvals = approvalsQuery.data ?? [];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 dir-rtl space-y-6" dir="rtl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-amber-900 via-primary/90 to-slate-900 p-6 rounded-3xl text-white shadow-xl">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-amber-400" />
              مركز الاعتمادات والمراجعات المعلقة
            </h1>
            <p className="text-amber-100 mt-1 text-sm">طلبات حقيقية من بيانات النظام الحالية، بدون بيانات تجريبية.</p>
          </div>
          <Button
            variant="secondary"
            onClick={() => approvalsQuery.refetch()}
            disabled={approvalsQuery.isFetching}
            className="gap-2 rounded-xl font-bold"
          >
            <RefreshCw className={approvalsQuery.isFetching ? "animate-spin" : ""} size={16} />
            تحديث
          </Button>
        </div>

        <Card className="border-border/60 rounded-2xl shadow-xs">
          <CardHeader className="py-4">
            <CardTitle className="text-lg font-bold">قائمة الطلبات المعلقة ({approvals.length})</CardTitle>
            <CardDescription>الاعتمادات المتاحة فعليًا في قاعدة البيانات</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {approvalsQuery.isError ? (
              <div className="p-10 text-center space-y-3 text-destructive">
                <AlertTriangle size={34} className="mx-auto" />
                <p className="font-bold">تعذر تحميل طلبات الاعتماد.</p>
                <Button variant="outline" onClick={() => approvalsQuery.refetch()}>
                  إعادة المحاولة
                </Button>
              </div>
            ) : approvalsQuery.isLoading ? (
              <div className="p-10 text-center text-muted-foreground">جاري تحميل الطلبات...</div>
            ) : approvals.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                <CheckCircle2 size={34} className="mx-auto mb-2" />
                لا توجد طلبات معلقة حاليًا.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-right">نوع الطلب</TableHead>
                    <TableHead className="text-right">العنوان</TableHead>
                    <TableHead className="text-right">المقدم</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvals.map((item) => {
                    const isBusy = actionMutation.isPending && actionMutation.variables?.item.id === item.id;
                    return (
                      <TableRow key={`${item.type}:${item.id}`}>
                        <TableCell>
                          <Badge variant="outline" className="font-semibold">{item.typeLabel}</Badge>
                        </TableCell>
                        <TableCell className="font-bold">{item.title}</TableCell>
                        <TableCell className="text-muted-foreground">{item.applicant}</TableCell>
                        <TableCell className="text-xs font-mono">{item.date}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => actionMutation.mutate({ item, action: "approve" })}
                              disabled={isBusy}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1 rounded-xl text-xs"
                            >
                              <CheckCircle2 size={14} /> قبول
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => actionMutation.mutate({ item, action: "reject" })}
                              disabled={isBusy}
                              className="font-bold gap-1 rounded-xl text-xs"
                            >
                              <XCircle size={14} /> رفض
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
