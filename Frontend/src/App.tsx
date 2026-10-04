import { lazy, Suspense, useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/features/auth";
import { AuthGuard } from "@/features/auth/AuthGuard";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import {
  PageLoading,
  CoursesPageSkeleton,
  CourseDetailSkeleton,
  DashboardSkeleton,
  InstructorsPageSkeleton,
} from "@/components/common/LoadingState";
import LandingSkeleton from "@/components/home/LandingSkeleton";
import { queryClient } from "@/lib/queryClient";
import { usePlatformTheme } from "@/hooks/usePlatformTheme";
import { CommandPaletteModal } from "@/components/CommandPaletteModal";
import ScrollToTop from "./components/layout/ScrollToTop";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { GOOGLE_CLIENT_ID } from "@/config/runtime";

const OnboardingTutorial = lazy(() => import("@/components/common/OnboardingTutorial"));
const Index = lazy(() => import("./pages/Index"));
const Courses = lazy(() => import("./pages/Courses"));
const CourseDetail = lazy(() => import("./pages/CourseDetail"));
const CourseCheckoutPage = lazy(() => import("./pages/course/CourseCheckoutPage"));
const CenterActivationPage = lazy(() => import("./pages/center/CenterActivationPage"));
const LessonDetail = lazy(() => import("./pages/LessonDetail"));
const CategoryPage = lazy(() => import("./pages/CategoryPage"));
const Instructors = lazy(() => import("./pages/Instructors"));
const InstructorProfile = lazy(() => import("./pages/InstructorProfile"));
const Pricing = lazy(() => import("./pages/Pricing"));
const About = lazy(() => import("./pages/About"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const CompleteProfile = lazy(() => import("./pages/CompleteProfile"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const StudentDashboard = lazy(() => import("./pages/dashboard/StudentDashboard"));
const InstructorDashboard = lazy(() => import("./pages/dashboard/InstructorDashboard"));
const AdminDashboard = lazy(() => import("./pages/dashboard/AdminDashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Calendar = lazy(() => import("./pages/Calendar"));
const AdminUserManagement = lazy(() => import("./pages/admin/AdminUserManagement"));
const AdminCourseManagement = lazy(() => import("./pages/admin/AdminCourseManagement"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminApprovals = lazy(() => import("./pages/admin/AdminApprovals"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Faq = lazy(() => import("./pages/Faq"));
const Contact = lazy(() => import("./pages/Contact"));
const InstructorCourseManagement = lazy(() => import("./pages/instructor/InstructorCourseManagement"));
const InstructorCourseBuilder = lazy(() => import("./pages/instructor/InstructorCourseBuilder"));
const InstructorStudentGrades = lazy(() => import("./pages/instructor/InstructorStudentGrades"));
const InstructorExamManagement = lazy(() => import("./pages/instructor/InstructorExamManagement"));
const InstructorExamBuilder = lazy(() => import("./pages/instructor/InstructorExamBuilder"));
const InstructorTaskManager = lazy(() => import("./pages/instructor/InstructorTaskManager"));
const InstructorStudents = lazy(() => import("./pages/instructor/InstructorStudents"));
const InstructorEarnings = lazy(() => import("./pages/instructor/InstructorEarnings"));
const InstructorActivationCodes = lazy(() => import("./pages/instructor/InstructorActivationCodes"));
const ExamLanding = lazy(() => import("./pages/exam/ExamLanding"));
const ExamSession = lazy(() => import("./pages/exam/ExamSession"));
const ExamResult = lazy(() => import("./pages/exam/ExamResult"));
const ActivateCodePage = lazy(() => import("./pages/student/ActivateCodePage"));
const CenterLayout = lazy(() => import("./pages/center/CenterLayout"));
const CenterOverview = lazy(() => import("./pages/center/CenterOverview"));
const CenterInstructors = lazy(() => import("./pages/center/CenterInstructors"));
const CenterActivationCodes = lazy(() => import("./pages/center/CenterActivationCodes"));
const CenterStudents = lazy(() => import("./pages/center/CenterStudents"));
const CenterSubscription = lazy(() => import("./pages/center/CenterSubscription"));
const CenterReports = lazy(() => import("./pages/center/CenterReports"));
const CenterSettings = lazy(() => import("./pages/center/CenterSettings"));
const FirstLoginWelcomeModal = lazy(() => import("@/components/auth/FirstLoginWelcomeModal"));
const VerifyCertificatePage = lazy(() => import("./pages/VerifyCertificatePage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SuperAdminGuard = lazy(() => import("@/features/auth/SuperAdminGuard").then(m => ({ default: m.SuperAdminGuard })));
const SuperAdminLogin = lazy(() => import("./pages/super-admin/SuperAdminLogin"));
const SuperAdminLayout = lazy(() => import("./pages/super-admin/SuperAdminLayout"));
const DashboardOverviewPage = lazy(() => import("./pages/super-admin/DashboardOverviewPage"));
const UserManagementPage = lazy(() => import("./pages/super-admin/UserManagementPage"));
const ContentThemePage = lazy(() => import("./pages/super-admin/ContentThemePage"));
const AuditLogsPage = lazy(() => import("./pages/super-admin/AuditLogsPage"));
const SuperAdminPricing = lazy(() => import("./pages/super-admin/SuperAdminPricing"));
const SuperAdminQuotaContracts = lazy(() => import("./pages/super-admin/SuperAdminQuotaContracts"));
const FocusModePage = lazy(() => import("./pages/student/FocusModePage"));
const NotebookPage = lazy(() => import("./pages/student/NotebookPage"));
const AssignmentKanbanPage = lazy(() => import("./pages/student/AssignmentKanbanPage"));
const StudentWalletPage = lazy(() => import("./pages/student/StudentWalletPage"));

function ThemeInitializer({ children }: { children: React.ReactNode }) {
  usePlatformTheme();
  return <>{children}</>;
}

function GlobalAppWrapper({ children }: { children: React.ReactNode }) {
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  return (
    <>
      <ScrollToTop />
      {children}
      <CommandPaletteModal isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} />
      <Suspense fallback={null}>
        <FirstLoginWelcomeModal />
      </Suspense>
    </>
  );
}

const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const inner = (
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <GlobalAppWrapper>
            {children}
            <ErrorBoundary>
              <Suspense fallback={null}>
                <OnboardingTutorial />
              </Suspense>
            </ErrorBoundary>
          </GlobalAppWrapper>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  );
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID} locale="ar">
      {inner}
    </GoogleOAuthProvider>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeInitializer>
        <AppProviders>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              {/* Public routes */}
              <Route
                path="/"
                element={
                  <Suspense fallback={<LandingSkeleton />}>
                    <Index />
                  </Suspense>
                }
              />
              <Route
                path="/courses"
                element={
                  <Suspense fallback={<CoursesPageSkeleton />}>
                    <Courses />
                  </Suspense>
                }
              />
              <Route
                path="/course/:id"
                element={
                  <Suspense fallback={<CourseDetailSkeleton />}>
                    <CourseDetail />
                  </Suspense>
                }
              />
              <Route
                path="/course/:id/checkout"
                element={
                  <Suspense fallback={<PageLoading />}>
                    <CourseCheckoutPage />
                  </Suspense>
                }
              />
              <Route
                path="/courses/:id"
                element={
                  <Suspense fallback={<CourseDetailSkeleton />}>
                    <CourseDetail />
                  </Suspense>
                }
              />
              <Route
                path="/courses/:id/checkout"
                element={
                  <Suspense fallback={<PageLoading />}>
                    <CourseCheckoutPage />
                  </Suspense>
                }
              />
              <Route
                path="/center/:centerSlug/activate"
                element={
                  <Suspense fallback={<PageLoading />}>
                    <CenterActivationPage />
                  </Suspense>
                }
              />
              <Route
                path="/category/:categoryName"
                element={
                  <Suspense fallback={<CoursesPageSkeleton />}>
                    <CategoryPage />
                  </Suspense>
                }
              />
              <Route
                path="/instructors"
                element={
                  <Suspense fallback={<InstructorsPageSkeleton />}>
                    <Instructors />
                  </Suspense>
                }
              />
              <Route
                path="/instructor/:id"
                element={
                  <Suspense fallback={<InstructorsPageSkeleton />}>
                    <InstructorProfile />
                  </Suspense>
                }
              />
              <Route
                path="/instructors/:id"
                element={
                  <Suspense fallback={<InstructorsPageSkeleton />}>
                    <InstructorProfile />
                  </Suspense>
                }
              />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/about" element={<About />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/faq" element={<Faq />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/activate" element={<ActivateCodePage />} />
              <Route path="/complete-profile" element={<AuthGuard><CompleteProfile /></AuthGuard>} />
              <Route path="/verify-certificate" element={<VerifyCertificatePage />} />

              {/* Protected: any authenticated user */}
              <Route
                path="/dashboard"
                element={
                  <Suspense fallback={<DashboardSkeleton />}>
                    <AuthGuard>
                      <Dashboard />
                    </AuthGuard>
                  </Suspense>
                }
              />
              <Route path="/profile" element={<AuthGuard><Profile /></AuthGuard>} />
              <Route path="/settings" element={<AuthGuard><Settings /></AuthGuard>} />
              <Route path="/notifications" element={<AuthGuard><Notifications /></AuthGuard>} />
              <Route path="/calendar" element={<AuthGuard><Calendar /></AuthGuard>} />

              {/* Instructor routes */}
              <Route
                path="/instructor/dashboard"
                element={
                  <Suspense fallback={<DashboardSkeleton />}>
                    <AuthGuard allowedRoles={["instructor", "admin"]}>
                      <InstructorDashboard />
                    </AuthGuard>
                  </Suspense>
                }
              />
              <Route path="/instructor/courses" element={<AuthGuard allowedRoles={["instructor", "admin"]}><InstructorCourseManagement /></AuthGuard>} />
              <Route path="/instructor/courses/new" element={<AuthGuard allowedRoles={["instructor", "admin"]}><InstructorCourseBuilder /></AuthGuard>} />
              <Route path="/instructor/courses/:courseId/builder" element={<AuthGuard allowedRoles={["instructor", "admin"]}><InstructorCourseBuilder /></AuthGuard>} />
              <Route path="/instructor/courses/:courseId/edit" element={<AuthGuard allowedRoles={["instructor", "admin"]}><InstructorCourseBuilder /></AuthGuard>} />
              <Route path="/instructor/exams" element={<AuthGuard allowedRoles={["instructor", "admin"]}><InstructorExamManagement /></AuthGuard>} />
              <Route path="/instructor/exams/builder" element={<AuthGuard allowedRoles={["instructor", "admin"]}><InstructorExamBuilder /></AuthGuard>} />
              <Route path="/instructor/grades" element={<AuthGuard allowedRoles={["instructor", "admin"]}><InstructorStudentGrades /></AuthGuard>} />
              <Route path="/instructor/tasks" element={<AuthGuard allowedRoles={["instructor", "admin"]}><InstructorTaskManager /></AuthGuard>} />
              <Route path="/instructor/students" element={<AuthGuard allowedRoles={["instructor", "admin"]}><InstructorStudents /></AuthGuard>} />
              <Route path="/instructor/earnings" element={<AuthGuard allowedRoles={["instructor", "admin"]}><InstructorEarnings /></AuthGuard>} />
              <Route path="/instructor/activation-codes" element={<AuthGuard allowedRoles={["instructor", "admin"]}><InstructorActivationCodes /></AuthGuard>} />

              {/* Student routes */}
              <Route
                path="/student/dashboard"
                element={
                  <Suspense fallback={<DashboardSkeleton />}>
                    <AuthGuard allowedRoles={["student", "instructor", "admin", "guardian"]}>
                      <StudentDashboard />
                    </AuthGuard>
                  </Suspense>
                }
              />
              <Route path="/student/wallet" element={<AuthGuard allowedRoles={["student", "instructor", "admin"]}><StudentWalletPage /></AuthGuard>} />
              <Route path="/wallet" element={<AuthGuard><StudentWalletPage /></AuthGuard>} />
              <Route path="/student/focus" element={<AuthGuard allowedRoles={["student", "instructor", "admin"]}><FocusModePage /></AuthGuard>} />
              <Route path="/student/notebook" element={<AuthGuard allowedRoles={["student", "instructor", "admin"]}><NotebookPage /></AuthGuard>} />
              <Route path="/student/assignments" element={<AuthGuard allowedRoles={["student"]}><AssignmentKanbanPage /></AuthGuard>} />
              <Route path="/student/exams" element={<AuthGuard allowedRoles={["student"]}><ExamLanding /></AuthGuard>} />
              <Route path="/student/exams/:id" element={<AuthGuard allowedRoles={["student"]}><ExamLanding /></AuthGuard>} />
              <Route path="/exam/:id" element={<AuthGuard allowedRoles={["student", "instructor", "admin"]}><ExamLanding /></AuthGuard>} />
              <Route path="/student/exams/:id/session" element={<AuthGuard allowedRoles={["student"]}><ExamSession /></AuthGuard>} />
              <Route path="/exam/:id/session" element={<AuthGuard allowedRoles={["student"]}><ExamSession /></AuthGuard>} />
              <Route path="/student/exams/:id/result" element={<AuthGuard allowedRoles={["student"]}><ExamResult /></AuthGuard>} />
              <Route path="/exam/:id/result" element={<AuthGuard allowedRoles={["student"]}><ExamResult /></AuthGuard>} />
              <Route path="/lesson/:courseId/:lessonId" element={<AuthGuard><LessonDetail /></AuthGuard>} />
              <Route path="/course/:courseId/lesson/:lessonId" element={<AuthGuard><LessonDetail /></AuthGuard>} />

              {/* Admin routes */}
              <Route
                path="/admin/dashboard"
                element={
                  <Suspense fallback={<DashboardSkeleton />}>
                    <AuthGuard allowedRoles={["admin"]}>
                      <AdminDashboard />
                    </AuthGuard>
                  </Suspense>
                }
              />
              <Route path="/admin/users" element={<AuthGuard allowedRoles={["admin"]}><AdminUserManagement /></AuthGuard>} />
              <Route path="/admin/courses" element={<AuthGuard allowedRoles={["admin"]}><AdminCourseManagement /></AuthGuard>} />
              <Route path="/admin/settings" element={<AuthGuard allowedRoles={["admin"]}><AdminSettings /></AuthGuard>} />
              <Route path="/admin/approvals" element={<AuthGuard allowedRoles={["admin"]}><AdminApprovals /></AuthGuard>} />

              {/* Center workspace is exclusively for center accounts. */}
              <Route
                path="/center"
                element={
                  <AuthGuard allowedRoles={["center"]}>
                    <CenterLayout />
                  </AuthGuard>
                }
              >
                <Route index element={<Navigate to="/center/dashboard" replace />} />
                <Route path="dashboard" element={<CenterOverview />} />
                <Route path="overview" element={<CenterOverview />} />
                <Route path="instructors" element={<CenterInstructors />} />
                <Route path="activation-codes" element={<CenterActivationCodes />} />
                <Route path="students" element={<CenterStudents />} />
                <Route path="subscription" element={<CenterSubscription />} />
                <Route path="reports" element={<CenterReports />} />
                <Route path="settings" element={<CenterSettings />} />
              </Route>

              <Route path="/super-admin/login" element={<SuperAdminLogin />} />
              <Route path="/super-admin" element={<SuperAdminGuard><SuperAdminLayout /></SuperAdminGuard>}>
                <Route path="dashboard" element={<DashboardOverviewPage />} />
                <Route path="users" element={<UserManagementPage />} />
                <Route path="content" element={<ContentThemePage />} />
                <Route path="pricing" element={<SuperAdminPricing />} />
                <Route path="quota-contracts" element={<SuperAdminQuotaContracts />} />
                <Route path="finance" element={<SuperAdminPricing />} />
                <Route path="settings" element={<ContentThemePage />} />
                <Route path="audit-logs" element={<AuditLogsPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AppProviders>
      </ThemeInitializer>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
