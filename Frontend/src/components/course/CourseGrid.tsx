import React, { memo } from "react";
import { motion, Variants } from "framer-motion";
import CourseCard from "@/components/course/CourseCard";
import { CardSkeleton } from "@/components/common/LoadingState";
import type { CourseSummary } from "@/types/course";

interface CourseGridProps {
  courses: CourseSummary[];
  isLoading: boolean;
  itemVariants: Variants;
  containerVariants: Variants;
  loadingSkeletons?: number;
}

const CourseGrid: React.FC<CourseGridProps> = ({
  courses,
  isLoading,
  itemVariants,
  containerVariants,
  loadingSkeletons = 8,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array(loadingSkeletons).fill(null).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (courses.length === 0 && !isLoading) {
     return <p className="col-span-full text-center text-muted-foreground py-8">لا توجد دورات تطابق بحثك حالياً.</p>;
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
    >
      {courses.map((course) => (
        <motion.div key={course.id} variants={itemVariants}>
          <CourseCard
            id={course.id}
            title={course.title}
            instructor={typeof course.instructor === "string" ? course.instructor : (course.instructor?.name || "مدرب معتمد")}
            image={course.image}
            price={course.price}
            category={typeof course.category === "string" ? course.category : (course.category?.name || "عام")}
            description={course.description || course.shortDescription || ""}
            duration={course.duration || ""}
            level={course.level}
            isFree={course.isFree}
            educationalStage={course.educationalStage}
            educationalGrade={course.educationalGrade}
            educationalTrack={course.educationalTrack}
            subject={course.subject}
            subjectBranch={course.subjectBranch}
          />
        </motion.div>
      ))}
    </motion.div>
  );
};

export default memo(CourseGrid);

