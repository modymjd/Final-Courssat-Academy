from django_filters import rest_framework as filters

from .models import (
    Course,
    CourseEducationalGrade,
    CourseEducationalStage,
    CourseEducationalTrack,
    CourseLevel,
    CourseSubject,
    CourseSubjectBranch,
)


class CourseFilter(filters.FilterSet):
    search = filters.CharFilter(method="filter_search")
    category = filters.CharFilter(method="filter_category")
    level = filters.ChoiceFilter(choices=CourseLevel.choices)
    educational_stage = filters.ChoiceFilter(choices=CourseEducationalStage.choices)
    educational_grade = filters.ChoiceFilter(choices=CourseEducationalGrade.choices)
    educational_track = filters.ChoiceFilter(choices=CourseEducationalTrack.choices)
    subject = filters.ChoiceFilter(choices=CourseSubject.choices)
    subject_branch = filters.ChoiceFilter(choices=CourseSubjectBranch.choices)
    is_free = filters.BooleanFilter(field_name="is_free")
    min_rating = filters.NumberFilter(method="filter_min_rating")
    max_price = filters.NumberFilter(field_name="price", lookup_expr="lte")
    sort_by = filters.CharFilter(method="filter_sort")
    mine = filters.BooleanFilter(method="filter_mine")

    class Meta:
        model = Course
        fields = [
            "level",
            "educational_stage",
            "educational_grade",
            "educational_track",
            "subject",
            "subject_branch",
            "is_free",
            "mine",
        ]

    def filter_search(self, queryset, name, value):
        return queryset.filter(title__icontains=value) | queryset.filter(description__icontains=value)

    def filter_category(self, queryset, name, value):
        return queryset.filter(category__slug=value) | queryset.filter(category__name=value)

    def filter_min_rating(self, queryset, name, value):
        from django.db.models import Avg

        return queryset.annotate(_avg_rating=Avg("reviews__rating")).filter(_avg_rating__gte=value)

    def filter_mine(self, queryset, name, value):
        if not value:
            return queryset

        request = getattr(self, "request", None)
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return queryset.none()

        return queryset.filter(instructor=user)

    def filter_sort(self, queryset, name, value):
        mapping = {
            "popular": "-id",
            "newest": "-created_at",
            "rating": "-id",
            "price-asc": "price",
            "price-desc": "-price",
        }
        from django.db.models import Avg, Count

        if value == "popular":
            return queryset.annotate(_scount=Count("enrollments")).order_by("-_scount")
        if value == "rating":
            return queryset.annotate(_avg=Avg("reviews__rating")).order_by("-_avg")
        return queryset.order_by(mapping.get(value, "-created_at"))
