import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { useValidateCode, useRedeemCode } from '@/features/activation-codes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { KeyRound, CheckCircle2, AlertCircle, Loader2, BookOpen, Sparkles, Clock, Calendar } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from '@/components/ui/use-toast';
import { RedeemCodeResponse, normalizeActivationPin } from '@/features/activation-codes';

const ActivateCodePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const initialCourseId = Number(searchParams.get('course_id')) || null;
  
  const [code, setCode] = useState((searchParams.get('code') || '').trim().toUpperCase());
  const [password, setPassword] = useState('');
  const [redeemSuccessData, setRedeemSuccessData] = useState<RedeemCodeResponse | null>(null);
  
  const { mutate: validateCode, isPending: isValidating, data: validationData, error: validationError } = useValidateCode();
  const { mutate: redeemCode, isPending: isRedeeming } = useRedeemCode();

  useEffect(() => {
    // If returning from login after a pending activation
    const pendingCode = sessionStorage.getItem('pendingActivationCode');
    const pendingPassword = sessionStorage.getItem('pendingActivationPassword');
    
    if (isAuthenticated && pendingCode && pendingPassword) {
      setCode(pendingCode);
      setPassword(pendingPassword);
      validateCode({
        code: pendingCode.trim().toUpperCase(),
        password: normalizeActivationPin(pendingPassword),
        courseId: initialCourseId || undefined,
      });
      sessionStorage.removeItem('pendingActivationCode');
      sessionStorage.removeItem('pendingActivationPassword');
    }
  }, [isAuthenticated, validateCode]);

  const handleValidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !password) return;
    const normalizedCode = code.trim().toUpperCase();
    const normalizedPassword = normalizeActivationPin(password);
    setCode(normalizedCode);
    setPassword(normalizedPassword);
    validateCode({
      code: normalizedCode,
      password: normalizedPassword,
      courseId: initialCourseId || undefined,
    });
  };

  const handleRedeem = () => {
    if (!isAuthenticated) {
      // Save state and redirect to login
      const normalizedCode = code.trim().toUpperCase();
      const normalizedPassword = password.trim();
      sessionStorage.setItem('pendingActivationCode', normalizedCode);
      sessionStorage.setItem('pendingActivationPassword', normalizedPassword);
      const redirect = initialCourseId
        ? `/activate?code=${encodeURIComponent(normalizedCode)}&course_id=${initialCourseId}`
        : `/activate?code=${encodeURIComponent(normalizedCode)}`;
      navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { state: { message: 'يرجى تسجيل الدخول لتفعيل الكود' } });
      return;
    }

    redeemCode({ code, password }, {
      onSuccess: (data: RedeemCodeResponse) => {
        setRedeemSuccessData(data);
        const isRenewal = Boolean(data?.isRenewal ?? data?.is_renewal);
        const newExpiresAt = data?.newExpiresAt ?? data?.new_expires_at;
        const formattedDate = newExpiresAt
          ? new Date(newExpiresAt).toLocaleDateString('ar-EG', { dateStyle: 'long' })
          : null;

        toast({
          title: isRenewal ? "تم تجديد اشتراكك بنجاح! 🎉" : "تم التفعيل بنجاح! 🎉",
          description: formattedDate
            ? `تم تمديد فترة وصولك للدورة حتى ${formattedDate}.`
            : data?.message || "تم إضافة المحتوى إلى حسابك.",
          variant: "default",
        });
        // Redirect to dashboard or course
        setTimeout(() => navigate('/student/dashboard'), 3500);
      },
      onError: (err: any) => {
        toast({
          title: "فشل التفعيل",
          description: err?.response?.data?.error || "حدث خطأ غير متوقع",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-primary/20">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto bg-primary/10 w-16 h-16 flex items-center justify-center rounded-full mb-2">
            <KeyRound className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">تفعيل كود</CardTitle>
          <CardDescription>أدخل الكود والرقم السري الخاص بك للوصول للمحتوى</CardDescription>
        </CardHeader>

        <CardContent>
          {redeemSuccessData ? (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 text-center py-2">
              <div className="mx-auto bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 w-16 h-16 flex items-center justify-center rounded-full border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-foreground">
                  {redeemSuccessData.isRenewal || redeemSuccessData.is_renewal ? 'تم تجديد الاشتراك بنجاح! 🎉' : 'تم تفعيل الكود بنجاح! 🎉'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {redeemSuccessData.message || 'تم إتاحة المحتوى وإضافته إلى حسابك بنجاح.'}
                </p>
              </div>

              {(redeemSuccessData.newExpiresAt || redeemSuccessData.new_expires_at) && (
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <Calendar className="w-4 h-4" />
                    <span>تاريخ انتهاء صلاحية الوصول الجديد</span>
                  </div>
                  <div className="text-base font-bold font-mono">
                    {new Date(redeemSuccessData.newExpiresAt || redeemSuccessData.new_expires_at!).toLocaleDateString('ar-EG', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                </div>
              )}

              <Button
                onClick={() => navigate('/student/dashboard')}
                className="w-full text-base h-11 font-bold"
              >
                الانتقال إلى لوحة التحكم الآن
              </Button>
            </div>
          ) : !validationData?.valid ? (
            <form onSubmit={handleValidate} className="space-y-4">
              {validationError && (
                <Alert variant="destructive" className="animate-in slide-in-from-top-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>خطأ</AlertTitle>
                  <AlertDescription>
                    {(validationError as any)?.response?.data?.error || 'الكود أو كلمة المرور غير صحيحة'}
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="code">كود التفعيل</Label>
                <Input 
                  id="code" 
                  placeholder="ES-XXXXXXXX" 
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="text-center font-mono text-lg tracking-widest uppercase"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">الرقم السري (PIN)</Label>
                <Input 
                  id="password" 
                  type="password"
                  placeholder="••••••" 
                  value={password}
                  onChange={(e) => setPassword(normalizeActivationPin(e.target.value))}
                  className="text-center font-mono text-xl tracking-[0.5em]"
                  maxLength={6}
                  required
                />
              </div>

              <Button type="submit" className="w-full text-lg h-12" disabled={isValidating || !code || !password}>
                {isValidating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'فحص الكود'}
              </Button>
            </form>
          ) : (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <div className="bg-success/10 text-success p-4 rounded-lg flex items-start gap-3 border border-success/20">
                <CheckCircle2 className="w-6 h-6 mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-semibold text-lg">الكود صحيح وجاهز للتفعيل</h4>
                  <p className="text-sm opacity-90 mt-1">
                    هذا الكود يمنحك الصلاحيات التالية:
                  </p>
                </div>
              </div>

              {/* Renewal Alert or Duration Badge */}
              {(validationData.isRenewal || validationData.is_renewal) ? (
                <div className="p-4 rounded-xl border-2 border-purple-500/40 bg-gradient-to-br from-emerald-500/10 via-purple-500/15 to-emerald-500/10 shadow-lg shadow-purple-500/10 space-y-2 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold text-sm">
                    <Sparkles className="w-5 h-5 text-purple-500 animate-pulse" />
                    <span>تجديد اشتراك ذكي (Additive Renewal)</span>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed font-medium">
                    ✨ كود تجديد اشتراك: سيتم تمديد فترة وصولك لدورة{' '}
                    <strong className="text-purple-600 dark:text-purple-300 font-bold">
                      [{validationData.courses?.[0]?.title || (validationData.courses && validationData.courses.length > 0 ? validationData.courses.map((c: any) => c.title).join('، ') : 'الدورة')}]
                    </strong>{' '}
                    بمقدار{' '}
                    <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                      {validationData.accessDurationDays || validationData.access_duration_days || 30} يوماً
                    </strong>{' '}
                    إضافية مع الاحتفاظ بكافة امتحاناتك ودرجاتك السابقة.
                  </p>
                  {(validationData.newProjectedExpiresAt || validationData.new_projected_expires_at) && (
                    <div className="text-xs text-muted-foreground pt-1.5 border-t border-purple-500/20 flex items-center gap-1.5 font-mono">
                      <Clock className="w-3.5 h-3.5 text-purple-500" />
                      <span>تاريخ الانتهاء الجديد المتوقع: {new Date(validationData.newProjectedExpiresAt || validationData.new_projected_expires_at!).toLocaleDateString('ar-EG', { dateStyle: 'long' })}</span>
                    </div>
                  )}
                </div>
              ) : (validationData.accessDurationDays || validationData.access_duration_days) ? (
                <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300 flex items-center gap-2.5 text-sm font-medium">
                  <Clock className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>⏱️ مدة الاشتراك: <strong className="font-mono font-bold">{validationData.accessDurationDays || validationData.access_duration_days} يوماً</strong> من تاريخ التفعيل.</span>
                </div>
              ) : (validationData.fixedAccessUntil || validationData.fixed_access_until) ? (
                <div className="p-3.5 rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 flex items-center gap-2.5 text-sm font-medium">
                  <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>📅 صلاحية الاشتراك: حتى <strong className="font-mono font-bold">{new Date(validationData.fixedAccessUntil || validationData.fixed_access_until!).toLocaleDateString('ar-EG', { dateStyle: 'long' })}</strong></span>
                </div>
              ) : null}

              {validationData.courses && validationData.courses.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <BookOpen size={16} /> الكورسات المشمولة:
                  </Label>
                  <div className="space-y-2">
                    {validationData.courses.map((course: any) => (
                      <div key={course.id} className="p-3 border rounded-md flex gap-3 items-center bg-card">
                        {course.thumbnail ? (
                          <img src={course.thumbnail} alt={course.title} className="w-12 h-12 rounded object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                            <BookOpen className="text-muted-foreground" size={20} />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold line-clamp-1">{course.title}</p>
                          <p className="text-xs text-muted-foreground">{course.instructorName}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {((validationData.batchType === 'digital_balance' || validationData.batch_type === 'digital_balance') || 
                Boolean(validationData.balanceAmount || validationData.balance_amount)) && (
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">شحن رصيد المحفظة</p>
                  <p className="text-2xl font-bold text-primary mt-1">
                    +{validationData.balanceAmount || validationData.balance_amount || '0.00'} ج.م
                  </p>
                </div>
              )}

              {(validationData.batchType === 'center_student' || validationData.batch_type === 'center_student') && (
                <div className="p-4 bg-secondary/50 rounded-lg text-center">
                  <p className="font-medium">انضمام كطالب مؤسسة</p>
                </div>
              )}
              
              {(validationData.batchType === 'instructor_student' || validationData.batch_type === 'instructor_student') && (
                <div className="p-4 bg-secondary/50 rounded-lg text-center">
                  <p className="font-medium">انضمام كطالب خاص للمدرس</p>
                </div>
              )}

              {!isAuthenticated && (
                <Alert className="bg-primary/5 border-primary/20">
                  <AlertCircle className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-primary font-medium">
                    سيطلب منك تسجيل الدخول أو إنشاء حساب لإتمام التفعيل.
                  </AlertDescription>
                </Alert>
              )}

              <Button 
                onClick={handleRedeem} 
                className="w-full text-lg h-12 gap-2" 
                size="lg"
                disabled={isRedeeming}
              >
                {isRedeeming ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    تأكيد التفعيل <CheckCircle2 className="w-5 h-5" />
                  </>
                )}
              </Button>
              
              <Button 
                variant="ghost" 
                className="w-full"
                onClick={() => {
                  setCode('');
                  setPassword('');
                  window.location.reload();
                }}
              >
                إلغاء وإدخال كود آخر
              </Button>
            </div>
          )}
        </CardContent>
        {validationData?.valid && isAuthenticated && !redeemSuccessData && (
          <CardFooter className="justify-center border-t pt-4">
            <p className="text-sm text-muted-foreground">
              سيتم التفعيل على حساب: <span className="font-medium text-foreground">{user?.email}</span>
            </p>
          </CardFooter>
        )}
      </Card>
    </div>
  );
};

export default ActivateCodePage;
