from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.courses.models import Category, Course, Lesson, Module


class CurriculumOrderingTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        user_model = get_user_model()
        cls.instructor = user_model.objects.create_user(
            email="reorder-instructor@example.com",
            password="test-password",
            first_name="Reorder",
            last_name="Instructor",
            role="instructor",
        )
        cls.category = Category.objects.create(name="Ordering Tests", slug="ordering-tests")
        cls.course = Course.objects.create(
            title="Ordering Test Course",
            instructor=cls.instructor,
            category=cls.category,
        )

    def test_module_order_swap_is_collision_free(self):
        first = Module.objects.create(course=self.course, title="First", order=1)
        second = Module.objects.create(course=self.course, title="Second", order=2)

        first.order = second.order
        first.save(update_fields=["order"])

        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(first.order, 2)
        self.assertEqual(second.order, 1)

    def test_lesson_order_swap_is_collision_free(self):
        module = Module.objects.create(course=self.course, title="Module", order=1)
        first = Lesson.objects.create(module=module, title="First", order=1)
        second = Lesson.objects.create(module=module, title="Second", order=2)

        first.order = second.order
        first.save(update_fields=["order"])

        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(first.order, 2)
        self.assertEqual(second.order, 1)
