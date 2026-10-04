import logging
import re
from datetime import date, datetime

from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import User, UserRole
from apps.common.exceptions import PrivilegeEscalationError


def validate_national_id_structure(value: str):
    if not value:
        return
    if not re.match(r"^\d{14}$", value):
        raise serializers.ValidationError("الرقم القومي يجب أن يتكون من 14 رقماً.")

    century = value[0]
    if century not in ("2", "3"):
        raise serializers.ValidationError("رقم القرن في الرقم القومي غير صحيح.")

    year_prefix = "19" if century == "2" else "20"
    year = year_prefix + value[1:3]
    month = value[3:5]
    day = value[5:7]
    try:
        datetime.strptime(f"{year}-{month}-{day}", "%Y-%m-%d").date()
    except ValueError as err:
        raise serializers.ValidationError("تاريخ الميلاد المشفّر في الرقم القومي غير صحيح.") from err

    gov_code = value[7:9]
    valid_govs = {
        "01",
        "02",
        "03",
        "04",
        "11",
        "12",
        "13",
        "14",
        "15",
        "16",
        "17",
        "18",
        "19",
        "21",
        "22",
        "23",
        "24",
        "25",
        "26",
        "27",
        "28",
        "29",
        "31",
        "32",
        "33",
        "34",
        "35",
        "88",
    }
    if gov_code not in valid_govs:
        raise serializers.ValidationError("كود المحافظة في الرقم القومي غير صحيح.")


def validate_name_parts(attrs: dict, user: User | None = None):
    full_name = attrs.get("full_name", "").strip()
    first_name = attrs.get("first_name", "").strip()

    if full_name:
        parts = full_name.split()
        if len(parts) < 2:
            raise serializers.ValidationError({"full_name": "يرجى كتابة الاسم ثنائياً على الأقل (يفضل الاسم الرباعي)."})
        attrs["first_name"] = parts[0]
        attrs["last_name"] = " ".join(parts[1:])
    elif not first_name and (not user or not user.first_name):
        raise serializers.ValidationError({"full_name": "الاسم بالكامل مطلوب."})


def validate_egyptian_phone(phone: str, exclude_user_pk: int | None = None):
    if not phone:
        return
    if not re.match(r"^01[0125]\d{8}$", phone):
        raise serializers.ValidationError(
            {"phone": "رقم الهاتف يجب أن يكون رقم مصري صحيح يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015."}
        )
    qs = User.objects.filter(phone=phone)
    if exclude_user_pk:
        qs = qs.exclude(pk=exclude_user_pk)
    if qs.exists():
        raise serializers.ValidationError({"phone": "رقم الهاتف مسجّل بالفعل لمستخدم آخر."})


def validate_and_extract_national_id(national_id: str, attrs: dict, exclude_user_pk: int | None = None):
    if not national_id:
        return
    try:
        validate_national_id_structure(national_id)
    except serializers.ValidationError as e:
        raise serializers.ValidationError({"national_id": e.detail}) from e

    qs = User.objects.filter(national_id=national_id)
    if exclude_user_pk:
        qs = qs.exclude(pk=exclude_user_pk)
    if qs.exists():
        raise serializers.ValidationError({"national_id": "الرقم القومي مسجّل بالفعل لمستخدم آخر."})

    century = national_id[0]
    year_prefix = "19" if century == "2" else "20"
    nid_year = int(year_prefix + national_id[1:3])
    nid_month = int(national_id[3:5])
    nid_day = int(national_id[5:7])

    try:
        nid_dob = date(nid_year, nid_month, nid_day)
    except ValueError as err:
        raise serializers.ValidationError(
            {"national_id": "تاريخ الميلاد المستخرج من الرقم القومي غير صالح (يوم أو شهر غير صحيح)."}
        ) from err

    today = date.today()
    if nid_dob > today:
        raise serializers.ValidationError({"national_id": "تاريخ الميلاد في الرقم القومي لا يمكن أن يكون في المستقبل."})

    age = today.year - nid_dob.year - ((today.month, today.day) < (nid_dob.month, nid_dob.day))
    target_role = attrs.get("role")

    if target_role == UserRole.INSTRUCTOR and age < 18:
        raise serializers.ValidationError({"national_id": f"عمر المحاضر ({age} عاماً) لا يمكن أن يقل عن 18 عاماً."})
    if target_role == UserRole.GUARDIAN and age < 18:
        raise serializers.ValidationError({"national_id": f"عمر ولي الأمر ({age} عاماً) لا يمكن أن يقل عن 18 عاماً."})

    dob = attrs.get("date_of_birth")
    if dob and dob != nid_dob:
        raise serializers.ValidationError(
            {"date_of_birth": "تاريخ الميلاد لا يتطابق مع التاريخ المستخرج من الرقم القومي."}
        )
    attrs["date_of_birth"] = nid_dob

    digit_13 = int(national_id[12])
    nid_gender = "male" if digit_13 % 2 != 0 else "female"
    user_gender = attrs.get("gender")
    if user_gender and user_gender != nid_gender:
        raise serializers.ValidationError(
            {"gender": f"النوع المحدد ({'ذكر' if user_gender == 'male' else 'أنثى'}) لا يتطابق مع الرقم القومي."}
        )
    attrs["gender"] = nid_gender


def validate_minor_guardian(attrs: dict, user: User | None = None):
    dob = attrs.get("date_of_birth") or getattr(user, "date_of_birth", None)
    role = attrs.get("role", getattr(user, "role", UserRole.STUDENT) if user else UserRole.STUDENT)
    if role == UserRole.STUDENT and dob:
        today = date.today()
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        if age < 18:
            guardian_data = attrs.get("guardian")
            if not guardian_data or not guardian_data.get("phone"):
                raise serializers.ValidationError(
                    {"guardian": "رقم هاتف ولي الأمر إلزامي بصرامة للطلاب تحت سن 18 عاماً."}
                )


def validate_student_education(attrs: dict, user: User | None = None):
    role = attrs.get("role", getattr(user, "role", UserRole.STUDENT) if user else UserRole.STUDENT)
    if role == UserRole.STUDENT:
        ed_level = attrs.get("education_level")
        if ed_level == "university":
            if not attrs.get("university_name"):
                raise serializers.ValidationError({"university_name": "اسم الجامعة مطلوب للمرحلة الجامعية."})
        elif ed_level in ("primary", "prep", "secondary", "baccalaureate"):
            if not attrs.get("school_name"):
                raise serializers.ValidationError({"school_name": "اسم المدرسة مطلوب لهذه المرحلة الدراسية."})


# ============================================================================
# Security: Privilege Escalation Detection & Input Sanitization
# ============================================================================

security_logger = logging.getLogger("edusmart.security")

PRIVILEGED_ROLES = frozenset(
    {
        UserRole.ADMIN,
        UserRole.SUPER_ADMIN,
    }
)

ALLOWED_PUBLIC_REGISTRATION_ROLES = frozenset(
    {
        UserRole.STUDENT,
        UserRole.INSTRUCTOR,
        UserRole.GUARDIAN,
        UserRole.CENTER,
    }
)

SENSITIVE_LOG_FIELDS = frozenset(
    {
        "password",
        "password_confirm",
        "password1",
        "password2",
        "old_password",
        "new_password",
        "token",
        "refresh",
        "access",
    }
)

FORBIDDEN_SYSTEM_FIELDS = frozenset(
    {
        "is_staff",
        "is_superuser",
        "is_active",
        "subscription_plan",
        "auth_provider",
    }
)


def _get_client_ip(request):
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "unknown")


def _log_privilege_escalation_attempt(raw_data, request=None, reason=""):
    safe_payload = (
        {k: "***REDACTED***" if k in SENSITIVE_LOG_FIELDS else v for k, v in raw_data.items()}
        if isinstance(raw_data, dict)
        else {}
    )

    context = {
        "timestamp": timezone.now().isoformat(),
        "reason": reason,
        "payload": safe_payload,
    }

    if request:
        context["ip_address"] = _get_client_ip(request)
        context["user_agent"] = request.META.get("HTTP_USER_AGENT", "unknown")
        context["method"] = request.method
        context["path"] = request.path
        if hasattr(request, "user") and request.user and request.user.is_authenticated:
            context["authenticated_user_id"] = request.user.id
            context["authenticated_user_email"] = request.user.email

    security_logger.warning(
        "PRIVILEGE_ESCALATION_ATTEMPT: %s | Context: %s",
        reason,
        context,
    )


def _sanitize_string(value):
    if not isinstance(value, str):
        return value
    value = value.strip()
    if re.search(r"<[a-zA-Z/!][^>]*>", value):
        raise serializers.ValidationError("HTML tags are not allowed in this field.")
    if re.search(r"(?i)(javascript\s*:|on[a-z]+\s*=)", value):
        raise serializers.ValidationError("Script content is not allowed in this field.")
    return value


def _check_forbidden_system_fields(raw_data, request=None):
    detected = [field for field in FORBIDDEN_SYSTEM_FIELDS if field in raw_data]
    if detected:
        _log_privilege_escalation_attempt(
            raw_data,
            request,
            reason=f"Attempted to set forbidden system fields: {detected}",
        )
        raise PrivilegeEscalationError(
            detail="Submission of privileged system fields is forbidden via this endpoint.",
        )
