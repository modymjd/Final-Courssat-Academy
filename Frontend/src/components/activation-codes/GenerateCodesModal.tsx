import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGenerateBatch } from '@/features/activation-codes';
import { useInstructorCourses } from '@/features/instructor';
import { Loader2, Ticket, AlertCircle, Sparkles, Clock, Calendar, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface GenerateCodesModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableQuota: number;
  userRole?: 'instructor' | 'center';
  onRequestQuota?: () => void;
}

const GenerateCodesModal = ({
  isOpen,
  onClose,
  availableQuota,
  onRequestQuota,
}: GenerateCodesModalProps) => {
  const [quantity, setQuantity] = useState<number | ''>('');
  const [price, setPrice] = useState<number | ''>('');
  const [batchType, setBatchType] = useState<string>('course_access');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [shelfLifeDays, setShelfLifeDays] = useState<string>('90');
  const [accessDurationType, setAccessDurationType] = useState<string>('lifetime');
  const [fixedAccessUntil, setFixedAccessUntil] = useState<string>('');
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const { data: courses } = useInstructorCourses();
  const { mutate: generateBatch, isPending, error } = useGenerateBatch();

  const isExceedingQuota = typeof quantity === 'number' && quantity > availableQuota;
  const isZeroQuota = availableQuota <= 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);

    if (!quantity || Number(quantity) <= 0) return;
    if (Number(quantity) > availableQuota) return;
    if (batchType === 'course_access' && !selectedCourseId) return;
    if (
      (batchType === 'course_access' || batchType === 'center_student') &&
      accessDurationType === 'fixed_date' &&
      !fixedAccessUntil
    ) {
      return;
    }

    let accessDurationDays: number | null = null;
    let fixedAccessUntilValue: string | null = null;

    if (batchType === 'course_access' || batchType === 'center_student') {
      if (accessDurationType === '30') {
        accessDurationDays = 30;
      } else if (accessDurationType === '120') {
        accessDurationDays = 120;
      } else if (accessDurationType === 'fixed_date') {
        fixedAccessUntilValue = fixedAccessUntil || null;
      }
    }

    generateBatch(
      {
        batchType,
        quantity: Number(quantity),
        pricePerCode: Number(price) || 0,
        courseIds: selectedCourseId ? [Number(selectedCourseId)] : [],
        shelfLifeDays: Number(shelfLifeDays) || 90,
        accessDurationDays,
        fixedAccessUntil: fixedAccessUntilValue,
      },
      {
        onSuccess: () => {
          setQuantity('');
          setPrice('');
          setSelectedCourseId('');
          setShelfLifeDays('90');
          setAccessDurationType('lifetime');
          setFixedAccessUntil('');
          setSubmitAttempted(false);
          onClose();
        },
      }
    );
  };

  const handleRequestQuotaClick = () => {
    onClose();
    if (onRequestQuota) {
      onRequestQuota();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="md" className="dir-rtl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Ticket className="text-primary" />
            توليد أكواد جديدة
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto overscroll-contain space-y-4 py-2 custom-scrollbar">
          {/* Quota status bar */}
          <div className={`p-3 rounded-lg flex justify-between items-center border ${
            isZeroQuota 
              ? 'bg-destructive/10 border-destructive/30 text-destructive' 
              : 'bg-secondary/50 border-secondary'
          }`}>
            <span className="text-sm font-medium">الحصة المتاحة للتوليد:</span>
            <span className={`font-bold text-lg font-mono ${isZeroQuota ? 'text-destructive' : 'text-primary'}`}>
              {availableQuota} كود
            </span>
          </div>

          {/* Zero Quota Alert */}
          {isZeroQuota && (
            <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-sm font-bold">لا يوجد رصيد كوتة متبقٍ</AlertTitle>
              <AlertDescription className="text-xs mt-1 space-y-2">
                <p>لقد استنفدت كوتة الأكواد المتاحة لحسابك بالكامل. يرجى طلب زيادة الكوتة من الإدارة لتتمكن من التوليد.</p>
                {onRequestQuota && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRequestQuotaClick}
                    className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive hover:text-white mt-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    طلب زيادة كوتة الآن
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Exceeding Quota Alert */}
          {!isZeroQuota && isExceedingQuota && (
            <Alert variant="destructive" className="bg-amber-500/10 border-amber-500/30 text-amber-500 dark:text-amber-400">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <AlertTitle className="text-sm font-bold">الكمية المطلوبة تتجاوز الحصة المتاحة!</AlertTitle>
              <AlertDescription className="text-xs mt-1 space-y-2 text-foreground/90">
                <p>
                  لقد حددت <strong>{quantity}</strong> كود بينما رصيدك المتبقي هو <strong>{availableQuota}</strong> فقط.
                  يمكنك تقليل العدد المطلوب أو إرسال طلب للإدارة لزيادة الكوتة.
                </p>
                {onRequestQuota && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRequestQuotaClick}
                    className="gap-1.5 border-amber-500/40 text-amber-600 dark:text-amber-300 hover:bg-amber-500 hover:text-white mt-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    طلب زيادة كوتة
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {(error as any)?.response?.data?.error || (error as any)?.message || 'حدث خطأ أثناء التوليد. يرجى المحاولة مرة أخرى.'}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            <Label htmlFor="batchType">نوع الأكواد</Label>
            <Select value={batchType} onValueChange={setBatchType} disabled={isZeroQuota}>
              <SelectTrigger id="batchType">
                <SelectValue placeholder="اختر نوع الأكواد" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="course_access">وصول لكورس محدد</SelectItem>
                <SelectItem value="instructor_student">انضمام كطالب عام (بدون كورس)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {batchType === 'course_access' && (
            <div className="grid gap-2 animate-in fade-in slide-in-from-top-2">
              <Label htmlFor="course">الكورس</Label>
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId} required disabled={isZeroQuota}>
                <SelectTrigger id="course">
                  <SelectValue placeholder="اختر الكورس" />
                </SelectTrigger>
                <SelectContent>
                  {courses?.map((course) => (
                    <SelectItem key={course.id} value={course.id.toString()}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="quantity">العدد</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                max={availableQuota}
                value={quantity}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Number(e.target.value);
                  setQuantity(val);
                }}
                placeholder={availableQuota > 0 ? `الحد الأقصى: ${availableQuota}` : 'لا يوجد رصيد'}
                disabled={isZeroQuota}
                required
                className={isExceedingQuota ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {isExceedingQuota && (
                <span className="text-xs font-semibold text-destructive">
                  يتجاوز الحصة المتاحة ({availableQuota})!
                </span>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="price">السعر للكود (اختياري)</Label>
              <Input
                id="price"
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="السعر (ج.م)"
                disabled={isZeroQuota}
              />
            </div>
          </div>

          {/* Shelf Life Section */}
          <div className="p-3.5 rounded-xl border bg-muted/20 space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <Label htmlFor="shelfLife" className="text-sm font-semibold">
                صلاحية شحن الكروت المطبوعة (Shelf Life)
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              الفترة المتاحة لتوزيع الكرت واستخدامه من قبل الطالب قبل أن تنتهي صلاحية الكود تلقائياً.
            </p>
            <Select value={shelfLifeDays} onValueChange={setShelfLifeDays} disabled={isZeroQuota}>
              <SelectTrigger id="shelfLife" className="bg-background">
                <SelectValue placeholder="اختر مدة صلاحية الكرت" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 يوماً</SelectItem>
                <SelectItem value="60">60 يوماً</SelectItem>
                <SelectItem value="90">90 يوماً (الافتراضي والموصى به)</SelectItem>
                <SelectItem value="180">180 يوماً</SelectItem>
                <SelectItem value="365">365 يوماً (سنة كاملة)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Course Access Duration Section */}
          {(batchType === 'course_access' || batchType === 'center_student') && (
            <div className="p-3.5 rounded-xl border bg-muted/20 space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <Label htmlFor="accessDuration" className="text-sm font-semibold">
                  صلاحية اشتراك الطالب في الكورس (Course Access Duration)
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                تحديد مدة وصول الطالب لمحتوى الكورس بعد تفعيل الكود بنجاح (تجديد تراكمي ذكي).
              </p>
              <Select value={accessDurationType} onValueChange={setAccessDurationType} disabled={isZeroQuota}>
                <SelectTrigger id="accessDuration" className="bg-background">
                  <SelectValue placeholder="اختر مدة الاشتراك" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lifetime">وصول دائم مدى الحياة (Lifetime Access)</SelectItem>
                  <SelectItem value="30">اشتراك شهري (30 يوماً) - مناسب لحصص ومذكرات الشهر</SelectItem>
                  <SelectItem value="120">اشتراك فصل دراسي (120 يوماً) - للترم الدراسي</SelectItem>
                  <SelectItem value="fixed_date">تاريخ نهاية محدد (موعد نهاية السنة الدراسية)</SelectItem>
                </SelectContent>
              </Select>

              {accessDurationType === 'fixed_date' && (
                <div className="space-y-1.5 pt-1 animate-in fade-in slide-in-from-top-1">
                  <Label htmlFor="fixedAccessUntil" className="text-xs flex items-center gap-1.5 text-foreground font-medium">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    تاريخ انتهاء الوصول المحدد:
                  </Label>
                  <Input
                    id="fixedAccessUntil"
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={fixedAccessUntil}
                    onChange={(e) => setFixedAccessUntil(e.target.value)}
                    required
                    className="bg-background"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    سيتمكن الطالب من الوصول للمحتوى حتى حلول منتصف ليل هذا اليوم المحدد.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              إلغاء
            </Button>
            <Button 
              type="submit" 
              disabled={
                isPending ||
                isZeroQuota ||
                !quantity ||
                Number(quantity) <= 0 ||
                Number(quantity) > availableQuota ||
                (batchType === 'course_access' && !selectedCourseId) ||
                ((batchType === 'course_access' || batchType === 'center_student') && accessDurationType === 'fixed_date' && !fixedAccessUntil)
              }
            >
              {isPending && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              توليد الآن
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default GenerateCodesModal;

