import React from "react";
import { motion } from "framer-motion";
import { StatCard } from "@/components/common/StatCard";
import { Users, BookOpen, Star, TrendingUp, DollarSign } from "lucide-react";

interface InstructorKpis {
  total_students?: number;
  active_courses?: number;
  total_courses?: number;
  avg_rating?: number;
  avg_completion_rate?: number;
  total_revenue?: number;
}

interface InstructorKpiBarProps {
  kpis?: InstructorKpis;
}

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export const InstructorKpiBar: React.FC<InstructorKpiBarProps> = ({ kpis }) => {
  const totalStudents = kpis?.total_students ?? 0;
  const activeCourses = kpis?.active_courses ?? 0;
  const avgRating = kpis?.avg_rating ?? 4.8;
  const avgCompletion = kpis?.avg_completion_rate ?? 0;
  const totalRevenue = kpis?.total_revenue ?? 0;

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4"
    >
      <motion.div variants={fadeUp}>
        <StatCard
          title="إجمالي الطلاب"
          value={totalStudents.toLocaleString("ar-EG")}
          icon={<Users size={20} className="text-blue-500" />}
          className="border-blue-500/20 hover:border-blue-500/40 bg-card"
        />
      </motion.div>

      <motion.div variants={fadeUp}>
        <StatCard
          title="الكورسات النشطة"
          value={activeCourses.toLocaleString("ar-EG")}
          icon={<BookOpen size={20} className="text-emerald-500" />}
          className="border-emerald-500/20 hover:border-emerald-500/40 bg-card"
        />
      </motion.div>

      <motion.div variants={fadeUp}>
        <StatCard
          title="متوسط التقييم"
          value={avgRating.toFixed(1)}
          icon={<Star size={20} className="text-amber-500 fill-amber-500" />}
          className="border-amber-500/20 hover:border-amber-500/40 bg-card"
        />
      </motion.div>

      <motion.div variants={fadeUp}>
        <StatCard
          title="معدل الإكمال"
          value={`${avgCompletion}%`}
          icon={<TrendingUp size={20} className="text-purple-500" />}
          className="border-purple-500/20 hover:border-purple-500/40 bg-card"
        />
      </motion.div>

      <motion.div variants={fadeUp} className="col-span-2 sm:col-span-1">
        <StatCard
          title="إجمالي الأرباح"
          value={`${totalRevenue.toLocaleString("ar-EG")} ج.م`}
          icon={<DollarSign size={20} className="text-emerald-600" />}
          className="border-emerald-600/20 hover:border-emerald-600/40 bg-card"
        />
      </motion.div>
    </motion.div>
  );
};

export default InstructorKpiBar;
