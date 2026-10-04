import React, { useState, useMemo } from 'react';
import Layout from '@/components/layout/Layout';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  Download,
  KeyRound,
  Ticket,
  Loader2,
  Search,
  Copy,
  Eye,
  EyeOff,
  CheckCircle2,
  FileText,
  Sparkles,
  AlertCircle,
  Clock,
  Send,
  MessageSquare,
} from 'lucide-react';
import { formatDate } from '@/lib/format';
import { useToast } from '@/components/ui/use-toast';
import {
  useBatches,
  useQuota,
  useActivationCodes,
  useQuotaRequests,
  useCreateQuotaRequest,
  useExtendBatchShelfLife,
  ActivationCodeBatch,
  CenterQuotaRequest,
} from '@/features/activation-codes';
import GenerateCodesModal from '@/components/activation-codes/GenerateCodesModal';

export default function InstructorActivationCodes() {
  const { toast } = useToast();
  const { data: rawBatches, isLoading: isLoadingBatches } = useBatches();
  const { data: quota, isLoading: isLoadingQuota } = useQuota();
  const { data: rawCodes, isLoading: isLoadingCodes } = useActivationCodes();
  const { data: rawQuotaRequests, isLoading: isLoadingQuotaRequests } = useQuotaRequests();

  const createQuotaRequestMutation = useCreateQuotaRequest();
  const extendShelfLifeMutation = useExtendBatchShelfLife();

  const safeFormatDate = (dateStr?: string | null): string => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return formatDate(dateStr);
    } catch {
      return String(dateStr);
    }
  };

  const renderSubscriptionTypeBadge = (batch: any) => {
    const duration = batch?.accessDurationDays ?? batch?.access_duration_days;
    const fixedUntil = batch?.fixedAccessUntil ?? batch?.fixed_access_until;

    if (fixedUntil) {
      return (
        <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 text-xs font-mono">
          حتى {safeFormatDate(fixedUntil)}
        </Badge>
      );
    }
    if (duration === 30) {
      return (
        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 text-xs font-medium">
          شهري (30 يوم)
        </Badge>
      );
    }
    if (duration === 120) {
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs font-medium">
          ترم (120 يوم)
        </Badge>
      );
    }
    if (duration && Number(duration) > 0) {
      return (
        <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 text-xs font-medium">
          {duration} يوم
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs font-medium">
        دائم
      </Badge>
    );
  };

  const renderBatchExpiry = (batch: any) => {
    const expiryStr = batch?.expiresAt || batch?.expires_at;
    const isExpired = Boolean(
      batch?.isExpired ??
      batch?.is_expired ??
      (expiryStr ? new Date(expiryStr).getTime() < Date.now() : false)
    );

    if (isExpired) {
      return (
        <div className="flex flex-col gap-0.5">
          <Badge variant="destructive" className="text-[11px] w-fit">
            منتهي الصلاحية
          </Badge>
          {expiryStr && (
            <span className="text-[10px] text-muted-foreground font-mono">
              انتهى في {safeFormatDate(expiryStr)}
            </span>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-foreground font-medium">
          صالح حتى {safeFormatDate(expiryStr)}
        </span>
        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
          نشط للطباعة والتوزيع
        </span>
      </div>
    );
  };

  const batches = useMemo<ActivationCodeBatch[]>(() => {
    if (Array.isArray(rawBatches)) return rawBatches;
    if (rawBatches && Array.isArray((rawBatches as any).results)) return (rawBatches as any).results;
    if (rawBatches && Array.isArray((rawBatches as any).data)) return (rawBatches as any).data;
    return [];
  }, [rawBatches]);

  const codes = useMemo(() => {
    if (Array.isArray(rawCodes)) return rawCodes;
    if (rawCodes && Array.isArray((rawCodes as any).results)) return (rawCodes as any).results;
    if (rawCodes && Array.isArray((rawCodes as any).data)) return (rawCodes as any).data;
    return [];
  }, [rawCodes]);

  const quotaRequests = useMemo<CenterQuotaRequest[]>(() => {
    if (Array.isArray(rawQuotaRequests)) return rawQuotaRequests;
    if (rawQuotaRequests && Array.isArray((rawQuotaRequests as any).results)) return (rawQuotaRequests as any).results;
    if (rawQuotaRequests && Array.isArray((rawQuotaRequests as any).data)) return (rawQuotaRequests as any).data;
    return [];
  }, [rawQuotaRequests]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuotaRequestModalOpen, setIsQuotaRequestModalOpen] = useState(false);
  const [selectedBatchForExtension, setSelectedBatchForExtension] = useState<ActivationCodeBatch | null>(null);
  const [extensionDays, setExtensionDays] = useState<number>(30);
  const [activeTab, setActiveTab] = useState<'codes' | 'batches' | 'requests'>('codes');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showPins, setShowPins] = useState<Record<number, boolean>>({});

  // Quota Request Form State
  const [requestQuantity, setRequestQuantity] = useState<number>(50);
  const [requestReason, setRequestReason] = useState<string>('');

  const handleExtendShelfLife = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchForExtension) return;

    extendShelfLifeMutation.mutate(
      {
        batchId: selectedBatchForExtension.id,
        additionalDays: Number(extensionDays),
      },
      {
        onSuccess: (res: any) => {
          toast({
            title: 'تم تمديد صلاحية الدفعة بنجاح 🎉',
            description: res?.message || `تم تمديد صلاحية كروت الدفعة #${selectedBatchForExtension.id} بمقدار ${extensionDays} يوماً.`,
          });
          setSelectedBatchForExtension(null);
          setExtensionDays(30);
        },
        onError: (err: any) => {
          toast({
            title: 'فشل تمديد الصلاحية',
            description: err?.response?.data?.error || err?.response?.data?.detail || err?.message || 'حدث خطأ أثناء تمديد الصلاحية.',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const availableQuota = quota?.available ?? 0;
  const maxLimit = quota?.maxLimit ?? 0;

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: 'تم نسخ الكود',
      description: `تم نسخ الكود ${code} إلى الحافظة بنجاح`,
    });
  };

  const togglePinVisibility = (id: number) => {
    setShowPins((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateQuotaRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestQuantity || requestQuantity <= 0) {
      toast({
        title: 'كمية غير صالحة',
        description: 'يرجى إدخال عدد صالح للأكواد المطلوبة (أكبر من 0).',
        variant: 'destructive',
      });
      return;
    }

    createQuotaRequestMutation.mutate(
      {
        requested_quantity: Number(requestQuantity),
        reason: requestReason.trim(),
      },
      {
        onSuccess: () => {
          toast({
            title: 'تم إرسال طلب زيادة الكوتة بنجاح 🎉',
            description: 'تم توجيه طلبك للإدارة العامة لمراجعته واعتماد السعة الجديدة.',
          });
          setRequestQuantity(50);
          setRequestReason('');
          setIsQuotaRequestModalOpen(false);
          setActiveTab('requests');
        },
        onError: (err: any) => {
          toast({
            title: 'تعذر إرسال الطلب',
            description: err?.response?.data?.detail || err?.response?.data?.error || err?.message || 'حدث خطأ أثناء إرسال الطلب.',
            variant: 'destructive',
          });
        },
      }
    );
  };

  // Filter individual codes
  const filteredCodes = useMemo(() => {
    if (!Array.isArray(codes)) return [];
    return codes.filter((c: any) => {
      const codeStr = String(c?.code || '').toLowerCase();
      const nameStr = String(c?.redeemedByName || c?.redeemed_by_name || '').toLowerCase();
      const emailStr = String(c?.redeemedByEmail || c?.redeemed_by_email || '').toLowerCase();
      const displayStat = String(c?.displayStatus || c?.display_status || c?.status || '');
      const query = searchQuery.trim().toLowerCase();

      const matchesSearch =
        !query ||
        codeStr.includes(query) ||
        nameStr.includes(query) ||
        emailStr.includes(query);

      const matchesStatus =
        statusFilter === 'all' ||
        displayStat === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [codes, searchQuery, statusFilter]);

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4 space-y-6 dir-rtl" dir="rtl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 rounded-2xl border border-primary/20">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
              <KeyRound className="text-primary w-6 h-6" />
              أكواد التفعيل
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              إدارة وتوليد أكواد التفعيل لطلابك ومتابعة حالات التفعيل اللحظية وطلبات الكوتة
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              onClick={() => setIsQuotaRequestModalOpen(true)}
              className="border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 gap-2 font-bold"
            >
              <Sparkles size={16} />
              طلب زيادة كوتة
            </Button>
            <Button className="gap-2 font-bold" onClick={() => setIsModalOpen(true)}>
              <Plus size={16} />
              توليد أكواد جديدة
            </Button>
          </div>
        </div>

        {/* Warning card when quota is 0 */}
        {!isLoadingQuota && availableQuota <= 0 && (
          <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-amber-600 dark:text-amber-300 text-sm">
                  رصيد كوتة التوليد المتاح لديك حالياً هو 0 كود
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  لقد استنفدت كامل حصتك المعتمدة أو لم يتم تخصيص كوتة تعاقدية لك بعد. يمكنك إرسال طلب للإدارة لزيادة السعة فوراً.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setIsQuotaRequestModalOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1.5 shrink-0"
            >
              <Sparkles size={14} />
              تقديم طلب زيادة كوتة الآن
            </Button>
          </div>
        )}

        {/* Quota Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 rounded-xl border shadow-xs bg-card">
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Ticket size={16} className="text-primary" /> كوتة الأكواد المتبقية
            </h3>
            {isLoadingQuota ? (
              <Loader2 className="animate-spin text-primary w-5 h-5" />
            ) : (
              <div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-extrabold font-mono ${availableQuota <= 0 ? 'text-destructive' : 'text-foreground'}`}>
                    {availableQuota}
                  </span>
                  <span className="text-xs text-muted-foreground">من أصل {maxLimit} كود</span>
                </div>
                <div className="mt-3 w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${availableQuota <= 0 ? 'bg-destructive' : 'bg-primary'}`}
                    style={{
                      width: `${Math.min(100, Math.max(0, (availableQuota / (maxLimit || 1)) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </Card>

          <Card className="p-4 rounded-xl border shadow-xs bg-card">
            <h3 className="text-xs font-semibold text-muted-foreground mb-2">إجمالي الأكواد المولدة</h3>
            <div className="text-3xl font-extrabold text-foreground font-mono">{codes.length}</div>
            <p className="text-xs text-muted-foreground mt-1">كافة الأكواد الصادرة في حسابك</p>
          </Card>

          <Card className="p-4 rounded-xl border shadow-xs bg-card">
            <h3 className="text-xs font-semibold text-muted-foreground mb-2">الأكواد المفعّلة (Redeemed)</h3>
            <div className="text-3xl font-extrabold text-emerald-600 font-mono">
              {Array.isArray(codes) ? codes.filter((c) => (c?.displayStatus || c?.status) === 'redeemed').length : 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">طلاب قاموا بالتفعيل بنجاح</p>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-4">
          <TabsList className="bg-muted p-1">
            <TabsTrigger value="codes" className="gap-2">
              <KeyRound size={16} />
              قائمة الأكواد ({codes.length})
            </TabsTrigger>
            <TabsTrigger value="batches" className="gap-2">
              <FileText size={16} />
              الدفعات والطباعة ({batches.length})
            </TabsTrigger>
            <TabsTrigger value="requests" className="gap-2">
              <Sparkles size={16} />
              طلبات الكوتة ({quotaRequests.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: INDIVIDUAL CODES */}
          <TabsContent value="codes" className="space-y-4">
            <Card className="border shadow-xs">
              <CardContent className="p-3 flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث برمز الكود، اسم الطالب، أو البريد الإلكتروني..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-9"
                  />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الحالات</SelectItem>
                    <SelectItem value="active">نشط (غير مستخدم)</SelectItem>
                    <SelectItem value="redeemed">مستخدَم</SelectItem>
                    <SelectItem value="expired">منتهي الصلاحية</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card className="border shadow-xs overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="text-right">الكود</TableHead>
                        <TableHead className="text-right">رمز المرور (PIN)</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-right">الطالب المفعل</TableHead>
                        <TableHead className="text-right">تاريخ التفعيل</TableHead>
                        <TableHead className="text-left">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingCodes ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                            جاري تحميل الأكواد...
                          </TableCell>
                        </TableRow>
                      ) : filteredCodes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                            لا توجد أكواد مطابقة لخيارات البحث.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCodes.map((code) => (
                          <TableRow key={code.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-mono font-bold text-primary">
                              <span className="bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg">
                                {code.code}
                              </span>
                            </TableCell>

                            <TableCell className="font-mono text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <span>{showPins[code.id] ? code.password : '••••••'}</span>
                                <button
                                  onClick={() => togglePinVisibility(code.id)}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  {showPins[code.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                              </div>
                            </TableCell>

                            <TableCell>
                              {code.displayStatus === 'redeemed' ? (
                                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                                  <CheckCircle2 size={12} className="mr-1 inline" /> مستخدم
                                </Badge>
                              ) : code.displayStatus === 'expired' ? (
                                <Badge variant="destructive" className="text-xs">
                                  منتهي
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs">
                                  نشط (متاح)
                                </Badge>
                              )}
                            </TableCell>

                            <TableCell className="text-xs">
                              {code.redeemedByName ? (
                                <div>
                                  <div className="font-medium text-foreground">{code.redeemedByName}</div>
                                  <div className="text-muted-foreground font-mono text-[11px]">{code.redeemedByEmail}</div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>

                            <TableCell className="text-xs font-mono text-muted-foreground">
                              {safeFormatDate(code.redeemedAt)}
                            </TableCell>

                            <TableCell className="text-left">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCopyCode(code.code)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                title="نسخ الكود"
                              >
                                <Copy size={14} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: BATCHES */}
          <TabsContent value="batches" className="space-y-4">
            {isLoadingBatches ? (
              <div className="h-64 bg-muted animate-pulse rounded-xl" />
            ) : batches.length === 0 ? (
              <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed">
                <KeyRound size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-xl font-medium mb-2">لا يوجد دفعات أكواد</h3>
                <p className="text-muted-foreground mb-4">لم تقم بتوليد أي أكواد تفعيل حتى الآن.</p>
                <Button onClick={() => setIsModalOpen(true)}>إنشاء الدفعة الأولى</Button>
              </div>
            ) : (
              <Card className="border shadow-xs overflow-hidden">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>رقم الدفعة</TableHead>
                        <TableHead>تاريخ التوليد</TableHead>
                        <TableHead>الكمية</TableHead>
                        <TableHead>حالة الأكواد</TableHead>
                        <TableHead>نوع الأكواد</TableHead>
                        <TableHead>نوع الاشتراك</TableHead>
                        <TableHead>صلاحية الدفعة</TableHead>
                        <TableHead className="text-left">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batches.map((batch) => (
                        <TableRow key={batch.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-medium font-mono">#{batch.id}</TableCell>
                          <TableCell className="text-xs font-mono">{safeFormatDate(batch.createdAt)}</TableCell>
                          <TableCell>
                            <span className="font-bold">{batch.quantity}</span> كود
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1 text-xs">
                              <span className="text-emerald-600 flex items-center gap-1 font-medium">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                {batch.activeCount ?? batch.active_count ?? 0} نشط
                              </span>
                              <span className="text-primary flex items-center gap-1 font-medium">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                                {batch.redeemedCount ?? batch.redeemed_count ?? 0} مستخدم
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {batch.batchType === 'course_access'
                                ? 'دخول كورسات'
                                : batch.batchType === 'center_student'
                                ? 'طالب سنتر'
                                : 'انضمام مدرس'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {renderSubscriptionTypeBadge(batch)}
                          </TableCell>
                          <TableCell>
                            {renderBatchExpiry(batch)}
                          </TableCell>
                          <TableCell className="text-left">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 h-8 text-xs border-primary/30 text-primary hover:bg-primary/10"
                                onClick={() => setSelectedBatchForExtension(batch)}
                              >
                                <Clock size={13} />
                                تمديد الصلاحية
                              </Button>
                              {batch.pdfFile ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-2 h-8 text-xs"
                                  onClick={() => window.open(batch.pdfFile!, '_blank')}
                                >
                                  <Download size={14} />
                                  طباعة
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">جاري المعالجة</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* TAB 3: QUOTA REQUESTS */}
          <TabsContent value="requests" className="space-y-4">
            <div className="flex justify-between items-center bg-card p-4 rounded-xl border">
              <div>
                <h3 className="font-bold text-foreground text-base">سجل طلبات زيادة الكوتة</h3>
                <p className="text-xs text-muted-foreground">
                  متابعة حالة الطلبات المقدمة للإدارة العامة وملاحظات المراجعة
                </p>
              </div>
              <Button
                onClick={() => setIsQuotaRequestModalOpen(true)}
                className="gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm"
              >
                <Sparkles size={15} />
                طلب كوتة جديدة
              </Button>
            </div>

            <Card className="border shadow-xs overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="text-right">رقم الطلب</TableHead>
                        <TableHead className="text-right">الكمية المطلوبة</TableHead>
                        <TableHead className="text-right">الكوتة عند الطلب</TableHead>
                        <TableHead className="text-right">مبرر الطلب</TableHead>
                        <TableHead className="text-right">تاريخ الإرسال</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-right">ملاحظات الإدارة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingQuotaRequests ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                            جاري تحميل طلبات الكوتة...
                          </TableCell>
                        </TableRow>
                      ) : quotaRequests.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                            لم تقدم أي طلبات لزيادة الكوتة حتى الآن.
                          </TableCell>
                        </TableRow>
                      ) : (
                        quotaRequests.map((req) => (
                          <TableRow key={req.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-mono font-bold">#{req.id}</TableCell>
                            <TableCell className="font-bold text-amber-500 font-mono text-base">
                              +{req.requestedQuantity} كود
                            </TableCell>
                            <TableCell className="font-mono text-muted-foreground">
                              {req.currentQuota} كود
                            </TableCell>
                            <TableCell className="max-w-[240px] truncate text-xs" title={req.reason}>
                              {req.reason || '—'}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {safeFormatDate(req.createdAt)}
                            </TableCell>
                            <TableCell>
                              {req.status === 'approved' ? (
                                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                                  <CheckCircle2 size={12} className="ms-1 inline" /> معتمد
                                </Badge>
                              ) : req.status === 'rejected' ? (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertCircle size={12} className="ms-1 inline" /> مرفوض
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs">
                                  <Clock size={12} className="ms-1 inline" /> قيد المراجعة
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              {req.adminNotes ? (
                                <div className="flex items-center gap-1.5 text-foreground">
                                  <MessageSquare size={13} className="text-muted-foreground shrink-0" />
                                  <span>{req.adminNotes}</span>
                                </div>
                              ) : req.reviewedByName ? (
                                <span className="text-muted-foreground">تمت المراجعة بواسطة {req.reviewedByName}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Generate Codes Modal */}
        {isModalOpen && (
          <GenerateCodesModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            userRole="instructor"
            availableQuota={availableQuota}
            onRequestQuota={() => {
              setIsModalOpen(false);
              setIsQuotaRequestModalOpen(true);
            }}
          />
        )}

        {/* Quota Request Modal */}
        <Dialog open={isQuotaRequestModalOpen} onOpenChange={setIsQuotaRequestModalOpen}>
          <DialogContent size="md" className="dir-rtl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                <Sparkles className="text-amber-500" />
                طلب زيادة كوتة أكواد جديدة
              </DialogTitle>
              <DialogDescription>
                أرسل طلباً للإدارة العامة لزيادة الحد المتاح لتوليد أكواد التفعيل لطلابك.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateQuotaRequest} className="space-y-4 py-2">
              <div className="bg-secondary/50 p-3 rounded-lg flex justify-between items-center border border-secondary">
                <span className="text-sm font-medium">الكوتة المتاحة الحالية:</span>
                <span className="font-bold text-base text-primary font-mono">{availableQuota} كود</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="requestQuantity">عدد الأكواد الإضافية المطلوبة *</Label>
                <Input
                  id="requestQuantity"
                  type="number"
                  min="1"
                  step="1"
                  value={requestQuantity}
                  onChange={(e) => setRequestQuantity(Number(e.target.value))}
                  placeholder="مثال: 50 أو 100"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  حدد عدد الأكواد الإضافية التي ترغب في الحصول عليها للدفعة القادمة.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="requestReason">سبب ومبرر الطلب *</Label>
                <Textarea
                  id="requestReason"
                  rows={3}
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  placeholder="مثال: بدء دورة دراسية جديدة وزيادة عدد الطلاب المشتركين بالحجز..."
                  required
                />
              </div>

              <DialogFooter className="mt-4 gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsQuotaRequestModalOpen(false)}
                  disabled={createQuotaRequestMutation.isPending}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={createQuotaRequestMutation.isPending || !requestQuantity || requestQuantity <= 0}
                  className="gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                  {createQuotaRequestMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  إرسال الطلب الآن
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Extend Batch Shelf-Life Dialog */}
        <Dialog
          open={Boolean(selectedBatchForExtension)}
          onOpenChange={(open) => {
            if (!open) setSelectedBatchForExtension(null);
          }}
        >
          <DialogContent size="md" className="dir-rtl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                <Clock className="text-primary" />
                تمديد صلاحية شحن الدفعة #{selectedBatchForExtension?.id}
              </DialogTitle>
              <DialogDescription>
                تمديد تاريخ انتهاء صلاحية شحن الكروت غير المستخدمة في هذه الدفعة قبل إتلافها أو إيقافها.
              </DialogDescription>
            </DialogHeader>

            {selectedBatchForExtension && (
              <form onSubmit={handleExtendShelfLife} className="space-y-4 py-2">
                <div className="bg-muted/40 p-3 rounded-lg space-y-1.5 text-xs border">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">صلاحية الدفعة الحالية:</span>
                    <span className="font-mono font-bold text-foreground">
                      {safeFormatDate(selectedBatchForExtension.expiresAt || selectedBatchForExtension.expires_at)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الأكواد النشطة غير المستخدمة:</span>
                    <span className="font-mono font-bold text-primary">
                      {selectedBatchForExtension.activeCount ?? selectedBatchForExtension.active_count ?? 0} كود
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="extensionDays">فترة التمديد الإضافية</Label>
                  <Select
                    value={String(extensionDays)}
                    onValueChange={(val) => setExtensionDays(Number(val))}
                  >
                    <SelectTrigger id="extensionDays">
                      <SelectValue placeholder="اختر مدة التمديد" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">+30 يوماً إضافية (شهر)</SelectItem>
                      <SelectItem value="60">+60 يوماً إضافية (شهران)</SelectItem>
                      <SelectItem value="90">+90 يوماً إضافية (فصل دراسي)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    سيتم ترحيل تاريخ انتهاء الصلاحية بمقدار المدة المحددة لجميع الأكواد غير المفعلة في هذه الدفعة.
                  </p>
                </div>

                <DialogFooter className="mt-4 gap-2 sm:gap-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedBatchForExtension(null)}
                    disabled={extendShelfLifeMutation.isPending}
                  >
                    إلغاء
                  </Button>
                  <Button
                    type="submit"
                    disabled={extendShelfLifeMutation.isPending}
                    className="gap-2 font-bold"
                  >
                    {extendShelfLifeMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Clock className="h-4 w-4" />
                    )}
                    تأكيد التمديد الآن
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
