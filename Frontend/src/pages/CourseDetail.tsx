import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress"; // Ensure Progress is imported
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ChevronDown,
  ChevronUp,
  PlayCircle,
  FileText,
  Clock,
  Users,
  Star,
  MessageSquare,
  Share2,
  Heart,
  ShoppingCart,
  BarChart,
  CheckCircle,
  Lock,
  GraduationCap,
  Award,
  FileQuestion,
  Gift,
} from "lucide-react";
import { motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { Link, useParams, Navigate, useNavigate } from "react-router-dom";
import React, { useMemo, useState, useEffect } from "react";
import { useCourse, useCourseEnrollment, useSubmitCourseReview, useCourseReviews } from "@/features/courses/hooks";
import { useCourseExams } from "@/features/exams";
import { useAuth } from "@/features/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enrollCourse } from "@/features/courses/api";
import { useToast } from "@/components/ui/use-toast";
import CheckoutModal from "@/components/finance/CheckoutModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";


const CourseDetail = () => {
  const params = useParams<{ id?: string; courseId?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSaved, setIsSaved] = React.useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [expandedSections, setExpandedSections] = React.useState<Record<number, boolean>>({});

  const toggleSection = (index: number) => {
    setExpandedSections(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const rawId = params.id || params.courseId || "1";
  const parsedId = parseInt(rawId.split("-")[0], 10);
  const validId = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : 1;
  
  const { data: courseData, isLoading, error } = useCourse(validId);
  const { data: enrollment } = useCourseEnrollment(validId);
  const isEnrolled = !!enrollment;
  const { data: courseExams = [] } = useCourseExams(validId);

  const queryClient = useQueryClient();
  const enrollMutation = useMutation({
    mutationFn: () => enrollCourse(validId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      toast({
        title: "تم التسجيل بنجاح!",
        description: "تمت إضافتك لهذه الدورة بنجاح، يمكنك الآن البدء في المشاهدة.",
      });
    }
  });

  const handleToggleSave = () => {
    setIsSaved(prev => !prev);
    toast({
      title: !isSaved ? "تم حفظ الدورة" : "تم إزالة الدورة من المفضلة",
      description: !isSaved ? "تمت إضافة الدورة إلى قائمتك المفضلة." : "",
    });
  };

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "تم نسخ رابط الدورة",
        description: "يمكنك مشاركته الآن مع أصدقائك.",
      });
    }
  };

  const { user } = useAuth();
  const { data: remoteReviews } = useCourseReviews(validId);
  const reviewsData = remoteReviews && remoteReviews.length > 0 ? remoteReviews : courseData?.reviews || [];

  const { mutate: submitReview, isPending: isSubmittingReview } = useSubmitCourseReview();
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedRating, setSelectedRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  const myReview = useMemo(() => {
    if (!user?.id) return null;
    return reviewsData.find(
      (r: any) => String(r.studentId ?? r.student_id) === String(user.id)
    );
  }, [reviewsData, user?.id]);

  useEffect(() => {
    if (myReview) {
      setSelectedRating(myReview.rating || 5);
      setReviewComment(myReview.comment || "");
    }
  }, [myReview]);

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    submitReview(
      {
        courseId: validId,
        data: {
          rating: selectedRating,
          comment: reviewComment.trim(),
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "شكراً لتقييمك! ⭐",
            description: "تم حفظ تقييمك ورأيك في الدورة والمعلم بنجاح.",
          });
          setIsReviewModalOpen(false);
        },
        onError: (err: any) => {
          toast({
            title: "تعذر حفظ التقييم",
            description: err?.message || err?.detail || "حدث خطأ أثناء حفظ التقييم.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const syllabusData = courseData?.modules || [];
  const firstLessonId = syllabusData[0]?.lessons[0]?.id || 1;
  const resumeLessonId = enrollment?.nextLessonId || (enrollment as any)?.next_lesson_id || firstLessonId;
  const relatedCourses = courseData?.relatedCourses || [];


  const totalLessons = syllabusData.reduce((sum, section) => sum + (section.lessons?.length || 0), 0);
  const completedLessons = enrollment?.completedLessonIds?.length || 0;
  const courseProgress = enrollment?.progress || 0;

  // Animation variants
  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const sectionVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };
  
  const ratingStats = useMemo(() => {
    const totalReviews = reviewsData.length || courseData?.reviewCount || 0;
    const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviewsData.forEach((r: any) => {
      const star = Math.min(5, Math.max(1, Math.round(Number(r.rating) || 5)));
      counts[star] = (counts[star] || 0) + 1;
    });

    const colors: Record<number, string> = {
      5: "bg-green-500",
      4: "bg-lime-500",
      3: "bg-yellow-500",
      2: "bg-orange-500",
      1: "bg-red-500",
    };

    return [5, 4, 3, 2, 1].map((star) => {
      const count = reviewsData.length > 0
        ? counts[star]
        : totalReviews > 0
        ? Math.round((star === 5 ? 0.75 : star === 4 ? 0.15 : star === 3 ? 0.06 : 0.02) * totalReviews)
        : 0;
      const percentage = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
      return { rating: star, percentage, count, color: colors[star] };
    });
  }, [reviewsData, courseData?.reviewCount]);

  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    return <Navigate to="/404" replace />;
  }

  // Derive variables from courseData or provide safe fallbacks
  const courseDetails = courseData ? {
    ...courseData,
    whatYouWillLearn: courseData.objectives || [],
    requirements: courseData.requirements || [],
    targetAudience: courseData.targetAudience || [],
    lastUpdated: new Date(courseData.updatedAt).toLocaleDateString("ar-EG", { year: "numeric", month: "long" }),
    reviewsCount: courseData.reviewCount || 0,
    studentsCount: courseData.studentCount || 0,
    thumbnail: courseData.image || "/placeholder.svg",
  } : null;

  const instructorData = courseData?.instructor || {
    id: 0,
    name: "",
    title: "",
    avatar: "/placeholder.svg",
    rating: 0,
    studentCount: 0,
    courseCount: 0,
    reviewCount: 0,
    bio: "",
  };

  if (isLoading || !courseDetails) {
    return (
      <Layout>
        <div className="container mx-auto py-8 px-4 space-y-8 animate-pulse">
          <div className="bg-muted/40 p-8 rounded-2xl h-64 w-full border" />
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-4">
              <div className="h-8 bg-muted/60 rounded-lg w-1/3" />
              <div className="h-32 bg-muted/40 rounded-xl" />
            </div>
            <div className="md:col-span-1">
              <div className="h-80 bg-muted/60 rounded-2xl" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="container mx-auto py-16 px-4 text-center">
          <div className="max-w-md mx-auto p-8 rounded-2xl border bg-card shadow-sm space-y-4">
            <h2 className="text-xl font-bold text-destructive">حدث خطأ أثناء تحميل الدورة</h2>
            <p className="text-sm text-muted-foreground">تعذر جلب بيانات الدورة التعليمية، يرجى المحاولة لاحقاً.</p>
            <Button onClick={() => window.location.reload()} variant="outline">إعادة المحاولة</Button>
          </div>
        </div>
      </Layout>
    );
  }


  return (
    <Layout>
      <motion.div 
        className="container mx-auto py-8 px-4"
        variants={pageVariants}
        initial="initial"
        animate="animate"
      >
        {/* Header Section */}
        <motion.header 
          className="bg-slate-100/90 dark:bg-card/60 border border-slate-200/80 dark:border-border/80 p-6 sm:p-8 rounded-3xl mb-8 shadow-md"
          variants={sectionVariants}
        >
          <div className="grid md:grid-cols-3 gap-8 items-center">
            <div className="md:col-span-2">
              <Badge variant="secondary" className="mb-2">{courseDetails.category?.name || "عام"}</Badge>
              <h1 className="text-3xl md:text-4xl font-bold mb-3">{courseDetails.title}</h1>
              <p className="text-slate-600 dark:text-muted-foreground mb-4 text-lg">{courseDetails.description?.substring(0,150) || ""}...</p>
              <div className="flex items-center gap-4 mb-4 text-sm">
                <div className="flex items-center gap-1">
                  <Star className="text-yellow-400 fill-yellow-400" size={18} />
                  <span>{courseDetails.rating} ({courseDetails.reviewsCount} تقييم)</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users size={18} />
                  <span>{courseDetails.studentsCount} طالب</span>
                </div>
                <span>آخر تحديث: {courseDetails.lastUpdated}</span>
              </div>
              <div className="text-sm">
                <span>المدرب: </span>
                <Link to={`/instructor/${instructorData.id || ''}`} className="text-primary hover:underline font-medium">
                  {instructorData.name}
                </Link>
              </div>
            </div>
            <div className="md:col-span-1">
              <Card className="shadow-2xl shadow-slate-900/10 dark:shadow-black/50 border border-slate-200 dark:border-border/80 rounded-2xl overflow-hidden bg-white dark:bg-card">
                <div className="aspect-video relative">
                  <img src={courseDetails.thumbnail} alt={courseDetails.title} className="object-cover w-full h-full" loading="lazy" decoding="async" width={400} height={225} />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-16 w-16">
                      <PlayCircle size={48} />
                    </Button>
                  </div>
                </div>
                <CardContent className="p-4">
                  {!isEnrolled ? (
                    <>
                      <div className="flex items-baseline gap-2 mb-3">
                        {courseDetails.isFree || Number(courseDetails.price) === 0 ? (
                          <div className="flex items-center gap-2">
                            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">مجاناً</span>
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs">
                              دورة مجانية 100%
                            </Badge>
                          </div>
                        ) : (
                          <>
                            <span className="text-3xl font-bold text-primary">${courseDetails.price}</span>
                            {courseDetails.originalPrice && (
                               <span className="text-muted-foreground line-through">${courseDetails.originalPrice}</span>
                            )}
                            {courseDetails.discountPercentage && (
                              <Badge variant="destructive">{courseDetails.discountPercentage}% خصم</Badge>
                            )}
                          </>
                        )}
                      </div>
                      <Button
                        size="lg"
                        className="w-full mb-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md gap-2"
                        onClick={() => navigate(`/course/${validId}/checkout`)}
                      >
                        {courseDetails.isFree || Number(courseDetails.price) === 0 ? (
                          <>
                            <Gift size={18} />
                            الاشتراك في الدورة مجاناً
                          </>
                        ) : (
                          <>
                            <ShoppingCart size={18} />
                            شراء الدورة والاشتراك الفوري
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground text-center mb-2">
                        {courseDetails.isFree || Number(courseDetails.price) === 0
                          ? "تسجيل مجاني فوري بدون أي بطاقة بنكية"
                          : "دفع آمن عبر كاشيير والمحافظ الرقمية"}
                      </p>
                    </>
                  ) : (
                    <div className="space-y-3 mb-3">
                      <div className="flex items-center justify-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-700 dark:text-emerald-400 font-bold text-base">
                        <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>تم الاشتراك</span>
                      </div>
                      <Link to={`/lesson/${validId}/${resumeLessonId}`} className="block w-full">
                        <Button size="lg" className="w-full font-bold shadow-md">
                          متابعة التعلم
                        </Button>
                      </Link>
                    </div>
                  )}
                  <div className="flex justify-around text-sm">
                    <Button variant="ghost" size="sm" onClick={handleToggleSave} className={isSaved ? "text-red-500 font-bold" : "text-muted-foreground"}>
                      <Heart size={16} className={`ms-1 ${isSaved ? "fill-red-500 text-red-500" : ""}`} />
                      {isSaved ? "محفوظة" : "حفظ"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleShare} className="text-muted-foreground">
                      <Share2 size={16} className="ml-1" />
                      مشاركة
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </motion.header>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <motion.div className="lg:col-span-2 space-y-8" variants={sectionVariants}>
            {/* What you'll learn */}
            <Card>
              <CardHeader>
                <CardTitle>ماذا ستتعلم في هذه الدورة؟</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid md:grid-cols-2 gap-x-6 gap-y-3 list-inside">
                  {courseDetails.whatYouWillLearn.map((item, index) => (
                    <li key={index} className="flex items-start">
                      <CheckCircle className="text-green-500 mr-2 mt-1 shrink-0" size={18} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            
            {/* Course Content (Syllabus) */}
            <Card>
              <CardHeader>
                <CardTitle>محتوى الدورة</CardTitle>
                <div className="text-sm text-muted-foreground flex justify-between items-center">
                  <span>{syllabusData.length} أقسام • {totalLessons} دروس • إجمالي المدة {courseDetails.duration}</span>
                  <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => setExpandedSections(prev => {
                    const allExpanded = Object.values(prev).every(Boolean) && Object.keys(prev).length === syllabusData.length;
                    const newExpanded: Record<number, boolean> = {};
                    syllabusData.forEach((_,idx) => newExpanded[idx] = !allExpanded);
                    return newExpanded;
                  })}>
                    {Object.values(expandedSections).every(Boolean) && Object.keys(expandedSections).length === syllabusData.length ? "طي الكل" : "توسيع الكل"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" value={Object.keys(expandedSections).filter(key => expandedSections[parseInt(key)])} onValueChange={(values) => {
                    const newExpanded: Record<number, boolean> = {};
                    syllabusData.forEach((_, idx) => newExpanded[idx] = values.includes(idx.toString()));
                    setExpandedSections(newExpanded);
                }}>
                  {syllabusData.map((section, sectionIndex) => (
                    <AccordionItem value={sectionIndex.toString()} key={sectionIndex}>
                      <AccordionTrigger className="hover:bg-muted/50 px-4 py-3 rounded-md">
                        <div className="flex-1 text-right font-semibold">{section.title}</div>
                        <div className="text-sm text-muted-foreground mr-auto pl-2">
                          {section.lessons.length} دروس
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-2 py-1">
                        <ul className="space-y-1">
                          {section.lessons.map((lesson, lessonIndex) => {
                            const isAccessible = isEnrolled || lesson.isFree;
                            return (
                              <li key={lessonIndex}>
                                {isAccessible ? (
                                  <Link
                                    to={`/lesson/${validId}/${lesson.id}`}
                                    className="flex items-center justify-between p-2.5 hover:bg-primary/5 rounded-lg transition-colors group cursor-pointer border border-transparent hover:border-primary/20"
                                  >
                                    <div className="flex items-center gap-2">
                                      {lesson.type === "video" ? (
                                        <PlayCircle size={18} className="text-primary group-hover:scale-110 transition-transform shrink-0" />
                                      ) : (
                                        <FileText size={18} className="text-blue-500 group-hover:scale-110 transition-transform shrink-0" />
                                      )}
                                      <span className="font-medium group-hover:text-primary transition-colors text-sm">{lesson.title}</span>
                                      {lesson.isFree && (
                                        <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-200">معاينة مجانية</Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <span>{lesson.duration}</span>
                                      {isEnrolled ? (
                                        <CheckCircle size={14} className="text-green-500" />
                                      ) : (
                                        <PlayCircle size={14} className="text-green-600" />
                                      )}
                                    </div>
                                  </Link>
                                ) : (
                                  <div className="flex items-center justify-between p-2.5 text-muted-foreground/70 opacity-80 cursor-not-allowed rounded-lg">
                                    <div className="flex items-center gap-2">
                                      {lesson.type === "video" ? (
                                        <PlayCircle size={18} className="opacity-50 shrink-0" />
                                      ) : (
                                        <FileText size={18} className="opacity-50 shrink-0" />
                                      )}
                                      <span className="text-sm">{lesson.title}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                      <span>{lesson.duration}</span>
                                      <Lock size={14} className="text-amber-500" />
                                    </div>
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>

            {/* Course Exams & Assessments Section */}
            {courseExams.length > 0 && (
              <Card className="border-primary/20 shadow-sm overflow-hidden">
                <CardHeader className="bg-primary/5 pb-4 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold flex items-center gap-2.5 text-foreground">
                      <GraduationCap className="text-primary h-5 w-5" />
                      امتحانات وتدريبات الدورة
                    </CardTitle>
                    <Badge variant="secondary" className="font-semibold text-xs">
                      {courseExams.length} {courseExams.length === 1 ? "اختبار" : courseExams.length === 2 ? "اختباران" : "اختبارات"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-3">
                  {courseExams.map((exam) => {
                    const duration = exam.durationMinutes || exam.duration_minutes || 30;
                    const passScore = exam.passThreshold || exam.pass_threshold || 50;
                    const questionsCount = exam.totalQuestions || exam.total_questions || exam.questions?.length || 0;

                    return (
                      <div
                        key={exam.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border/70 hover:border-primary/40 hover:bg-muted/30 transition-all gap-4"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm sm:text-base text-foreground">
                              {exam.title}
                            </span>
                            {exam.examType === "quiz" || exam.exam_type === "quiz" ? (
                              <Badge variant="outline" className="text-[11px] bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border-sky-200">
                                تدريب قصير
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[11px] bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200">
                                اختبار شامل
                              </Badge>
                            )}
                          </div>
                          {exam.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {exam.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {duration} دقيقة
                            </span>
                            <span className="flex items-center gap-1">
                              <FileQuestion className="w-3.5 h-3.5" />
                              {questionsCount > 0 ? `${questionsCount} سؤال` : "متعدد الأسئلة"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Award className="w-3.5 h-3.5 text-amber-500" />
                              نسبة النجاح {passScore}%
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          {isEnrolled ? (
                            <Link to={`/exam/${exam.id}`}>
                              <Button size="sm" className="gap-1.5 font-bold shadow-xs">
                                <FileQuestion className="w-4 h-4" />
                                بدء الاختبار
                              </Button>
                            </Link>
                          ) : (
                            <Button size="sm" variant="outline" disabled className="gap-1.5 text-xs">
                              <Lock className="w-3.5 h-3.5" />
                              متاح للمشتركين فقط
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Requirements */}
            <Card>
              <CardHeader><CardTitle>متطلبات الدورة</CardTitle></CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-1">
                  {courseDetails.requirements.map((req, index) => <li key={index}>{req}</li>)}
                </ul>
              </CardContent>
            </Card>

            {/* Description */}
             <Card>
              <CardHeader><CardTitle>وصف الدورة</CardTitle></CardHeader>
              <CardContent className="prose dark:prose-invert max-w-none">
                <p>{courseDetails.description}</p>
                {/* Add more detailed description if available */}
              </CardContent>
            </Card>

            {/* Instructor */}
            <Card>
              <CardHeader><CardTitle>عن المدرب</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={instructorData.avatar} alt={instructorData.name} />
                    <AvatarFallback>{instructorData.name.substring(0,2)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-semibold text-primary">{instructorData.name}</h3>
                    <p className="text-sm text-muted-foreground mb-1">{instructorData.title}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
                       <div className="flex items-center gap-1">
                         <Star className="text-yellow-400 fill-yellow-400" size={16} /> {instructorData.rating} تقييم المدرب
                       </div>
                       <div className="flex items-center gap-1">
                         <MessageSquare size={16} /> {instructorData.reviewCount ?? 0} مراجعة
                       </div>
                       <div className="flex items-center gap-1">
                         <Users size={16} /> {instructorData.studentCount ?? 0} طالب
                       </div>
                       <div className="flex items-center gap-1">
                         <BarChart size={16} /> {instructorData.courseCount ?? 0} دورات
                       </div>
                    </div>
                    <p className="text-sm">{instructorData.bio}</p>
                    <Link to={`/instructor/${instructorData.id || 1}`}>
                      <Button variant="outline" size="sm" className="mt-3">عرض الملف الشخصي للمدرب</Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Student Feedback / Reviews */}
            <Card className="rounded-2xl border-border/60 overflow-hidden">
              <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base sm:text-lg font-bold">تقييمات الطلاب وآراء المشتركين</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-3xl font-black text-amber-500">{courseDetails.rating.toFixed(1)}</span>
                      <div className="flex flex-col">
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              size={16}
                              className={i < Math.round(courseDetails.rating) ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30"}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">متوسط التقييم ({reviewsData.length} تقييم)</span>
                      </div>
                    </div>
                  </div>

                  {isEnrolled && (
                    <Button
                      type="button"
                      onClick={() => setIsReviewModalOpen(true)}
                      size="sm"
                      className="rounded-xl font-bold gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white shadow-xs shrink-0"
                    >
                      <Star className="w-3.5 h-3.5 fill-current" />
                      {myReview ? "تعديل تقييمك للدورة" : "أضف تقييمك ورأيك"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-4 mb-6">
                  {ratingStats.map(stat => (
                    <div key={stat.rating} className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-16 text-right">
                        {stat.rating} نجوم
                      </span>
                      <Progress value={stat.percentage} className="h-2 flex-1" />
                      <span className="text-sm text-primary font-medium w-12 text-left">
                        {stat.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
                <div className="space-y-4">
                  {reviewsData.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-6">
                      لا توجد تقييمات لهذه الدورة بعد. كن أول من يقيّم الدورة!
                    </p>
                  ) : (
                    reviewsData.map((review: any) => (
                      <div key={review.id} className="border-t border-border/40 pt-4 first:border-0 first:pt-0">
                        <div className="flex items-center mb-2">
                          <Avatar className="h-9 w-9 me-3">
                            <AvatarImage src={review.studentAvatar} alt={review.studentName} />
                            <AvatarFallback>{review.studentName?.substring(0, 1) || "U"}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-bold text-xs sm:text-sm">{review.studentName}</p>
                            <div className="flex items-center text-[11px] text-muted-foreground gap-2">
                              <div className="flex">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    size={13}
                                    className={i < review.rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30"}
                                  />
                                ))}
                              </div>
                              <span>{review.createdAt ? new Date(review.createdAt).toLocaleDateString("ar-EG") : ""}</span>
                            </div>
                          </div>
                        </div>
                        {review.comment && (
                          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed ps-12">
                            {review.comment}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Review Submission Dialog Modal */}
            <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
              <DialogContent className="sm:max-w-md rounded-2xl dir-rtl" dir="rtl">
                <DialogHeader>
                  <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                    {myReview ? "تعديل تقييمك للدورة والمعلم" : "تقييم الدورة والمعلم"}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    شارك تجربتك ورأيك التعليمي لمساعدة زملائك الطلاب والمعلم على تحسين جودة المحتوى
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmitReview} className="space-y-4 py-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground block">
                      درجة التقييم (من 1 إلى 5 نجوم):
                    </label>
                    <div className="flex items-center gap-2 justify-center py-3 bg-muted/30 rounded-xl border border-border/50">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setSelectedRating(star)}
                          className="p-1 hover:scale-125 active:scale-95 transition-transform"
                          title={`${star} نجوم`}
                        >
                          <Star
                            className={`w-7 h-7 transition-colors ${
                              star <= selectedRating
                                ? "text-amber-500 fill-amber-500"
                                : "text-muted-foreground/30"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    <p className="text-center text-xs font-semibold text-amber-600 dark:text-amber-400">
                      {selectedRating === 5
                        ? "ممتاز جداً ⭐⭐⭐⭐⭐"
                        : selectedRating === 4
                        ? "جيد جداً ⭐⭐⭐⭐"
                        : selectedRating === 3
                        ? "متوسط ⭐⭐⭐"
                        : selectedRating === 2
                        ? "مقبول ⭐⭐"
                        : "ضعيف ⭐"}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground block">
                      رأيك وملاحظاتك (اختياري):
                    </label>
                    <textarea
                      rows={4}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="اكتب تعليقك وانطباعك عن أسلوب الشرح والتفاعل ومحتوى الدروس..."
                      className="w-full p-3 rounded-xl border border-border/80 bg-background text-xs outline-none focus:ring-2 focus:ring-primary/20 resize-none leading-relaxed"
                    />
                  </div>

                  <DialogFooter className="gap-2 sm:gap-0 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsReviewModalOpen(false)}
                      className="rounded-xl text-xs"
                    >
                      إلغاء
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmittingReview}
                      className="rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 gap-1.5"
                    >
                      {isSubmittingReview ? "جاري الحفظ..." : myReview ? "تحديث التقييم" : "إرسال التقييم"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>


          </motion.div>

          {/* Sidebar (Related Courses, etc.) - This part already exists */}
          <motion.aside className="lg:col-span-1 space-y-6" variants={sectionVariants}>
            {isEnrolled && (
              <Card>
                <CardHeader><CardTitle>تقدمك في الدورة</CardTitle></CardHeader>
                <CardContent>
                  <Progress value={courseProgress} className="mb-2 h-3" />
                  <p className="text-sm text-muted-foreground text-center">
                    أكملت {completedLessons} من {totalLessons} درس ({courseProgress || 0}%)
                  </p>
                  <Link to={`/lesson/${validId}/${resumeLessonId}`}>
                    <Button variant="outline" className="w-full mt-3">متابعة التعلم</Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle>دورات ذات صلة</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {relatedCourses.map(course => (
                  <Link to={`/course/${course.id}`} key={course.id} className="flex items-start gap-3 p-2 hover:bg-muted/50 rounded-md group">
                    <img src={course.image || "/placeholder.svg"} alt={course.title} className="w-24 h-16 object-cover rounded-md" loading="lazy" decoding="async" width={96} height={64} />
                    <div>
                      <h4 className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-2">{course.title}</h4>
                      <p className="text-xs text-muted-foreground">{course.instructor?.name}</p>
                      <div className="flex items-center gap-1 text-xs mt-1">
                        <Star className="text-yellow-400 fill-yellow-400" size={12} />
                        <span>{course.rating}</span>
                        <span className="font-bold text-primary ml-auto">${course.price}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </motion.aside>
        </div>
      </motion.div>

      {/* Kashier & Wallet Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        item={{
          id: validId,
          title: courseDetails.title,
          price: Number(courseDetails.price) || 0,
          type: "course",
          instructorName: courseDetails.instructor?.name,
          imageUrl: courseDetails.image,
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["course-enrollment", validId] });
          queryClient.invalidateQueries({ queryKey: ["enrollments"] });
        }}
      />
    </Layout>
  );
};

export default CourseDetail;
