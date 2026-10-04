import { useParams, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import CourseCard from "@/components/course/CourseCard";
import { BookOpen } from "lucide-react";
import { useCategoryDetail } from "@/features/courses/hooks";

const CategoryPage = () => {
  const { categoryName } = useParams();
  const slug = categoryName || "";

  const { data, isLoading, error } = useCategoryDetail(slug);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        when: "beforeChildren",
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 20,
      },
    },
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto py-16 px-4">
          <div className="animate-pulse">
            <div className="h-8 w-1/3 bg-muted rounded mb-4"></div>
            <div className="h-4 w-2/3 bg-muted rounded mb-8"></div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array(8).fill(null).map((_, index) => (
                <div key={index} className="h-[280px] bg-muted rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !data) {
    return <Navigate to="/404" replace />;
  }

  const { category, courses } = data;

  return (
    <Layout>
      <motion.div
        className="bg-muted py-16 px-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="container mx-auto">
          <div className="text-center mb-10">
            <div className="inline-block bg-primary/10 p-3 rounded-full mb-4">
              <BookOpen size={32} className="text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-4">{category.name}</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              تصفح أفضل الدورات في مجال {category.name}
            </p>
          </div>
        </div>
      </motion.div>

      <div className="container mx-auto py-10 px-4">
        <motion.div
          className="mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <h2 className="text-2xl font-bold mb-2">الدورات المتاحة</h2>
          <p className="text-muted-foreground">
            اكتشف {courses.total} دورة في مجال {category.name}
          </p>
        </motion.div>

        {courses.data.length === 0 ? (
          <div className="text-center py-16">
            <h3 className="text-xl font-medium mb-2">لا توجد دورات حالياً</h3>
            <p className="text-muted-foreground">
              سيتم إضافة دورات جديدة في هذا التصنيف قريباً.
            </p>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {courses.data.map((course) => (
              <motion.div key={course.id} variants={itemVariants}>
                <CourseCard
                  id={course.id}
                  title={course.title}
                  instructor={course.instructor?.name || "مدرب معتمد"}
                  image={course.image}
                  price={course.price}
                  category={course.category?.name || "عام"}
                  description={course.shortDescription}
                  duration={course.duration}
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
        )}
      </div>
    </Layout>
  );
};

export default CategoryPage;
