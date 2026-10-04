from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import CenterProfile, CenterStudent
from apps.courses.models import Course
from apps.enrollments.models import Enrollment
from apps.finance.models import BulkLicensePack, SeatAllocation


class BulkLicensingService:
    """
    B2B Educational Center Bulk Licensing Engine.
    Handles bulk seat purchases, seat quota tracking, allocation to students,
    and seat revocation with pessimistic row-level locking.
    """

    @staticmethod
    @transaction.atomic
    def purchase_license_pack(
        center_profile: CenterProfile,
        course: Course | None = None,
        total_seats: int = 100,
        price_per_seat: Decimal = Decimal("150.00"),
        expires_at=None,
    ) -> BulkLicensePack:
        total_paid = Decimal(str(total_seats)) * price_per_seat
        pack = BulkLicensePack.objects.create(
            center=center_profile,
            course=course,
            total_seats=total_seats,
            assigned_seats=0,
            price_per_seat=price_per_seat,
            total_paid=total_paid,
            is_active=True,
            expires_at=expires_at,
        )
        return pack

    @staticmethod
    @transaction.atomic
    def allocate_seat_to_student(
        center_profile: CenterProfile,
        student_user,
        course: Course | None = None,
        license_pack: BulkLicensePack | None = None,
        activation_code=None,
    ) -> SeatAllocation:
        target_course = course
        if license_pack:
            pack = BulkLicensePack.objects.select_for_update().get(pk=license_pack.pk)
            target_course = target_course or pack.course
        else:
            packs_query = BulkLicensePack.objects.select_for_update().filter(
                center=center_profile,
                is_active=True,
            )
            if target_course:
                packs_query = packs_query.filter(course=target_course)

            pack = None
            for candidate in packs_query:
                if candidate.remaining_seats > 0:
                    pack = candidate
                    break

        if not pack or pack.remaining_seats <= 0:
            raise ValidationError("لا توجد مقاعد مرخصة كافية في باقة المؤسسة.")

        pack.assigned_seats += 1
        pack.save(update_fields=["assigned_seats", "updated_at"])

        allocation = SeatAllocation.objects.create(
            license_pack=pack,
            student=student_user,
            activation_code=activation_code,
            is_active=True,
        )

        # Ensure CenterStudent affiliation exists
        CenterStudent.objects.get_or_create(
            center=center_profile,
            student=student_user,
            defaults={"joined_via_code": activation_code},
        )

        # Auto-enroll student into the course
        if target_course:
            Enrollment.objects.get_or_create(
                student=student_user,
                course=target_course,
                defaults={"source": "center_bulk"},
            )

        return allocation

    @staticmethod
    @transaction.atomic
    def revoke_seat(allocation_id: int, center_profile: CenterProfile) -> None:
        try:
            allocation = SeatAllocation.objects.select_for_update().get(
                pk=allocation_id,
                license_pack__center=center_profile,
            )
        except SeatAllocation.DoesNotExist as err:
            raise ValidationError("تخصيص المقعد غير موجود أو لا ينتمي لهذه المؤسسة.") from err

        if not allocation.is_active:
            return

        allocation.is_active = False
        allocation.revoked_at = timezone.now()
        allocation.save(update_fields=["is_active", "revoked_at", "updated_at"])

        pack = BulkLicensePack.objects.select_for_update().get(pk=allocation.license_pack_id)
        pack.assigned_seats = max(0, pack.assigned_seats - 1)
        pack.save(update_fields=["assigned_seats", "updated_at"])

        # Revoke course enrollment if seat was linked to a specific course
        if pack.course:
            Enrollment.objects.filter(student=allocation.student, course=pack.course).delete()

    @staticmethod
    def get_center_quota_summary(center_profile: CenterProfile) -> dict:
        packs = BulkLicensePack.objects.filter(center=center_profile, is_active=True)
        total_seats = sum(p.total_seats for p in packs)
        assigned_seats = sum(p.assigned_seats for p in packs)
        remaining_seats = max(0, total_seats - assigned_seats)

        return {
            "total_seats": total_seats,
            "assigned_seats": assigned_seats,
            "remaining_seats": remaining_seats,
            "packs_count": packs.count(),
        }
