import hashlib
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.contrib.auth.hashers import check_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.activation_codes.models import ActivationCode, ActivationCodeBatch
from apps.enrollments.models import Enrollment


def _normalize_pin(password: str) -> str:
    return password.strip().translate(
        str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
    )


class RedemptionService:
    @staticmethod
    def _verify_pin(code: ActivationCode, password: str) -> bool:
        password = _normalize_pin(password)
        if not password:
            return False
        if code.password and code.password == password:
            return True
        if code.pin_hash:
            if code.pin_hash == hashlib.sha256(password.encode("utf-8")).hexdigest():
                return True
            try:
                if check_password(password, code.pin_hash):
                    return True
            except Exception:
                pass
        return False

    @staticmethod
    def _enroll_or_renew_student(user, course, code: ActivationCode) -> tuple[Enrollment, bool]:
        duration = code.batch.access_duration_days
        fixed_until = code.batch.fixed_access_until

        enrollment = Enrollment.objects.select_for_update().filter(student=user, course=course).first()
        if enrollment:
            # SMART ADDITIVE RENEWAL
            if fixed_until:
                dt = datetime.combine(fixed_until, time.max)
                enrollment.expires_at = timezone.make_aware(dt) if timezone.is_naive(dt) else dt
                enrollment.status = Enrollment.EnrollmentStatus.ACTIVE
            elif duration:
                if enrollment.expires_at and enrollment.expires_at > timezone.now():
                    # Additive renewal: add to existing active expiry
                    enrollment.expires_at = enrollment.expires_at + timedelta(days=duration)
                    enrollment.status = Enrollment.EnrollmentStatus.ACTIVE
                elif enrollment.expires_at:
                    # Expired: add to current time
                    enrollment.expires_at = timezone.now() + timedelta(days=duration)
                    enrollment.status = Enrollment.EnrollmentStatus.ACTIVE
                else:
                    # Existing lifetime enrollment, keep as lifetime
                    pass
            enrollment.last_accessed_at = timezone.now()
            enrollment.save(update_fields=["expires_at", "status", "last_accessed_at", "updated_at"])
            return enrollment, True
        else:
            # NEW ENROLLMENT
            new_expires_at = None
            if fixed_until:
                dt = datetime.combine(fixed_until, time.max)
                new_expires_at = timezone.make_aware(dt) if timezone.is_naive(dt) else dt
            elif duration:
                new_expires_at = timezone.now() + timedelta(days=duration)

            enrollment = Enrollment.objects.create(
                student=user,
                course=course,
                source="activation_code",
                activation_code=code,
                expires_at=new_expires_at,
                status=Enrollment.EnrollmentStatus.ACTIVE,
            )
            return enrollment, False

    @staticmethod
    def validate_code(
        code_str: str, password: str, expected_course_id: int | None = None, user=None
    ) -> ActivationCode:
        """
        Validates an activation code before redemption.
        Returns the ActivationCode instance if valid, raises ValidationError otherwise.
        """
        clean_code = code_str.strip().upper() if code_str else ""
        code = ActivationCode.objects.select_related("batch").filter(code=clean_code).first()
        if not code:
            code = ActivationCode.objects.select_related("batch").filter(code=code_str).first()

        if not code or not RedemptionService._verify_pin(code, password):
            raise ValidationError("الكود أو كلمة المرور غير صحيحة.")

        if code.status == ActivationCode.CodeStatus.REDEEMED:
            raise ValidationError("هذا الكود تم استخدامه من قبل.")

        if code.status == ActivationCode.CodeStatus.REVOKED:
            raise ValidationError("هذا الكود تم إيقافه.")

        if code.is_expired:
            raise ValidationError("عذراً، هذا الكود المطبوع منتهي الصلاحية ولا يمكن شحنه.")

        if expected_course_id is not None and code.batch.batch_type == ActivationCodeBatch.BatchType.COURSE_ACCESS:
            if not code.batch.courses.filter(id=expected_course_id).exists():
                other_course = code.batch.courses.first()
                other_title = other_course.title if other_course else "دورة أخرى"
                raise ValidationError(f"هذا الكود مخصص لدورة '{other_title}' وليس هذه الدورة.")

        is_renewal = False
        current_expires_at = None
        new_projected_expires_at = None

        target_course_id = expected_course_id
        if not target_course_id and code.batch.courses.exists():
            first_c = code.batch.courses.first()
            if first_c:
                target_course_id = first_c.id

        if target_course_id and user and user.is_authenticated:
            existing = Enrollment.objects.filter(student=user, course_id=target_course_id).first()
            if existing:
                is_renewal = True
                current_expires_at = existing.expires_at
                if code.batch.fixed_access_until:
                    dt = datetime.combine(code.batch.fixed_access_until, time.max)
                    new_projected_expires_at = timezone.make_aware(dt) if timezone.is_naive(dt) else dt
                elif code.batch.access_duration_days:
                    if existing.expires_at and existing.expires_at > timezone.now():
                        new_projected_expires_at = existing.expires_at + timedelta(days=code.batch.access_duration_days)
                    else:
                        new_projected_expires_at = timezone.now() + timedelta(days=code.batch.access_duration_days)
                else:
                    new_projected_expires_at = None
            else:
                is_renewal = False
                current_expires_at = None
                if code.batch.fixed_access_until:
                    dt = datetime.combine(code.batch.fixed_access_until, time.max)
                    new_projected_expires_at = timezone.make_aware(dt) if timezone.is_naive(dt) else dt
                elif code.batch.access_duration_days:
                    new_projected_expires_at = timezone.now() + timedelta(days=code.batch.access_duration_days)
                else:
                    new_projected_expires_at = None

        code.is_renewal = is_renewal  # type: ignore[attr-defined]
        code.current_expires_at = current_expires_at  # type: ignore[attr-defined]
        code.new_projected_expires_at = new_projected_expires_at  # type: ignore[attr-defined]

        return code

    @staticmethod
    @transaction.atomic
    def redeem_code(user, code_str: str, password: str, expected_course_id: int | None = None) -> dict:
        """
        Redeems the activation code for the given user, using select_for_update
        to prevent race conditions.
        """
        clean_code = code_str.strip().upper() if code_str else ""
        try:
            code = ActivationCode.objects.select_for_update().select_related("batch").get(code=clean_code)
        except ActivationCode.DoesNotExist:
            try:
                code = ActivationCode.objects.select_for_update().select_related("batch").get(code=code_str)
            except ActivationCode.DoesNotExist as err:
                raise ValidationError("الكود أو كلمة المرور غير صحيحة.") from err
        except Exception as err:
            raise ValidationError("جاري معالجة الكود حالياً، يرجى المحاولة بعد قليل.") from err

        if not RedemptionService._verify_pin(code, password):
            raise ValidationError("الكود أو كلمة المرور غير صحيحة.")

        if code.status != ActivationCode.CodeStatus.ACTIVE:
            raise ValidationError("هذا الكود غير صالح للاستخدام.")

        if code.is_expired:
            raise ValidationError("عذراً، هذا الكود المطبوع منتهي الصلاحية ولا يمكن شحنه.")

        if expected_course_id is not None and code.batch.batch_type == ActivationCodeBatch.BatchType.COURSE_ACCESS:
            if not code.batch.courses.filter(id=expected_course_id).exists():
                other_course = code.batch.courses.first()
                other_title = other_course.title if other_course else "دورة أخرى"
                raise ValidationError(f"هذا الكود مخصص لدورة '{other_title}' وليس هذه الدورة.")

        enrolled_courses = []
        wallet_credit = Decimal("0.00")
        has_renewal = False
        latest_expires_at = None

        # Mode A: Course Access
        if code.batch.batch_type == ActivationCodeBatch.BatchType.COURSE_ACCESS:
            courses = code.batch.courses.all()
            for course in courses:
                enrollment, is_renew = RedemptionService._enroll_or_renew_student(user, course, code)
                enrolled_courses.append(course)
                if is_renew:
                    has_renewal = True
                latest_expires_at = enrollment.expires_at

        # Mode B: Digital Balance Top-up Voucher
        elif code.batch.batch_type == ActivationCodeBatch.BatchType.DIGITAL_BALANCE:
            from apps.finance.services import deposit_to_wallet, get_student_wallet

            credit_amount = (
                code.batch.balance_amount if code.batch.balance_amount > Decimal("0.00") else code.batch.price_per_code
            )
            if credit_amount <= Decimal("0.00"):
                raise ValidationError("قيمة كود الرصيد غير صالحة.")
            student_wallet = get_student_wallet(user)
            deposit_to_wallet(
                wallet=student_wallet,
                amount=credit_amount,
                gateway_name="activation_code",
                reference_id=f"VOUCHER_TOPUP_{code.code}_{user.id}",
            )
            wallet_credit = credit_amount

        # Mode C: Center Student Affiliation + Courses
        elif code.batch.batch_type == ActivationCodeBatch.BatchType.CENTER_STUDENT:
            from django.db.models import Q

            from apps.accounts.models import CenterInstructor, CenterStudent, InstructorStudent
            from apps.courses.models import Course

            center_profile = getattr(code.batch.created_by, "center_profile", None)
            if center_profile:
                CenterStudent.objects.get_or_create(
                    center=center_profile, student=user, defaults={"joined_via_code": code}
                )

            if code.batch.target_instructor:
                InstructorStudent.objects.get_or_create(
                    instructor=code.batch.target_instructor, student=user, defaults={"joined_via_code": code}
                )

            # 1. Any explicitly assigned batch courses
            for course in code.batch.courses.all():
                enrollment, is_renew = RedemptionService._enroll_or_renew_student(user, course, code)
                enrolled_courses.append(course)
                if is_renew:
                    has_renewal = True
                latest_expires_at = enrollment.expires_at

            # 2. Automated stage/grade course resolution for center instructors
            student_profile = getattr(user, "student_profile", None)
            if center_profile and student_profile:
                st_stage = student_profile.education_level
                st_grade = student_profile.grade_level
                st_track = student_profile.educational_track

                center_instructors = CenterInstructor.objects.filter(
                    center=center_profile, is_active=True
                ).select_related("instructor")

                for ci in center_instructors:
                    instructor = ci.instructor
                    if any(c.instructor_id == instructor.id for c in enrolled_courses):
                        continue

                    query = Course.objects.filter(instructor=instructor, status="published")
                    if st_stage:
                        query = query.filter(Q(educational_stage=st_stage) | Q(educational_stage=""))
                    if st_grade:
                        query = query.filter(Q(educational_grade=st_grade) | Q(educational_grade=""))
                    if st_track:
                        query = query.filter(
                            Q(educational_track=st_track)
                            | Q(educational_track="general")
                            | Q(educational_track="")
                        )

                    latest_course = query.order_by("-created_at").first()
                    if latest_course:
                        enrollment, is_renew = RedemptionService._enroll_or_renew_student(user, latest_course, code)
                        enrolled_courses.append(latest_course)
                        if is_renew:
                            has_renewal = True
                        latest_expires_at = enrollment.expires_at

        # Mode D: Instructor Center Join
        elif code.batch.batch_type == ActivationCodeBatch.BatchType.INSTRUCTOR_JOIN:
            from apps.accounts.models import CenterInstructor

            if hasattr(code.batch.created_by, "center_profile"):
                CenterInstructor.objects.get_or_create(
                    center=code.batch.created_by.center_profile, instructor=user, defaults={"joined_via_code": code}
                )

        # Mode E: Instructor Student Direct Affiliation
        elif code.batch.batch_type == ActivationCodeBatch.BatchType.INSTRUCTOR_STUDENT:
            from apps.accounts.models import InstructorStudent

            InstructorStudent.objects.get_or_create(
                instructor=code.batch.created_by, student=user, defaults={"joined_via_code": code}
            )

        code.status = ActivationCode.CodeStatus.REDEEMED
        code.redeemed_by = user
        code.redeemed_at = timezone.now()
        code.save(update_fields=["status", "redeemed_by", "redeemed_at"])

        if has_renewal:
            if latest_expires_at:
                friendly_message = f"تم تجديد اشتراكك بنجاح حتى {latest_expires_at.strftime('%Y-%m-%d')}."
            else:
                friendly_message = "تم تجديد اشتراكك بنجاح (وصول دائم)."
        elif code.batch.batch_type == ActivationCodeBatch.BatchType.DIGITAL_BALANCE:
            friendly_message = f"تم شحن رصيد بقيمة {wallet_credit} جنيه بنجاح."
        else:
            friendly_message = "تم تفعيل الكود بنجاح والاشتراك في الدورة."

        return {
            "code": code,
            "batch_type": code.batch.batch_type,
            "enrolled_courses": enrolled_courses,
            "wallet_credit": wallet_credit,
            "is_renewal": has_renewal,
            "new_expires_at": latest_expires_at,
            "access_duration_days": code.batch.access_duration_days,
            "fixed_access_until": code.batch.fixed_access_until,
            "message": friendly_message,
        }
