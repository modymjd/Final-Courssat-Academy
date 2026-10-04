from django.urls import path

from .views import PublicAboutView

urlpatterns = [
    path("platform/about/", PublicAboutView.as_view(), name="public-platform-about"),
]
