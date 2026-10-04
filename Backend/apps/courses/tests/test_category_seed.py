from django.test import TestCase

from apps.courses.models import Category


class SeededCategoryTests(TestCase):
    def test_educational_lessons_category_is_seeded(self):
        category = Category.objects.get(slug="educational-lessons")

        self.assertEqual(category.name, "دروس تعليمية")
        self.assertEqual(category.icon, "BookOpen")
        self.assertEqual(category.color, "bg-indigo-100")
