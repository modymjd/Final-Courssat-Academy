import { lazy, Suspense, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth";
import { PageLoading } from "@/components/common/LoadingState";

const GuardianDashboard = lazy(() => import("./dashboard/GuardianDashboard"));

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !user || user.role === "guardian") return;

    const roleRoutes: Record<string, string> = {
      student: "/student/dashboard",
      instructor: "/instructor/dashboard",
      admin: "/admin/dashboard",
      center: "/center/dashboard",
      super_admin: "/super-admin/dashboard",
    };

    const targetRoute = roleRoutes[user.role] || "/student/dashboard";
    navigate(targetRoute, { replace: true });
  }, [navigate, user, isAuthenticated]);

  if (!isAuthenticated || !user) {
    return <PageLoading />;
  }

  if (user.role === "guardian") {
    return (
      <Suspense fallback={<PageLoading />}>
        <GuardianDashboard />
      </Suspense>
    );
  }

  return <PageLoading />;
};

export default Dashboard;
