import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { parseExamJson, type ImportedExamJson } from "@/features/exams/jsonImport";
import {
  FileCode,
  Download,
  UploadCloud,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  FileCheck,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  downloadQuestionBankTemplate,
  dryRunQuestionImport,
  importQuestions,
  QuestionImportResult,
} from "@/features/exams/api";

export interface QuestionBankImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  examId?: number;
  persistToExam?: boolean;
  onImportSuccess?: (count: number, questions?: any[], exam?: ImportedExamJson) => void;
}

export const QuestionBankImportModal: React.FC<QuestionBankImportModalProps> = ({
  isOpen,
  onClose,
  examId,
  persistToExam = true,
  onImportSuccess,
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<QuestionImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [inputMode, setInputMode] = useState<"file" | "paste">(persistToExam ? "file" : "paste");
  const [jsonText, setJsonText] = useState("");
  const [parsedExam, setParsedExam] = useState<ImportedExamJson | null>(null);

  const resetState = () => {
    setSelectedFile(null);
    setDryRunResult(null);
    setParsedExam(null);
    setJsonText("");
    setInputMode(persistToExam ? "file" : "paste");
    setIsDryRunning(false);
    setIsImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith(".json")) {
      toast({
        variant: "destructive",
        title: "صيغة غير مدعومة",
        description: "يرجى اختيار ملف بصيغة JSON فقط (.json)",
      });
      return;
    }
    setSelectedFile(file);
    setDryRunResult(null);
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadQuestionBankTemplate();
      toast({
        title: "تم تنزيل قالب الأسئلة 📄",
        description: "يمكنك تعبئة الأسئلة في ملف questions_template.json ثم رفعه هنا.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "تعذر تنزيل القالب",
        description: "حدث خطأ أثناء تحميل القالب، يرجى المحاولة لاحقاً.",
      });
    }
  };

  const handlePasteValidate = async () => {
    if (!jsonText.trim() || isDryRunning) return;

    setIsDryRunning(true);
    setDryRunResult(null);
    try {
      const parsed = parseExamJson(jsonText);
      const validation = await dryRunQuestionImport(parsed.questions);
      setDryRunResult(validation);

      if (!validation.is_valid) {
        toast({
          variant: "destructive",
          title: `تم رصد ${validation.error_question_count ?? validation.error_count} أسئلة غير صالحة`,
          description: `تم قبول صياغة JSON، لكن ${validation.errors.length} تفاصيل تحقق تحتاج إلى تصحيح.`,
        });
        return;
      }

      setParsedExam(parsed);
      toast({
        title: "JSON سليم وجاهز للإدراج ✓",
        description: `تم فحص ${parsed.questions.length} سؤالاً بنجاح.`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "تعذر قراءة JSON",
        description: err?.message || "راجع بنية JSON وحاول مرة أخرى.",
      });
    } finally {
      setIsDryRunning(false);
    }
  };

  const handleDryRun = async () => {
    if (!selectedFile || isDryRunning) return;

    setIsDryRunning(true);
    try {
      const res = await dryRunQuestionImport(selectedFile);
      setDryRunResult(res);

      if (res.is_valid) {
        toast({
          title: "فحص الملف ناجح بالكامل ✓",
          description: `تم فحص ${res.total_scanned} سؤال بنجاح وجاهزة للاستيراد النهائي.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: `تم رصد ${res.error_question_count ?? res.error_count} أسئلة غير صالحة في الملف`,
          description: `يرجى مراجعة ${res.errors.length} تفاصيل تحقق أدناه وتصحيحها قبل الاستيراد النهائي.`,
        });
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "فشل فحص الملف",
        description: err?.message || "تعذر إتمام الفحص التجريبي، يرجى التأكد من صحة بنية الـ JSON.",
      });
    } finally {
      setIsDryRunning(false);
    }
  };

  const handleConfirmPaste = () => {
    if (!parsedExam) return;
    onImportSuccess?.(parsedExam.questions.length, parsedExam.questions, parsedExam);
    resetState();
    onClose();
  };

  const handleConfirmImport = async () => {
    if (!selectedFile || isImporting) return;

    if (!persistToExam) {
      if (!dryRunResult?.is_valid) return;
      onImportSuccess?.(
        dryRunResult.valid_count,
        dryRunResult.questions || [],
      );
      resetState();
      onClose();
      return;
    }

    setIsImporting(true);
    try {
      const res = await importQuestions(selectedFile, examId);
      const importedCount = dryRunResult?.valid_count || dryRunResult?.total_scanned || res?.count || 0;

      toast({
        title: "تم استيراد بنك الأسئلة بنجاح! 🚀",
        description: `تمت إضافة ${importedCount} سؤال إلى قاعدة بيانات الاختبارات بأمان.`,
      });

      onImportSuccess?.(importedCount, dryRunResult?.questions);
      resetState();
      onClose();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "فشل استيراد الأسئلة",
        description:
          err?.response?.data?.detail ||
          err?.message ||
          "حدث خطأ أثناء استيراد الأسئلة، تم إلغاء العملية بالكامل لضمان سلامة البيانات.",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isImporting) { resetState(); onClose(); } }}>
      <DialogContent
        className="sm:max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 text-foreground bg-card border border-border shadow-2xl space-y-5"
        dir="rtl"
      >
        <DialogHeader className="text-right space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                <FileCode className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-black">
                  استيراد أسئلة من ملف JSON
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  استيراد دفعة أسئلة مع الفحص المسبق والتحقق الذري (Dry-Run)
                </DialogDescription>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="gap-1.5 rounded-xl text-xs font-bold shrink-0 border-primary/30 text-primary hover:bg-primary/10"
            >
              <Download size={14} />
              تحميل نموذج JSON
            </Button>
          </div>
        </DialogHeader>

        <div className={persistToExam ? "flex justify-start" : "grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted/50 border border-border/60"}>
          {!persistToExam && (
            <Button type="button" variant={inputMode === "paste" ? "default" : "ghost"} onClick={() => { setInputMode("paste"); setDryRunResult(null); }} className="rounded-lg font-bold text-xs">
              لصق JSON مباشرة
            </Button>
          )}
          <Button type="button" variant={inputMode === "file" ? "default" : "ghost"} onClick={() => { setInputMode("file"); setParsedExam(null); }} className={persistToExam ? "rounded-lg font-bold text-xs" : "rounded-lg font-bold text-xs"}>
            رفع ملف JSON
          </Button>
        </div>

        {inputMode === "paste" ? (
          <div className="space-y-3">
            <textarea
              value={jsonText}
              onChange={(e) => { setJsonText(e.target.value); setDryRunResult(null); setParsedExam(null); }}
              placeholder='الصق JSON الذي أنشأه الذكاء الاصطناعي هنا...'
              className="min-h-[300px] w-full resize-y rounded-2xl border border-border bg-background p-4 font-mono text-xs leading-6 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              dir="ltr"
              spellCheck={false}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-muted-foreground">سيتم التحقق من البنية والإجابات الصحيحة قبل إدخال الأسئلة إلى النموذج.</p>
              <Button type="button" onClick={handlePasteValidate} disabled={!jsonText.trim() || isDryRunning} className="gap-2 rounded-xl font-bold shrink-0">
                {isDryRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                فحص JSON
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]); }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                dragOver ? "border-primary bg-primary/10 scale-[1.01]" : selectedFile ? "border-emerald-500/50 bg-emerald-500/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
              {selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center"><FileCheck className="w-6 h-6" /></div>
                  <p className="text-sm font-bold text-foreground">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{(selectedFile.size / 1024).toFixed(1)} كيلوبايت</p>
                  <p className="text-xs text-primary font-medium mt-1">انقر أو اسحب ملفاً آخر لتغييره</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center"><UploadCloud className="w-6 h-6 text-primary" /></div>
                  <p className="text-sm font-bold text-foreground">اسحب ملف الـ JSON هنا أو <span className="text-primary underline">تصفح من جهازك</span></p>
                  <p className="text-xs text-muted-foreground">يقبل الملفات بصيغة JSON فقط متوافقة مع نموذج الأسئلة المعتمد</p>
                </div>
              )}
            </div>
            {selectedFile && !dryRunResult && (
              <div className="flex justify-center">
                <Button type="button" onClick={handleDryRun} disabled={isDryRunning} className="gap-2 rounded-xl font-bold min-h-[44px] px-6 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md">
                  {isDryRunning ? <><Loader2 className="w-4 h-4 animate-spin" /><span>جاري فحص وتدقيق الملف...</span></> : <><Sparkles className="w-4 h-4" /><span>معاينة وفحص الملف (Dry-Run)</span></>}
                </Button>
              </div>
            )}
          </>
        )}

        {/* Dry-Run Results Display */}
        {dryRunResult && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Stats Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 bg-muted/40 rounded-xl border border-border text-center">
                <p className="text-xs text-muted-foreground font-medium">إجمالي الأسئلة</p>
                <p className="text-lg sm:text-xl font-black text-foreground mt-0.5 font-mono">
                  {dryRunResult.total_scanned}
                </p>
              </div>

              <div className="p-3.5 bg-emerald-500/10 rounded-xl border border-emerald-500/25 text-center">
                <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">الأسئلة الجاهزة</p>
                <p className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                  {dryRunResult.valid_count}
                </p>
              </div>

              <div className="p-3.5 bg-rose-500/10 rounded-xl border border-rose-500/25 text-center">
                <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">الأسئلة التي بها أخطاء</p>
                <p className="text-lg sm:text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5 font-mono">
                  {dryRunResult.error_question_count ?? dryRunResult.error_count}
                </p>
              </div>
            </div>

            {/* Errors List or Success Alert */}
            {dryRunResult.is_valid ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold">جميع الأسئلة اجتازت الفحص القياسي بنجاح!</p>
                  <p className="text-xs opacity-90 mt-0.5">
                    يمكنك الآن اعتماد الاستيراد، وستتم العملية بشكل ذري بالكامل.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-rose-600 dark:text-rose-400">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    تفاصيل الأخطاء المطلوب معالجتها ({dryRunResult.errors.length}):
                  </span>
                </div>

                <div className="border border-border/80 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <Table className="text-xs">
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-14 text-center">السطر</TableHead>
                        <TableHead>الحقل</TableHead>
                        <TableHead>نص السؤال / الملاحظة</TableHead>
                        <TableHead className="text-rose-600">رسالة الخطأ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dryRunResult.errors.map((err, i) => (
                        <TableRow key={i} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-center font-bold text-muted-foreground">
                            {err.row}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-foreground font-semibold">
                            {err.field}
                          </TableCell>
                          <TableCell className="text-muted-foreground truncate max-w-[180px]">
                            {err.question_text || "—"}
                          </TableCell>
                          <TableCell className="font-medium text-rose-600 dark:text-rose-400">
                            {err.message}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              resetState();
              onClose();
            }}
            disabled={isImporting}
            className="w-full sm:w-auto rounded-xl font-bold text-xs sm:text-sm min-h-[44px]"
          >
            إغلاق
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {dryRunResult && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDryRun}
                disabled={isDryRunning || isImporting}
                className="w-full sm:w-auto gap-1.5 rounded-xl font-bold text-xs min-h-[44px]"
              >
                <RotateCcw size={14} className={isDryRunning ? "animate-spin" : ""} />
                إعادة الفحص
              </Button>
            )}

            <Button
              type="button"
              onClick={inputMode === "paste" ? handleConfirmPaste : handleConfirmImport}
              disabled={inputMode === "paste" ? !parsedExam || isImporting : !selectedFile || !dryRunResult || !dryRunResult.is_valid || isImporting}
              className="w-full sm:w-auto gap-2 rounded-xl font-bold text-xs sm:text-sm min-h-[44px] bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all disabled:opacity-50"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري استيراد الأسئلة...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{inputMode === "paste" ? "إدراج الأسئلة في النموذج" : "تأكيد واستيراد الأسئلة"}</span>
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuestionBankImportModal;
