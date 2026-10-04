from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.assessments.models import (
    Exam,
    ExamType,
    QuestionBankItem,
    StudentAnswer,
    StudentExam,
    StudentExamStatus,
)
from apps.courses.models import Category, Course
from apps.enrollments.models import Enrollment

User = get_user_model()


class Command(BaseCommand):
    help = "Seed real instructor, course, exam, and student assessment data for EduSmart"

    def handle(self, *args, **options):
        self.stdout.write("Start seeding real instructor data for EduSmart...")

        # 1. Create or Get Instructor
        instructor, created = User.objects.get_or_create(
            email="instructor@edusmart.dev",
            defaults={
                "first_name": "د. أحمد",
                "last_name": "محمود",
                "role": "instructor",
                "phone": "01012345678",
                "bio": "أستاذ العلوم الطبيعية والفيزياء الحديثة مع خبرة 15 عاماً في التقييم الأكاديمي.",
                "is_staff": True,
            },
        )
        instructor.set_password("Password123!")
        instructor.role = "instructor"
        instructor.is_staff = True
        instructor.save()
        self.stdout.write(f"Instructor User Ready: {instructor.email} (Password: Password123!)")

        # 2. Create Sample Students
        students_data = [
            {"email": "student1@edusmart.dev", "first_name": "محمود", "last_name": "السيد"},
            {"email": "student2@edusmart.dev", "first_name": "سارة", "last_name": "علي"},
            {"email": "student3@edusmart.dev", "first_name": "عمر", "last_name": "فاروق"},
            {"email": "student4@edusmart.dev", "first_name": "مريم", "last_name": "حسام"},
            {"email": "student5@edusmart.dev", "first_name": "كريم", "last_name": "عادل"},
        ]
        students = []
        for s_info in students_data:
            st, _ = User.objects.get_or_create(
                email=s_info["email"],
                defaults={
                    "first_name": s_info["first_name"],
                    "last_name": s_info["last_name"],
                    "role": "student",
                },
            )
            st.set_password("Password123!")
            st.role = "student"
            st.save()
            students.append(st)
        self.stdout.write(f"Created {len(students)} enrolled students.")

        # 3. Create Categories & Courses
        cat_chem, _ = Category.objects.get_or_create(name="الكيمياء والعلوم الطبيعية", defaults={"slug": "chem-sci"})
        cat_phys, _ = Category.objects.get_or_create(name="الفيزياء والتكنولوجيا", defaults={"slug": "phys-tech"})

        course_chem, _ = Course.objects.get_or_create(
            title="الكيمياء العضوية المتقدمة والتفاعلات",
            defaults={
                "description": "دورة شاملة في دراسة الجزيئات العضوية، ميكانيكية التفاعلات وتطبيقاتها العلمية.",
                "instructor": instructor,
                "category": cat_chem,
                "status": "published",
                "price": 450.00,
            },
        )
        course_chem.instructor = instructor
        course_chem.save()

        course_phys, _ = Course.objects.get_or_create(
            title="الفيزياء الحديثة وقوانين الحركة والجاذبية",
            defaults={
                "description": "دراسة تفصيلية لقوانين نيوتن في الحركة، السقوط الحر والنسبية مع حل المسائل.",
                "instructor": instructor,
                "category": cat_phys,
                "status": "published",
                "price": 600.00,
            },
        )
        course_phys.instructor = instructor
        course_phys.save()
        self.stdout.write("Created instructor courses.")

        # 4. Create Enrollments
        for st in students:
            Enrollment.objects.get_or_create(student=st, course=course_chem)
            Enrollment.objects.get_or_create(student=st, course=course_phys)
        self.stdout.write("Enrolled students in courses.")

        # 5. Create Exams
        exam1, _ = Exam.objects.get_or_create(
            title="اختبار تقييم منتصف الفصل - الكيمياء العضوية",
            defaults={
                "course": course_chem,
                "description": "اختبار رسمي لقياس استيعاب المفاهيم الأساسية في الكيمياء العضوية.",
                "instructions": "تأكد من عدم فتح أي تبويبات خارجية أثناء حل الاختبار لعدم تعرض محاولتك للإلغاء.",
                "exam_type": ExamType.EXAM,
                "duration_minutes": 45,
                "max_score": 100,
                "is_published": True,
            },
        )

        exam2, _ = Exam.objects.get_or_create(
            title="مراجعة شاملة وتفاعلية - قوانين الحركة والفيزياء",
            defaults={
                "course": course_phys,
                "description": "مراجعة تفاعلية يستعرض فيها الطالب البرهان والتفسير العلمي فور اختيار الإجابة.",
                "instructions": "اختر الإجابة الصحيحة واستمتع بظهور البرهان العلمي الشامل للشرح.",
                "exam_type": ExamType.PRACTICE,
                "duration_minutes": 60,
                "max_score": 100,
                "is_published": True,
            },
        )
        self.stdout.write("Created exams & interactive practice reviews.")

        # 6. Create Question Bank Items for Exam 1
        q1, _ = QuestionBankItem.objects.get_or_create(
            exam=exam1,
            question_text="ما هو الصيغة الكيميائية الصحيحة لجزيء الماء؟",
            defaults={
                "instructor": instructor,
                "question_type": QuestionBankItem.QuestionType.MULTIPLE_CHOICE,
                "points": 25.0,
                "order": 1,
                "explanation": "يتكون جزيء الماء من ذرتي هيدروجين مرابطتين بذرة أوكسجين واحدة عبر روابط تساهمية أحادية (H2O).",
                "options_json": [
                    {"text": "H2O", "isCorrect": True},
                    {"text": "CO2", "isCorrect": False},
                    {"text": "NaCl", "isCorrect": False},
                    {"text": "O2", "isCorrect": False},
                ],
            },
        )

        q2, _ = QuestionBankItem.objects.get_or_create(
            exam=exam1,
            question_text="ماذا يسمى التفاعل الناتج عن اتحاد حمض مع قاعدة لإنتاج ملح وماء؟",
            defaults={
                "instructor": instructor,
                "question_type": QuestionBankItem.QuestionType.MULTIPLE_CHOICE,
                "points": 25.0,
                "order": 2,
                "explanation": "يسمى بتفاعل التعادل (Neutralization)، مثل تفاعل حمض الهيدروكلوريك HCl مع هيدروكسيد الصوديوم NaOH.",
                "options_json": [
                    {"text": "تفاعل التعادل (Neutralization)", "isCorrect": True},
                    {"text": "تفاعل الأكسدة والإرجاع", "isCorrect": False},
                    {"text": "تفاعل التفكك", "isCorrect": False},
                    {"text": "تفاعل الاحتراق", "isCorrect": False},
                ],
            },
        )

        q3, _ = QuestionBankItem.objects.get_or_create(
            exam=exam1,
            question_text="ما هو العنصر النبيل الذي يقع في المجموعة 18 ولا يميل للتفاعل بسهولة؟",
            defaults={
                "instructor": instructor,
                "question_type": QuestionBankItem.QuestionType.MULTIPLE_CHOICE,
                "points": 25.0,
                "order": 3,
                "explanation": "النيون (Ne) هو غاز نبيل ذو غلاف إلكتروني خارجي مكتمل بثنائية/ثمانية ثبات فلا يتفاعل في الظروف العادية.",
                "options_json": [
                    {"text": "النيون (Ne)", "isCorrect": True},
                    {"text": "الصوديوم (Na)", "isCorrect": False},
                    {"text": "الكلور (Cl)", "isCorrect": False},
                    {"text": "الهيدروجين (H)", "isCorrect": False},
                ],
            },
        )

        q4, _ = QuestionBankItem.objects.get_or_create(
            exam=exam1,
            question_text="ما هي سرعة جسم يسقط سقوطاً حراً بعد مرور ثانيتين تحت تأثير جاذبية 9.8 م/ث²؟",
            defaults={
                "instructor": instructor,
                "question_type": QuestionBankItem.QuestionType.MULTIPLE_CHOICE,
                "points": 25.0,
                "order": 4,
                "explanation": "باستخدام معادلة السرعة v = g * t حيث g = 9.8 و t = 2 ثانية، فتكون السرعة = 9.8 × 2 = 19.6 م/ث.",
                "options_json": [
                    {"text": "19.6 م/ث", "isCorrect": True},
                    {"text": "9.8 م/ث", "isCorrect": False},
                    {"text": "39.2 م/ث", "isCorrect": False},
                    {"text": "4.9 م/ث", "isCorrect": False},
                ],
            },
        )
        self.stdout.write("Created exam questions with scientific proofs & explanations.")

        # 7. Create Real Student Attempts & Answers
        attempts_mock = [
            {"student": students[0], "score": 100.0, "switches": 0, "q4_correct": True},
            {"student": students[1], "score": 75.0, "switches": 1, "q4_correct": False},
            {"student": students[2], "score": 50.0, "switches": 2, "q4_correct": False},
            {"student": students[3], "score": 50.0, "switches": 3, "q4_correct": False},
            {"student": students[4], "score": 75.0, "switches": 0, "q4_correct": True},
        ]

        for att in attempts_mock:
            st_exam, _ = StudentExam.objects.get_or_create(
                student=att["student"],
                exam=exam1,
                defaults={
                    "score": att["score"],
                    "status": StudentExamStatus.SUBMITTED,
                    "tab_switches_count": att["switches"],
                },
            )
            st_exam.score = att["score"]
            st_exam.status = StudentExamStatus.SUBMITTED
            st_exam.tab_switches_count = att["switches"]
            st_exam.save()

            # Add Student Answers for Analytics (Q1, Q2, Q3, Q4)
            StudentAnswer.objects.get_or_create(
                student_exam=st_exam, question=q1, defaults={"points_earned": 25.0, "is_graded": True}
            )
            StudentAnswer.objects.get_or_create(
                student_exam=st_exam, question=q2, defaults={"points_earned": 25.0, "is_graded": True}
            )
            StudentAnswer.objects.get_or_create(
                student_exam=st_exam, question=q3, defaults={"points_earned": 25.0, "is_graded": True}
            )

            q4_pts = 25.0 if att["q4_correct"] else 0.0
            StudentAnswer.objects.get_or_create(
                student_exam=st_exam, question=q4, defaults={"points_earned": q4_pts, "is_graded": True}
            )

        self.stdout.write(self.style.SUCCESS("Successfully seeded all real instructor data 100%!"))
