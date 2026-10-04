from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsLessonCourseOwnerOrAdmin, IsModuleCourseOwnerOrAdmin

from .models import Course, Lesson, Module
from .serializers import LessonSerializer, ModuleSerializer


class OrderPayloadSerializer(serializers.Serializer):
    order = serializers.IntegerField(min_value=0)


class ModuleReorderView(APIView):
    permission_classes = [IsAuthenticated, IsModuleCourseOwnerOrAdmin]

    @transaction.atomic
    def post(self, request, module_id):
        payload = OrderPayloadSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        requested_order = payload.validated_data["order"]

        module = Module.objects.select_related("course").filter(pk=module_id).first()
        if module is None:
            return Response({"detail": "الوحدة غير موجودة."}, status=status.HTTP_404_NOT_FOUND)

        # Standard lock order: Course -> Module. This matches module creation,
        # model-level order updates, and curriculum synchronization.
        Course.objects.select_for_update(of=("self",)).get(pk=module.course_id)
        module = Module.objects.select_for_update().select_related("course").get(pk=module_id)
        self.check_object_permissions(request, module)

        current_order = module.order
        if requested_order == current_order:
            return Response(ModuleSerializer(module, context={"request": request}).data)

        siblings = Module.objects.select_for_update().filter(course_id=module.course_id)
        target = siblings.exclude(pk=module.pk).filter(order=requested_order).first()

        if target is not None:
            max_order = siblings.aggregate(max_order=Max("order"))["max_order"] or 0
            transient_order = max_order + 1
            Module.objects.filter(pk=target.pk).update(order=transient_order)
            Module.objects.filter(pk=module.pk).update(order=requested_order, updated_at=timezone.now())
            Module.objects.filter(pk=target.pk).update(order=current_order, updated_at=timezone.now())
        else:
            Module.objects.filter(pk=module.pk).update(order=requested_order, updated_at=timezone.now())

        module.refresh_from_db()
        return Response(ModuleSerializer(module, context={"request": request}).data)


class LessonReorderView(APIView):
    permission_classes = [IsAuthenticated, IsLessonCourseOwnerOrAdmin]

    @transaction.atomic
    def post(self, request, lesson_id):
        payload = OrderPayloadSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        requested_order = payload.validated_data["order"]

        lesson = Lesson.objects.select_related("module").filter(pk=lesson_id).first()
        if lesson is None:
            return Response({"detail": "الدرس غير موجود."}, status=status.HTTP_404_NOT_FOUND)

        # Standard lock order: Module -> Lesson. This matches lesson creation,
        # model-level order updates, deletion, and assessment binding.
        Module.objects.select_for_update(of=("self",)).get(pk=lesson.module_id)
        lesson = Lesson.objects.select_for_update().select_related("module").get(pk=lesson_id)
        self.check_object_permissions(request, lesson)

        current_order = lesson.order
        if requested_order == current_order:
            return Response(LessonSerializer(lesson, context={"request": request}).data)

        siblings = Lesson.objects.select_for_update().filter(module_id=lesson.module_id)
        target = siblings.exclude(pk=lesson.pk).filter(order=requested_order).first()

        if target is not None:
            max_order = siblings.aggregate(max_order=Max("order"))["max_order"] or 0
            transient_order = max_order + 1
            Lesson.objects.filter(pk=target.pk).update(order=transient_order)
            Lesson.objects.filter(pk=lesson.pk).update(order=requested_order, updated_at=timezone.now())
            Lesson.objects.filter(pk=target.pk).update(order=current_order, updated_at=timezone.now())
        else:
            Lesson.objects.filter(pk=lesson.pk).update(order=requested_order, updated_at=timezone.now())

        lesson.refresh_from_db()
        return Response(LessonSerializer(lesson, context={"request": request}).data)
