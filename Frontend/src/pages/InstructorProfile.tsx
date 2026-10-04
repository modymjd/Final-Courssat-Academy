import React, { useState, useMemo } from "react";
import { useParams, Navigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { useInstructorProfile } from "@/features/users";
import { useAuth } from "@/features/auth";
import { useInstructorReviews, useSubmitInstructorReview } from "@/features/courses/hooks";
import { useToast } from "@/components/ui/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CheckCircle2, Star, Users, BookOpen, Mail, Globe, Twitter, Linkedin, Sparkles } from "lucide-react";
import CourseCard from "@/components/course/CourseCard";

const InstructorProfile: React.FC = () => {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Extract numeric id from params (supports /instructor/5 or /instructor/5-dr-ahmed-soliman)
  const rawId = decodeURIComponent(params.id || "1");
  const parsed = parseInt(rawId.split("-")[0], 10);
  const numericId = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;

  const { data, isLoading, error } = useInstructorProfile(numericId);
  const { data: reviewsResponse } = useInstructorReviews(numericId);
  const { mutate: submitReview, isPending: isSubmittingReview } = useSubmitInstructorReview();

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedRating, setSelectedRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  const reviewsList = useMemo(() => {
    if (reviewsResponse && Array.isArray(reviewsResponse)) return reviewsResponse;
    if (data?.reviews && Array.isArray(data.reviews)) return data.reviews;
    return [];
  }, [reviewsResponse, data?.reviews]);

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    submitReview(
      {
        instructorId: numericId,
        data: {
          rating: selectedRating,
          comment: reviewComment.trim(),
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "شكراً لتقييمك! ⭐",
            description: "تم إرسال تقييمك للمعلم بنجاح.",
          });
          setIsReviewModalOpen(false);
          setReviewComment("");
        },
        onError: (err: any) => {
          toast({
            title: "تعذر إرسال التقييم",
            description: err?.message || err?.detail || "تأكد من أنك مسجل في إحدى دورات هذا المعلم لتتمكن من تقييمه.",
            variant: "destructive",
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto py-16 px-4 animate-pulse space-y-8">
          <div className="h-64 bg-muted/40 rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1 h-96 bg-muted/40 rounded-2xl" />
            <div className="md:col-span-2 h-96 bg-muted/40 rounded-2xl" />
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !data || !data.instructor) {
    return (
      <Layout>
        <div className="container mx-auto py-20 px-4 text-center max-w-md">
          <h2 className="text-2xl font-bold mb-3">المدرب غير موجود</h2>
          <p className="text-muted-foreground text-sm mb-6">تعذر العثور على بيانات هذا المدرب في المنصة.</p>
        </div>
      </Layout>
    );
  }

  const instructor = data.instructor;
  const courses = data.courses || [];

  const displayStudents = instructor.studentsCount ?? instructor.totalStudents ?? 0;
  const displayRating = instructor.ratingAvg ?? instructor.rating ?? 0;
  const displayReviewCount = instructor.reviewCount ?? 0;

  return (
    <Layout>
      {/* Header Banner */}
      <div className="bg-gradient-to-b from-primary/10 via-primary/5 to-transparent py-14 px-4 border-b border-border/40 mb-8">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-right">
            <div className="relative">
              <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
                <AvatarImage src={instructor.avatar} alt={instructor.fullName} loading="lazy" />
                <AvatarFallback className="text-3xl font-bold bg-primary/10 text-primary">
                  {instructor.firstName?.[0]}{instructor.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              {instructor.isVerified && (
                <div className="absolute bottom-1 right-1 bg-background rounded-full p-1 shadow" title="مدرب معتمد">
                  <CheckCircle2 size={24} className="text-primary fill-primary/10" />
                </div>
              )}
            </div>

            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <h1 className="text-3xl font-black text-foreground">{instructor.fullName}</h1>
                {instructor.isVerified && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold gap-1">
                    <CheckCircle2 size={14} /> معتمد
                  </Badge>
                )}
                {instructor.isFeatured && (
                  <Badge className="bg-amber-500 text-white text-xs gap-1">
                    <Sparkles size={12} /> متميّز
                  </Badge>
                )}
              </div>

              <p className="text-lg text-muted-foreground font-medium">
                {instructor.title || instructor.specialization || "مدرب محترف في منصة كورسات"}
              </p>

              <div className="flex flex-wrap justify-center md:justify-start gap-3 xxs:gap-4 sm:gap-6 text-xs xs:text-sm font-semibold pt-2">
                <div className="flex items-center gap-1.5 text-amber-500">
                  <Star className="fill-amber-500" size={16} />
                  <span>{displayRating > 0 ? displayRating.toFixed(1) : "جديد"}</span>
                  {displayReviewCount > 0 && <span className="text-[11px] text-muted-foreground">({displayReviewCount})</span>}
                </div>
                <div className="flex items-center gap-1.5 text-foreground">
                  <Users className="text-primary" size={16} />
                  <span>{displayStudents.toLocaleString("ar-EG")} طالب</span>
                </div>
                <div className="flex items-center gap-1.5 text-foreground">
                  <BookOpen className="text-blue-500" size={16} />
                  <span>{courses.length} دورة</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button className="gap-2 shadow-md">
                <Mail size={16} /> تواصل مع المدرب
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto py-6 px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left Column: Bio & Social Links */}
          <div className="md:col-span-1 space-y-6">
            <Card className="border border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold">عن المدرب</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {instructor.bio || "لا توجد نبذة شخصية متوفرة لهذا المدرب حتى الآن."}
                </p>
              </CardContent>
            </Card>

            <Card className="border border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold">التواصل والروابط</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3.5 text-sm">
                <a href="#" className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors">
                  <Globe size={18} /> الموقع الشخصي
                </a>
                <a href="#" className="flex items-center gap-3 text-muted-foreground hover:text-sky-500 transition-colors">
                  <Twitter size={18} /> منصة X (تويتر)
                </a>
                <a href="#" className="flex items-center gap-3 text-muted-foreground hover:text-blue-600 transition-colors">
                  <Linkedin size={18} /> لينكد إن
                </a>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Instructor's Published Courses & Reviews */}
          <div className="md:col-span-2 space-y-8">
            {/* Courses Section */}
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-foreground">
                دورات المدرب ({courses.length})
              </h2>

              {courses.length === 0 ? (
                <Card className="bg-muted/30 border-dashed border-border/80">
                  <CardContent className="py-16 text-center text-muted-foreground">
                    <BookOpen size={40} className="mx-auto mb-3 opacity-50" />
                    <p className="text-base font-medium">لا توجد دورات متاحة حالياً لهذا المدرب.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {courses.map((course: any) => (
                    <CourseCard
                      key={course.id}
                      id={course.id}
                      title={course.title}
                      instructor={instructor.fullName}
                      image={course.image}
                      price={course.price}
                      category={(course.category as any)?.name || "عام"}
                      description={course.shortDescription}
                      duration={course.duration}
                      level={course.level}
                      isFree={course.isFree}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Reviews Section */}
            <div className="space-y-6 pt-6 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
                    تقييمات الطلاب ({reviewsList.length})
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">آراء وانطباعات الطلاب المسجلين مع هذا المدرب</p>
                </div>

                {user?.role === "student" && (
                  <Button
                    onClick={() => setIsReviewModalOpen(true)}
                    className="gap-2 font-bold shadow-xs"
                    size="sm"
                  >
                    <Star size={16} className="fill-current" />
                    تقييم المعلم
                  </Button>
                )}
              </div>

              {reviewsList.length === 0 ? (
                <Card className="bg-muted/20 border-dashed border-border/80">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Star size={36} className="mx-auto mb-2 text-muted-foreground/40" />
                    <p className="text-base font-semibold text-foreground">لا توجد تقييمات منشورة بعد</p>
                    <p className="text-xs text-muted-foreground mt-1">إذا كنت مسجلاً في إحدى دورات هذا المعلم، كن أول من يشارك تجربته!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {reviewsList.map((review: any) => {
                    const studentName = review.studentName || review.student_name || "طالب بالمنصة";
                    const rating = Number(review.rating) || 5;
                    const comment = review.comment || "";
                    const dateStr = review.createdAt || review.created_at;

                    return (
                      <Card key={review.id} className="border-border/60 bg-card/60 rounded-2xl">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-3 mb-2.5">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 border border-border">
                                <AvatarImage src={review.studentAvatar || review.student_avatar} />
                                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                  {studentName.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <h4 className="font-bold text-sm text-foreground">{studentName}</h4>
                                {dateStr && (
                                  <span className="text-[11px] text-muted-foreground">
                                    {new Date(dateStr).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" })}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  size={15}
                                  className={star <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}
                                />
                              ))}
                            </div>
                          </div>

                          {comment && (
                            <p className="text-sm text-foreground/90 leading-relaxed ps-13 whitespace-pre-wrap">
                              {comment}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Review Modal for Enrolled Students */}
      <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
        <DialogContent className="sm:max-w-md dir-rtl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
              تقييم المعلم: {instructor.fullName}
            </DialogTitle>
            <DialogDescription>
              شارك تجربتك مع هذا المعلم لمساعدة زملائك الطلاب.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitReview} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-2">
                التقييم العام (بالنجوم)
              </label>
              <div className="flex items-center justify-center gap-2 p-3 bg-muted/30 rounded-xl">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setSelectedRating(star)}
                    className="p-1 hover:scale-125 transition-transform focus:outline-hidden"
                  >
                    <Star
                      size={28}
                      className={
                        star <= selectedRating
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/30 hover:text-amber-200"
                      }
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-2">
                رأيك وتعليقك (اختياري)
              </label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="ما الذي أعجبك في شرح المعلم وتفاعله معك؟"
                rows={4}
                className="w-full p-3 rounded-xl border border-border/80 bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsReviewModalOpen(false)}
                className="rounded-xl font-medium"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingReview}
                className="rounded-xl font-bold bg-primary text-primary-foreground shadow-sm"
              >
                {isSubmittingReview ? "جاري الحفظ..." : "إرسال التقييم ✨"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default InstructorProfile;
