import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { GraduationCap, ArrowLeft, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/features/auth";

const CallToAction = () => {
  const { user, isAuthenticated } = useAuth();

  const dashboardUrl = user?.role === "center"
    ? "/center/dashboard"
    : user?.role === "instructor"
    ? "/instructor/dashboard"
    : user?.role === "admin" || user?.role === "super_admin"
    ? "/admin/dashboard"
    : "/dashboard";

  const dashboardLabel = user?.role === "center"
    ? "لوحة تحكم السنتر"
    : user?.role === "instructor"
    ? "لوحة تحكم المحاضر"
    : user?.role === "admin" || user?.role === "super_admin"
    ? "لوحة الإدارة"
    : "متابعة دراستك الآن";

  return (
    <section className="py-20 bg-primary relative overflow-hidden">
      {/* Decorative circles — using logical positioning for RTL */}
      <div className="absolute top-0 end-0 w-64 h-64 bg-primary-foreground/10 rounded-full -translate-y-1/2" />
      <div className="absolute bottom-0 start-0 w-80 h-80 bg-primary-foreground/10 rounded-full translate-y-1/2" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center max-w-3xl mx-auto">
          <GraduationCap size={40} className="text-primary-foreground/40 mx-auto mb-4" />
          <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-6">
            ابدأ رحلتك التعليمية اليوم مع كورسات
          </h2>
          <p className="text-primary-foreground/85 text-lg mb-8 leading-relaxed">
            انضم إلى آلاف المتعلمين حول العالم واكتسب المهارات التي تحتاجها للنجاح في المستقبل.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated ? (
              <>
                <Button
                  asChild
                  size="lg"
                  className="text-base px-8 bg-primary-foreground text-primary hover:bg-primary-foreground/90 gap-2 font-bold outline-none focus:outline-none focus:ring-0 focus-visible:ring-0"
                >
                  <Link to={dashboardUrl}>
                    <LayoutDashboard size={18} />
                    <span>{dashboardLabel}</span>
                    <ArrowLeft size={16} />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="lg"
                  className="text-base px-8 border border-primary-foreground/50 bg-transparent text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground font-semibold outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 transition-colors"
                >
                  <Link to="/courses">تصفح الدورات والمقررات</Link>
                </Button>
              </>
            ) : (
              <>
                <Button
                  asChild
                  size="lg"
                  className="text-base px-8 bg-primary-foreground text-primary hover:bg-primary-foreground/90 gap-2 font-bold outline-none focus:outline-none focus:ring-0 focus-visible:ring-0"
                >
                  <Link to="/register">
                    <span>ابدأ الآن مجاناً</span>
                    <ArrowLeft size={16} />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="lg"
                  className="text-base px-8 border border-primary-foreground/50 bg-transparent text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground font-semibold outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 transition-colors"
                >
                  <Link to="/courses">تصفح الدورات</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CallToAction;
