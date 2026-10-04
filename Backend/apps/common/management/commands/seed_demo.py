from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import User, UserRole
from apps.courses.models import Category, Course, CourseStatus, Lesson, LessonType, Module
from apps.enrollments.models import Enrollment, LessonCompletion

CATEGORIES = [
    {"name": "تطوير الويب", "slug": "web-development", "icon": "Globe", "color": "bg-blue-500"},
    {"name": "تطوير التطبيقات", "slug": "mobile-development", "icon": "Smartphone", "color": "bg-green-500"},
    {"name": "علوم البيانات", "slug": "data-science", "icon": "BarChart3", "color": "bg-purple-500"},
    {"name": "التصميم", "slug": "design", "icon": "Palette", "color": "bg-pink-500"},
    {"name": "الأمن السيبراني", "slug": "cybersecurity", "icon": "Shield", "color": "bg-red-500"},
    {"name": "إدارة الأعمال", "slug": "business", "icon": "Briefcase", "color": "bg-amber-500"},
    {"name": "الذكاء الاصطناعي", "slug": "ai-ml", "icon": "Brain", "color": "bg-indigo-500"},
    {"name": "الشبكات", "slug": "networking", "icon": "Network", "color": "bg-teal-500"},
]

INSTRUCTORS = [
    {"email": "ahmed@edusmart.dev", "first_name": "أحمد", "last_name": "محمود", "title": "مهندس برمجيات أول"},
    {"email": "sara@edusmart.dev", "first_name": "سارة", "last_name": "أحمد", "title": "مطورة Full Stack"},
    {"email": "mohamed@edusmart.dev", "first_name": "محمد", "last_name": "علي", "title": "خبير أمن سيبراني"},
    {"email": "noura@edusmart.dev", "first_name": "نورة", "last_name": "حسين", "title": "مصممة UI/UX"},
    {"email": "khaled@edusmart.dev", "first_name": "خالد", "last_name": "سالم", "title": "مهندس بيانات"},
]

COURSES = [
    (
        "تطوير مواقع الويب الاحترافية",
        "ahmed@edusmart.dev",
        "web-development",
        299,
        "beginner",
        48,
        "32 ساعة",
        False,
        "تعلم بناء مواقع ويب احترافية من الصفر باستخدام HTML, CSS, JavaScript وأحدث أطر العمل.",
    ),
    (
        "React.js من الصفر إلى الاحتراف",
        "sara@edusmart.dev",
        "web-development",
        399,
        "intermediate",
        62,
        "40 ساعة",
        False,
        "أتقن React.js مع TypeScript, Hooks, Context, Redux وبناء تطبيقات واقعية متكاملة.",
    ),
    (
        "تطبيقات Flutter للموبايل",
        "mohamed@edusmart.dev",
        "mobile-development",
        349,
        "intermediate",
        55,
        "36 ساعة",
        False,
        "ابنِ تطبيقات موبايل عابرة للمنصات بتصميم جذاب وأداء عالٍ باستخدام Flutter و Dart.",
    ),
    (
        "أساسيات Python للمبتدئين",
        "khaled@edusmart.dev",
        "data-science",
        0,
        "beginner",
        30,
        "18 ساعة",
        True,
        "ابدأ رحلتك في البرمجة مع Python — اللغة الأكثر طلباً في سوق العمل.",
    ),
    (
        "تصميم واجهات المستخدم UI/UX",
        "noura@edusmart.dev",
        "design",
        249,
        "beginner",
        38,
        "24 ساعة",
        False,
        "تعلم مبادئ التصميم الاحترافي وأدوات Figma لإنشاء تجارب مستخدم استثنائية.",
    ),
    (
        "الأمن السيبراني المتقدم",
        "mohamed@edusmart.dev",
        "cybersecurity",
        499,
        "advanced",
        45,
        "30 ساعة",
        False,
        "اختبار الاختراق، تحليل الثغرات، والاستجابة للحوادث الأمنية بأحدث الأدوات والتقنيات.",
    ),
    (
        "Node.js و Express.js",
        "ahmed@edusmart.dev",
        "web-development",
        349,
        "intermediate",
        42,
        "28 ساعة",
        False,
        "بناء خوادم وAPIs احترافية مع Node.js, Express, MongoDB وأنماط التصميم المتقدمة.",
    ),
    (
        "إدارة المشاريع التقنية",
        "khaled@edusmart.dev",
        "business",
        199,
        "beginner",
        25,
        "15 ساعة",
        False,
        "قيادة فرق تقنية، إدارة الوقت، وأدوات Agile & Scrum للمشاريع الحديثة.",
    ),
]


class Command(BaseCommand):
    help = "Seed the database with demo users, categories, courses, and enrollments"

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write("Seeding categories…")
        cat_map = {}
        for c in CATEGORIES:
            obj, _ = Category.objects.update_or_create(
                slug=c["slug"],
                defaults={"name": c["name"], "icon": c["icon"], "color": c["color"]},
            )
            cat_map[c["slug"]] = obj

        self.stdout.write("Seeding demo accounts…")
        student = self._ensure_user("student@edusmart.dev", "محمد", "سعيد", UserRole.STUDENT)
        self._ensure_user("admin@edusmart.dev", "سارة", "أحمد", UserRole.ADMIN, is_staff=True, is_superuser=False)
        self._ensure_user(
            "superadmin@edusmart.dev", "المدير", "الرئيسي", UserRole.SUPER_ADMIN, is_staff=True, is_superuser=True
        )
        instructor_map = {}
        for inst in INSTRUCTORS:
            u = self._ensure_user(inst["email"], inst["first_name"], inst["last_name"], UserRole.INSTRUCTOR)
            if hasattr(u, "instructor_profile"):
                u.instructor_profile.title = inst["title"]
                u.instructor_profile.save(update_fields=["title"])
            instructor_map[inst["email"]] = u

        primary_instructor = self._ensure_user("instructor@edusmart.dev", "أحمد", "المدرب", UserRole.INSTRUCTOR)
        instructor_map["instructor@edusmart.dev"] = primary_instructor

        self.stdout.write("Seeding courses…")
        created_courses = []
        for title, inst_email, cat_slug, price, level, lessons_count, duration, is_free, desc in COURSES:
            instructor = instructor_map.get(inst_email, primary_instructor)
            course, _ = Course.objects.update_or_create(
                title=title,
                defaults={
                    "short_description": desc[:200],
                    "description": desc,
                    "instructor": instructor,
                    "category": cat_map[cat_slug],
                    "duration": duration,
                    "level": level,
                    "price": Decimal(price),
                    "is_free": is_free,
                    "status": CourseStatus.PUBLISHED,
                    "language": "ar",
                    "image_url": "",
                    "requirements": ["حاسوب متصل بالإنترنت", "شغف بالتعلم"],
                    "objectives": ["فهم الأساسيات", "بناء مشروع عملي", "الوصول للاحتراف"],
                },
            )
            created_courses.append((course, lessons_count))

            # One module with N lessons for realism
            module, _ = Module.objects.update_or_create(
                course=course,
                order=1,
                defaults={"title": "المحتوى الأساسي"},
            )
            existing = module.lessons.count()
            for i in range(existing, lessons_count):
                Lesson.objects.create(
                    module=module,
                    title=f"الدرس {i + 1}",
                    type=LessonType.VIDEO,
                    duration="12:30",
                    order=i + 1,
                    is_free=(i < 2),
                )

        self.stdout.write("Seeding enrollments…")
        for course, _ in created_courses[:3]:
            enr, _ = Enrollment.objects.get_or_create(student=student, course=course)
            # Complete the first few lessons for the first two courses
            for lesson in Lesson.objects.filter(module__course=course).order_by("order")[:10]:
                LessonCompletion.objects.get_or_create(enrollment=enr, lesson=lesson)

        self.stdout.write(self.style.SUCCESS("Seed complete."))
        self.stdout.write("Accounts:")
        self.stdout.write("  student@edusmart.dev    / Passw0rd!")
        self.stdout.write("  instructor@edusmart.dev / Passw0rd!")
        self.stdout.write("  admin@edusmart.dev      / Passw0rd!")
        self.stdout.write("  superadmin@edusmart.dev / Passw0rd!")

    def _ensure_user(self, email, first_name, last_name, role, is_staff=False, is_superuser=False):
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "first_name": first_name,
                "last_name": last_name,
                "role": role,
                "is_staff": is_staff,
                "is_superuser": is_superuser,
            },
        )
        if created or not user.has_usable_password():
            user.set_password("Passw0rd!")
            user.save()
        return user
