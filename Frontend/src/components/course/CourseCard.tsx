import React, { memo } from "react";

import { Clock, User } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import type {
  CourseLevel,
  InstructorSummary,
  Category,
  EducationalStage,
  EducationalGrade,
  EducationalTrack,
  CourseSubject,
  SubjectBranch,
} from "@/types/course";
import {
  STAGE_LABELS,
  GRADE_LABELS,
  TRACK_LABELS,
  SUBJECT_LABELS,
  BRANCH_LABELS,
} from "@/lib/curriculumData";

import { formatCurrency } from "@/lib/format";

export interface CourseCardProps {
  id: number | string;
  title: string;
  instructor?: string | InstructorSummary | null;
  description?: string;
  image?: string;
  duration?: string;
  level?: CourseLevel;
  category?: string | Category | null;
  price?: number;
  isFree?: boolean;
  educationalStage?: EducationalStage | null;
  educationalGrade?: EducationalGrade | null;
  educationalTrack?: EducationalTrack | null;
  subject?: CourseSubject | null;
  subjectBranch?: SubjectBranch | null;
}

const CourseCard = ({
  id,
  title,
  instructor,
  description = "",
  image = "/placeholder.svg",
  duration = "",
  level = "beginner",
  category,
  price,
  isFree = false,
  educationalStage,
  educationalGrade,
  educationalTrack,
  subject,
  subjectBranch,
}: CourseCardProps) => {
  const getLevelColor = () => {
    switch (level) {
      case "beginner":
        return "bg-success/10 text-success dark:bg-success/20";
      case "intermediate":
        return "bg-primary/10 text-primary dark:bg-primary/20";
      case "advanced":
        return "bg-achievement/10 text-achievement dark:bg-achievement/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const instructorName =
    typeof instructor === "string"
      ? instructor
      : typeof instructor === "object" && instructor
        ? (typeof instructor.name === "string" ? instructor.name : (instructor as any)?.fullName || (instructor as any)?.full_name || "مدرب معتمد")
        : "مدرب معتمد";

  const categoryName =
    typeof category === "string"
      ? category
      : typeof category === "object" && category
        ? (typeof category.name === "string" ? category.name : "عام")
        : "عام";

  return (
    <Card className="overflow-hidden border border-slate-200/90 dark:border-border/80 bg-white dark:bg-card shadow-xs hover:shadow-xl transition-all duration-300 rounded-2xl group">
      <div className="aspect-video relative overflow-hidden">
        <img
          src={image || "/placeholder.svg"}
          alt={title}
          loading="lazy"
          decoding="async"
          width={400}
          height={225}
          className="object-cover w-full h-full"
          onError={(e) => {
            e.currentTarget.src = "/placeholder.svg";
          }}
        />
        {educationalTrack ? (
          <Badge className="absolute top-2.5 start-2.5 text-[10px] font-bold px-2 py-0.5 bg-slate-900/85 dark:bg-slate-800/90 text-white border-0 shadow-sm rounded-lg backdrop-blur-md">
            {TRACK_LABELS[educationalTrack] || educationalTrack}
          </Badge>
        ) : educationalStage === "baccalaureate" ? (
          <Badge className="absolute top-2.5 start-2.5 text-[10px] font-bold px-2 py-0.5 bg-purple-600/90 text-white border-0 shadow-sm rounded-lg backdrop-blur-md">
            بكالوريا مصرية
          </Badge>
        ) : null}
        <Badge
          className="absolute top-2.5 end-2.5 text-xs sm:text-sm font-black px-3 py-1 bg-white/95 dark:bg-card/95 text-[#0A3832] dark:text-emerald-400 border border-slate-200/90 dark:border-border shadow-md rounded-xl backdrop-blur-md"
        >
          {isFree || price === 0 ? "مجاني" : price !== undefined ? formatCurrency(price) : "مجاني"}
        </Badge>
      </div>
      <CardContent className="p-3 xs:p-4 pt-3 xs:pt-4">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={`text-[10px] xs:text-xs ${getLevelColor()}`}>
            {level === "beginner" ? "مبتدئ" : level === "intermediate" ? "متوسط" : "متقدم"}
          </Badge>
          {educationalGrade && (
            <Badge variant="outline" className="text-[10px] xs:text-xs bg-primary/5 text-primary border-primary/20 font-medium">
              {GRADE_LABELS[educationalGrade] || educationalGrade}
            </Badge>
          )}
          {subjectBranch ? (
            <Badge variant="outline" className="text-[10px] xs:text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 font-semibold">
              {BRANCH_LABELS[subjectBranch] || subjectBranch}
            </Badge>
          ) : subject ? (
            <Badge variant="outline" className="text-[10px] xs:text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 font-medium">
              {SUBJECT_LABELS[subject] || subject}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] xs:text-xs">
              {categoryName}
            </Badge>
          )}
        </div>
        <Link to={`/course/${id}`}>
          <h3 className="font-bold text-base xs:text-lg mb-2 hover:text-primary transition-colors line-clamp-2 leading-snug">
            {title}
          </h3>
        </Link>
        <p className="text-muted-foreground text-xs xs:text-sm line-clamp-2 mb-3">
          {description}
        </p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User size={16} />
          <span>{instructorName}</span>
        </div>
      </CardContent>
      <CardFooter className="border-t pt-3 flex justify-between">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Clock size={16} />
          <span>{duration || "غير محدد"}</span>
        </div>
        <Link to={`/course/${id}`} className="text-primary text-sm font-medium hover:underline">
          عرض الدورة
        </Link>
      </CardFooter>
    </Card>
  );
};

export default memo(CourseCard);


