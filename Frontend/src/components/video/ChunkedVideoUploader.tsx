import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useUploadVideoChunk, useCompleteVideoUpload, useVideo } from "@/features/courses/hooks";
import type { VideoAsset } from "@/types/course";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { UploadCloud, Film, CheckCircle2, AlertCircle, Loader2, X, RefreshCw, FileVideo } from "lucide-react";

interface ChunkedVideoUploaderProps {
  /** Called immediately when upload completes and Video record is created (status may still be pending/processing). */
  onSuccess?: (video: VideoAsset) => void;
  /** Called when transcoding finishes and video status becomes "ready". */
  onVideoReady?: (video: VideoAsset) => void;
  defaultTitle?: string;
  /** Called whenever the browser-side chunk upload starts/stops. */
  onUploadStateChange?: (uploading: boolean) => void;
}

const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MiB per request; supports 1 GiB in 128 chunks
const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1 GiB
const ALLOWED_EXTENSIONS = [".mp4", ".mov", ".mkv", ".webm", ".avi"];
const MAX_CONCURRENT_CHUNKS = 3;
const MAX_CHUNK_RETRIES = 4;

export const ChunkedVideoUploader: React.FC<ChunkedVideoUploaderProps> = ({
  onSuccess,
  onVideoReady,
  defaultTitle = "",
  onUploadStateChange,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoTitle, setVideoTitle] = useState(defaultTitle);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdVideoId, setCreatedVideoId] = useState<number | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const uploadChunkMutation = useUploadVideoChunk();
  const completeUploadMutation = useCompleteVideoUpload();

  // Poll video status once created
  const { data: videoData } = useVideo(createdVideoId || 0, !!createdVideoId);

  // Notify parent when status reaches ready
  React.useEffect(() => {
    if (videoData && videoData.status === "ready" && onVideoReady) {
      onVideoReady(videoData);
    }
  }, [videoData, onVideoReady]);

  const handleFileSelect = (file: File) => {
    setErrorMessage(null);

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage(t("video.fileTooLarge", "حجم الفيديو يتجاوز الحد الأقصى المسموح به (1 جيجابايت)."));
      return;
    }

    // Validate extension
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setErrorMessage(
        t("video.invalidFormat", "صيغة الفيديو غير مدعومة. يرجى اختيار ملف MP4, MOV, MKV أو WebM.")
      );
      return;
    }

    setSelectedFile(file);
    if (!videoTitle) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setVideoTitle(nameWithoutExt);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const startUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    onUploadStateChange?.(true);
    setUploadProgress(0);
    setErrorMessage(null);

    const uploadId = "up_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
    const totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE);

    try {
      let completedChunks = 0;
      let nextChunkIndex = 0;

      const uploadChunkWithRetry = async (chunkIndex: number) => {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(selectedFile.size, start + CHUNK_SIZE);
        const chunk = selectedFile.slice(start, end);

        for (let attempt = 1; attempt <= MAX_CHUNK_RETRIES; attempt++) {
          try {
            await uploadChunkMutation.mutateAsync({
              uploadId,
              chunkIndex,
              totalChunks,
              chunk,
            });
            completedChunks += 1;
            setUploadProgress(Math.round((completedChunks / totalChunks) * 100));
            return;
          } catch (error) {
            if (attempt === MAX_CHUNK_RETRIES) throw error;
            await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (attempt - 1)));
          }
        }
      };

      const worker = async () => {
        while (true) {
          const chunkIndex = nextChunkIndex++;
          if (chunkIndex >= totalChunks) return;
          await uploadChunkWithRetry(chunkIndex);
        }
      };

      await Promise.all(
        Array.from(
          { length: Math.min(MAX_CONCURRENT_CHUNKS, totalChunks) },
          () => worker(),
        ),
      );

      // Complete upload
      const videoResult = await completeUploadMutation.mutateAsync({
        upload_id: uploadId,
        title: videoTitle.trim() || selectedFile.name,
        total_chunks: totalChunks,
        file_name: selectedFile.name,
      });

      setCreatedVideoId(videoResult.id);
      setIsUploading(false);
      onUploadStateChange?.(false);

      // Notify parent immediately (video may still be processing)
      if (onSuccess) {
        onSuccess(videoResult);
      }
    } catch (err: any) {
      setIsUploading(false);
      onUploadStateChange?.(false);
      setErrorMessage(
        err?.response?.data?.detail ||
          t("video.uploadFailed", "فشل رفع الفيديو. يرجى التحقق من اتصال الإنترنت والمحاولة مجدداً.")
      );
    }
  };

  const resetUploader = () => {
    setSelectedFile(null);
    setCreatedVideoId(null);
    setUploadProgress(0);
    setIsUploading(false);
    setErrorMessage(null);
    setIsDragActive(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Card className="border-0 shadow-lg bg-card/60 backdrop-blur-xl overflow-hidden ring-1 ring-border/50 transition-all duration-300">
      <CardContent className="p-0">
        <AnimatePresence mode="wait">
          {/* STATE 1: Empty / Drag & Drop Zone */}
          {!selectedFile && !createdVideoId && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="p-8"
            >
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative group flex flex-col items-center justify-center p-12 gap-5 rounded-3xl border-2 border-dashed cursor-pointer transition-all duration-300 ${
                  isDragActive
                    ? "border-primary bg-primary/10 scale-[1.02]"
                    : "border-border/60 hover:border-primary/50 bg-background/50 hover:bg-primary/5"
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl pointer-events-none" />
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="video/mp4,video/quicktime,video/x-matroska,video/webm,video/x-msvideo"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />
                
                <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isDragActive ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : "bg-primary/10 text-primary group-hover:scale-110"
                }`}>
                  <UploadCloud className="w-10 h-10" />
                </div>

                <div className="text-center space-y-2 z-10">
                  <h3 className="font-bold text-lg text-foreground">
                    {isDragActive 
                      ? t("video.dropHere", "أفلت الملف هنا...") 
                      : t("video.dragAndDrop", "اسحب وأفلت ملف الفيديو هنا")}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
                    {t("video.clickToBrowse", "أو اضغط لاختيار ملف من جهازك. يدعم MP4, MOV, MKV, WebM وAVI بحجم أقصى 1 جيجابايت.")}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* STATE 2: File Selected & Uploading */}
          {selectedFile && !createdVideoId && (
            <motion.div
              key="uploading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="p-6 space-y-6"
            >
              <div className="flex items-start justify-between p-4 bg-background/80 rounded-2xl border border-border/60 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <FileVideo className="w-6 h-6" />
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="font-bold text-foreground text-sm truncate" dir="ltr" style={{ textAlign: 'left' }}>
                      {selectedFile.name}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                    </p>
                  </div>
                </div>
                {!isUploading && (
                  <Button variant="ghost" size="icon" onClick={resetUploader} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full h-8 w-8">
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span>{t("video.titleLabel", "عنوان الدرس / الفيديو")}</span>
                  <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  disabled={isUploading}
                  placeholder={t("video.titlePlaceholder", "اكتب عنواناً جذاباً للدرس...")}
                  className="w-full h-12 px-4 rounded-xl border border-border/80 bg-background/50 text-sm font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200"
                />
              </div>

              {isUploading ? (
                <div className="space-y-3 p-5 bg-primary/5 rounded-2xl border border-primary/10">
                  <div className="flex items-center justify-between text-sm font-bold text-primary">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("video.uploading", "جاري الرفع المجزأ والآمن...")}
                    </span>
                    <span className="bg-primary/10 px-2 py-0.5 rounded-md">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-3 bg-primary/10 [&>div]:bg-primary" />
                </div>
              ) : (
                <Button
                  onClick={startUpload}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 rounded-xl gap-2 shadow-md hover:shadow-lg transition-all duration-300"
                >
                  <UploadCloud className="w-5 h-5" />
                  {t("video.startUpload", "بدء رفع ومعالجة الفيديو")}
                </Button>
              )}
            </motion.div>
          )}

          {/* STATE 3: Processing / Ready Status */}
          {createdVideoId && videoData && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="p-8 text-center"
            >
              {videoData.status === "processing" || videoData.status === "pending" ? (
                <div className="flex flex-col items-center justify-center gap-4">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-warning/10 border-2 border-warning/20 flex items-center justify-center text-warning relative z-10">
                      <Loader2 className="w-10 h-10 animate-spin" />
                    </div>
                    <div className="absolute inset-0 rounded-full bg-warning/20 animate-ping" />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground text-lg">
                      {t("video.processingTitle", "جاري معالجة الفيديو وتقسيمه...")}
                    </h4>
                    <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
                      {t(
                        "video.processingDesc",
                        "يقوم خادم المعالجة الآن بإنشاء نسخ 720p و 480p و 360p مع تشفير البث المباشر (DRM). يمكنك المتابعة وسيتم التحديث في الخلفية."
                      )}
                    </p>
                  </div>
                </div>
              ) : videoData.status === "ready" ? (
                <div className="flex flex-col items-center justify-center gap-4">
                  <motion.div 
                    initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }}
                    className="w-20 h-20 rounded-full bg-success/10 border-2 border-success/20 flex items-center justify-center text-success"
                  >
                    <CheckCircle2 className="w-10 h-10" />
                  </motion.div>
                  <div>
                    <h4 className="font-bold text-foreground text-lg">
                      {t("video.readyTitle", "تمت معالجة الفيديو بنجاح وجاهز للعرض!")}
                    </h4>
                    <p className="text-sm text-success/80 mt-1 font-medium bg-success/5 inline-block px-3 py-1 rounded-full border border-success/10">
                      {t("video.readyQualities", "الجودات المتاحة: 720p, 480p, 360p")}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={resetUploader} className="mt-4 gap-2 rounded-xl h-10 px-5 font-bold border-border/80 hover:bg-muted/50">
                    <RefreshCw className="w-4 h-4" />
                    {t("video.uploadAnother", "رفع فيديو آخر")}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-destructive/10 border-2 border-destructive/20 flex items-center justify-center text-destructive">
                    <AlertCircle className="w-10 h-10" />
                  </div>
                  <div>
                    <h4 className="font-bold text-destructive text-lg">
                      {t("video.failedTitle", "تعذر إكمال معالجة الفيديو")}
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1 bg-destructive/5 px-3 py-1.5 rounded-lg border border-destructive/10">
                      {videoData.errorMessage || t("video.unknownError", "حدث خطأ غير معروف في خادم المعالجة.")}
                    </p>
                  </div>
                  <Button variant="outline" onClick={resetUploader} className="mt-4 rounded-xl h-10 px-6 font-bold">
                    {t("video.tryAgain", "إعادة المحاولة")}
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {errorMessage && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="px-6 pb-6"
          >
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-3 text-destructive text-sm font-medium">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
};

export default ChunkedVideoUploader;
