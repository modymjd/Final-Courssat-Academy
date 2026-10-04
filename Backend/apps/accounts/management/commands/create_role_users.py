from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import AdminProfile, InstructorProfile, StudentProfile, User, UserRole

DEFAULT_PASSWORD = "Passw0rd123!"

ROLE_USERS_CONFIG = [
    {
        "role": UserRole.STUDENT,
        "email": "student@edusmart.dev",
        "first_name": "طالب",
        "last_name": "تجريبي",
        "bio": "طالب شغوف بتعلم البرمجيات والتقنيات الحديثة في منصة EduSmart.",
        "phone": "+201000000001",
        "is_staff": False,
        "is_superuser": False,
        "subscription_plan": "PRO",
        "organization": "جامعة القاهرة",
        "profile_setup": lambda user: StudentProfile.objects.filter(user=user).update(study_streak=7),
    },
    {
        "role": UserRole.INSTRUCTOR,
        "email": "instructor@edusmart.dev",
        "first_name": "أحمد",
        "last_name": "المدرب",
        "bio": "خبير ومحاضر دولي في الهندسة البرمجية وتطوير أطر العمل والذكاء الاصطناعي.",
        "phone": "+201000000002",
        "is_staff": False,
        "is_superuser": False,
        "subscription_plan": "INSTITUTIONAL",
        "organization": "EduSmart Academy",
        "profile_setup": lambda user: InstructorProfile.objects.filter(user=user).update(
            title="خبير وتطوير الأنظمة البرمجية",
            specialization="Software Architecture & AI",
            is_verified=True,
            is_featured=True,
        ),
    },
    {
        "role": UserRole.ADMIN,
        "email": "admin@edusmart.dev",
        "first_name": "سارة",
        "last_name": "المشرف",
        "bio": "مشرف إدارة النظام والمحتوى التعليمي وإدارة مستخدمين منصة EduSmart.",
        "phone": "+201000000003",
        "is_staff": True,
        "is_superuser": False,
        "subscription_plan": "INSTITUTIONAL",
        "organization": "EduSmart Ops",
        "profile_setup": lambda user: AdminProfile.objects.filter(user=user).update(
            permissions_list=["manage_users", "manage_courses", "view_analytics", "moderate_content"]
        ),
    },
    {
        "role": UserRole.SUPER_ADMIN,
        "email": "superadmin@edusmart.dev",
        "first_name": "المدير",
        "last_name": "الرئيسي",
        "bio": "المدير الرئيسي للنظام بحصانة كاملة وصلاحيات فائقة على جميع الموارد والأدوات.",
        "phone": "+201000000004",
        "is_staff": True,
        "is_superuser": True,
        "subscription_plan": "INSTITUTIONAL",
        "organization": "EduSmart Executive",
        "profile_setup": lambda user: AdminProfile.objects.filter(user=user).update(permissions_list=["*"]),
    },
]


class Command(BaseCommand):
    help = "Create demo accounts for every available user role in EduSmart platform"

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Starting creation of users for all roles..."))

        created_summary = []

        for config in ROLE_USERS_CONFIG:
            email = config["email"]
            role = config["role"]

            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "first_name": config["first_name"],
                    "last_name": config["last_name"],
                    "role": role,
                    "bio": config["bio"],
                    "phone": config["phone"],
                    "is_staff": config["is_staff"],
                    "is_superuser": config["is_superuser"],
                    "subscription_plan": config["subscription_plan"],
                    "organization": config["organization"],
                    "is_active": True,
                },
            )

            # Update existing user fields if needed
            if not created:
                user.first_name = config["first_name"]
                user.last_name = config["last_name"]
                user.role = role
                user.is_staff = config["is_staff"]
                user.is_superuser = config["is_superuser"]
                user.bio = config["bio"]
                user.phone = config["phone"]
                user.subscription_plan = config["subscription_plan"]
                user.organization = config["organization"]
                user.is_active = True

            user.set_password(DEFAULT_PASSWORD)
            user.save()

            # Execute profile setup function
            if "profile_setup" in config and callable(config["profile_setup"]):
                config["profile_setup"](user)

            status_str = "Created" if created else "Updated & Password Reset"
            created_summary.append((user.email, user.role, status_str))
            self.stdout.write(self.style.SUCCESS(f"  [{status_str}] Role: {role.upper():12} | Email: {email}"))

        self.stdout.write(self.style.SUCCESS("\n=============================================="))
        self.stdout.write(self.style.SUCCESS("  All User Roles Created / Configured Successfully!"))
        self.stdout.write(self.style.SUCCESS("=============================================="))
        self.stdout.write(f"Default Password for all accounts: {DEFAULT_PASSWORD}\n")
