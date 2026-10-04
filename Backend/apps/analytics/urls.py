from django.urls import path

from .views import (
    AchievementListView,
    ClaimAchievementView,
    FocusSessionCreateView,
    FocusSessionHistoryView,
    InstructorCourseAnalyticsView,
    InstructorDailyBriefView,
    InstructorDashboardSummaryView,
    StudentDashboardSummaryView,
)

urlpatterns = [
    path("student/summary/", StudentDashboardSummaryView.as_view(), name="analytics-student-summary"),
    path("achievements/", AchievementListView.as_view(), name="analytics-achievements"),
    path("achievements/<slug:slug>/claim/", ClaimAchievementView.as_view(), name="analytics-achievements-claim"),
    path("instructor/summary/", InstructorDashboardSummaryView.as_view(), name="analytics-instructor-summary"),
    path("instructor/daily-brief/", InstructorDailyBriefView.as_view(), name="analytics-instructor-daily-brief"),
    path(
        "instructor/courses/<int:course_id>/analytics/",
        InstructorCourseAnalyticsView.as_view(),
        name="analytics-instructor-course-analytics",
    ),
    path("focus-sessions/", FocusSessionCreateView.as_view(), name="focus-session-create"),
    path("focus-sessions/history/", FocusSessionHistoryView.as_view(), name="focus-session-history"),
]
