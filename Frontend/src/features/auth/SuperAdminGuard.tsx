import { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { superAdminGet } from "@/lib/superAdminHttp";
import { superAdminTokenStore } from "@/lib/superAdminTokenStore";
import { PageLoading } from "@/components/common/LoadingState";

interface SuperAdminGuardProps {
  children: JSX.Element;
}

export function SuperAdminGuard({ children }: SuperAdminGuardProps) {
  const location = useLocation();
  const [checkingSession, setCheckingSession] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function verifySuperAdminSession() {
      const token = superAdminTokenStore.getAccess();
      if (!token) {
        if (isMounted) {
          setIsAuthorized(false);
          setCheckingSession(false);
        }
        return;
      }

      try {
        const res = await superAdminGet<{ is2faVerified: boolean }>("/super-admin/auth/session/");
        if (isMounted) {
          setIsAuthorized(res.is2faVerified === true);
          setCheckingSession(false);
        }
      } catch {
        if (isMounted) {
          superAdminTokenStore.clear();
          setIsAuthorized(false);
          setCheckingSession(false);
        }
      }
    }

    verifySuperAdminSession();

    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  if (checkingSession) {
    return <PageLoading />;
  }

  if (!isAuthorized) {
    return <Navigate to="/super-admin/login" state={{ from: location }} replace />;
  }

  return children;
}
