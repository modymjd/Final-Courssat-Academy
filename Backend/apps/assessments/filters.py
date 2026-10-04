import django_filters
from django.db import models

from .models import Exam, QuestionBankItem


class ExamFilter(django_filters.FilterSet):
    course = django_filters.NumberFilter(field_name='course_id')
    lesson = django_filters.NumberFilter(field_name='lesson_id')
    educational_stage = django_filters.CharFilter()
    educational_grade = django_filters.CharFilter()
    educational_track = django_filters.CharFilter()
    subject = django_filters.CharFilter()
    subject_branch = django_filters.CharFilter()
    exam_type = django_filters.CharFilter()
    is_published = django_filters.BooleanFilter()
    search = django_filters.CharFilter(method='filter_search')

    class Meta:
        model = Exam
        fields = ['course', 'lesson', 'educational_stage', 'educational_grade',
                  'educational_track', 'subject', 'subject_branch', 'exam_type', 'is_published']

    def filter_search(self, queryset, name, value):
        if value:
            return queryset.filter(
                models.Q(title__icontains=value) | models.Q(description__icontains=value)
            )
        return queryset


class QuestionBankItemFilter(django_filters.FilterSet):
    educational_stage = django_filters.CharFilter()
    educational_grade = django_filters.CharFilter()
    educational_track = django_filters.CharFilter()
    subject = django_filters.CharFilter()
    difficulty = django_filters.CharFilter()
    question_type = django_filters.CharFilter()
    exam = django_filters.NumberFilter(field_name='exam_id')

    class Meta:
        model = QuestionBankItem
        fields = ['educational_stage', 'educational_grade', 'educational_track',
                  'subject', 'difficulty', 'question_type', 'exam']
