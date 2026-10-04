from django.db import transaction
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsInstructorOrAdmin

from .models import Course, Lesson, Module


class CurriculumLessonInputSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False, min_value=1)
    title = serializers.CharField(max_length=200, allow_blank=False)
    type = serializers.ChoiceField(choices=["video", "article", "quiz", "assignment"])
    duration = serializers.CharField(max_length=20, allow_blank=True, required=False, default="")
    order = serializers.IntegerField(min_value=0)
    is_free = serializers.BooleanField(required=False, default=False)


class CurriculumModuleInputSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False, min_value=1)
    title = serializers.CharField(max_length=200, allow_blank=False)
    order = serializers.IntegerField(min_value=0)
    lessons = CurriculumLessonInputSerializer(many=True, allow_empty=True)


class CurriculumSyncSerializer(serializers.Serializer):
    modules = CurriculumModuleInputSerializer(many=True, allow_empty=True)

    def validate_modules(self, modules):
        module_orders = [module["order"] for module in modules]
        if len(module_orders) != len(set(module_orders)):
            raise serializers.ValidationError("Module orders must be unique.")

        module_ids = [module["id"] for module in modules if "id" in module]
        if len(module_ids) != len(set(module_ids)):
            raise serializers.ValidationError("A module cannot appear more than once.")

        lesson_ids = []
        for module in modules:
            lesson_orders = [lesson["order"] for lesson in module["lessons"]]
            if len(lesson_orders) != len(set(lesson_orders)):
                raise serializers.ValidationError("Lesson orders must be unique within each module.")
            lesson_ids.extend(lesson["id"] for lesson in module["lessons"] if "id" in lesson)

        if len(lesson_ids) != len(set(lesson_ids)):
            raise serializers.ValidationError("A lesson cannot appear more than once.")
        return modules


class CourseCurriculumSyncView(APIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]

    def post(self, request, course_id):
        serializer = CurriculumSyncSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return Response({"detail": "الدورة غير موجودة."}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if getattr(user, "role", "") not in ("admin", "super_admin") and course.instructor_id != user.id:
            return Response({"detail": "لا تملك صلاحية تعديل منهج هذه الدورة."}, status=status.HTTP_403_FORBIDDEN)

        modules_payload = serializer.validated_data["modules"]
        module_ids = {item["id"] for item in modules_payload if "id" in item}
        lesson_ids = {
            lesson["id"]
            for module in modules_payload
            for lesson in module["lessons"]
            if "id" in lesson
        }

        with transaction.atomic():
            # Lock the course and all curriculum rows for the duration of the sync.
            # This prevents concurrent saves from interleaving order changes.
            course = Course.objects.select_for_update().get(pk=course_id)
            existing_modules = list(Module.objects.select_for_update().filter(course=course))
            existing_module_map = {module.id: module for module in existing_modules}

            invalid_module_ids = module_ids.difference(existing_module_map)
            if invalid_module_ids:
                raise serializers.ValidationError({"modules": "One or more module IDs do not belong to this course."})

            existing_lessons = list(
                Lesson.objects.select_for_update().filter(module__course=course).select_related("module")
            )
            existing_lesson_map = {lesson.id: lesson for lesson in existing_lessons}
            invalid_lesson_ids = lesson_ids.difference(existing_lesson_map)
            if invalid_lesson_ids:
                raise serializers.ValidationError({"modules": "One or more lesson IDs do not belong to this course."})

            # Never silently orphan assessments when the curriculum is synchronized.
            # Exam.lesson and Exam.unit intentionally use SET_NULL because assessments
            # may be independent, so curriculum deletion must explicitly protect linked
            # lesson/unit assessments before destructive operations begin.
            removed_lesson_ids = {
                lesson.id for lesson in existing_lessons if lesson.id not in lesson_ids
            }
            removed_module_ids = {
                module.id for module in existing_modules if module.id not in module_ids
            }
            if removed_lesson_ids or removed_module_ids:
                from apps.assessments.models import Exam

                lesson_exam_exists = Exam.objects.filter(
                    lesson_id__in=removed_lesson_ids
                ).exists()
                module_exam_exists = Exam.objects.filter(
                    unit_id__in=removed_module_ids
                ).exists()
                if lesson_exam_exists or module_exam_exists:
                    raise serializers.ValidationError(
                        {
                            "curriculum": (
                                "لا يمكن حذف وحدة أو درس مرتبط باختبار. "
                                "احذف الاختبار المرتبط أولًا ثم احفظ المنهج."
                            )
                        }
                    )

            # Unique constraints are immediate. Move every existing row into a temporary
            # range before changing modules or final positions, so swaps and arbitrary moves
            # cannot collide with rows that still have their old order values.
            max_requested_order = max(
                [module["order"] for module in modules_payload]
                + [
                    lesson["order"]
                    for module in modules_payload
                    for lesson in module["lessons"]
                ]
                + [0]
            )
            existing_orders = [module.order for module in existing_modules] + [lesson.order for lesson in existing_lessons]
            temp_base = max(max(existing_orders, default=0), max_requested_order) + len(existing_modules) + len(existing_lessons) + 1000

            for index, module in enumerate(existing_modules):
                module.order = temp_base + index
                module.save(update_fields=["order", "updated_at"])

            for index, lesson in enumerate(existing_lessons):
                lesson.order = temp_base + len(existing_modules) + index
                lesson.save(update_fields=["order", "updated_at"])

            persisted_modules = {}
            persisted_lessons = {}

            # Upsert target modules first. This is intentionally done before deleting omitted
            # modules so lessons can safely move out of a module that is being removed.
            for module_index, module_payload in enumerate(modules_payload):
                module_id = module_payload.get("id")
                if module_id is None:
                    module = Module.objects.create(
                        course=course,
                        title=module_payload["title"],
                        order=temp_base + 100_000 + module_index,
                    )
                else:
                    module = existing_module_map[module_id]
                    module.title = module_payload["title"]
                    module.order = temp_base + 100_000 + module_index
                    module.save(update_fields=["title", "order", "updated_at"])
                persisted_modules[module_index] = module

                for lesson_index, lesson_payload in enumerate(module_payload["lessons"]):
                    lesson_id = lesson_payload.get("id")
                    if lesson_id is None:
                        lesson = Lesson.objects.create(
                            module=module,
                            title=lesson_payload["title"],
                            type=lesson_payload["type"],
                            duration=lesson_payload.get("duration", ""),
                            order=temp_base + 200_000 + lesson_index + (module_index * 10_000),
                            is_free=lesson_payload.get("is_free", False),
                        )
                    else:
                        lesson = existing_lesson_map[lesson_id]
                        lesson.module = module
                        lesson.title = lesson_payload["title"]
                        lesson.type = lesson_payload["type"]
                        lesson.duration = lesson_payload.get("duration", "")
                        lesson.order = temp_base + 200_000 + lesson_index + (module_index * 10_000)
                        lesson.is_free = lesson_payload.get("is_free", False)
                        lesson.save(
                            update_fields=[
                                "module",
                                "title",
                                "type",
                                "duration",
                                "order",
                                "is_free",
                                "updated_at",
                            ]
                        )
                    persisted_lessons[(module_index, lesson_index)] = lesson

            # Now that referenced lessons have been moved, remove lessons/modules omitted
            # from the submitted curriculum. Deleting a module cascades only its remaining
            # lessons, which is exactly what we want for a removed module subtree.
            for lesson in existing_lessons:
                if lesson.id not in lesson_ids:
                    lesson.delete()

            for module in existing_modules:
                if module.id not in module_ids:
                    module.delete()

            # Apply final requested positions after all rows are in collision-free temporary ranges.
            for module_index, module_payload in enumerate(modules_payload):
                module = persisted_modules[module_index]
                module.order = module_payload["order"]
                module.save(update_fields=["order", "updated_at"])
                for lesson_index, lesson_payload in enumerate(module_payload["lessons"]):
                    lesson = persisted_lessons[(module_index, lesson_index)]
                    lesson.order = lesson_payload["order"]
                    lesson.save(update_fields=["order", "updated_at"])

        return Response({"detail": "تم حفظ المنهج بنجاح."}, status=status.HTTP_200_OK)
