from django.db import migrations, models


def normalize_academic_targeting(apps, schema_editor):
    Course = apps.get_model("courses", "Course")
    Course.objects.filter(educational_stage__isnull=True).update(educational_stage="")
    Course.objects.filter(educational_grade__isnull=True).update(educational_grade="")
    Course.objects.filter(subject__isnull=True).update(subject="")


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ("courses", "0007_course_academic_targeting"),
    ]

    operations = [
        migrations.RunPython(normalize_academic_targeting, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="course",
            name="educational_stage",
            field=models.CharField(
                blank=True,
                choices=[
                    ("primary", "ابتدائي"),
                    ("prep", "إعدادي"),
                    ("secondary", "ثانوي"),
                    ("university", "جامعة"),
                ],
                db_index=True,
                default="",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="course",
            name="educational_grade",
            field=models.CharField(
                blank=True,
                choices=[
                    ("primary_1", "الصف الأول الابتدائي"),
                    ("primary_2", "الصف الثاني الابتدائي"),
                    ("primary_3", "الصف الثالث الابتدائي"),
                    ("primary_4", "الصف الرابع الابتدائي"),
                    ("primary_5", "الصف الخامس الابتدائي"),
                    ("primary_6", "الصف السادس الابتدائي"),
                    ("prep_1", "الصف الأول الإعدادي"),
                    ("prep_2", "الصف الثاني الإعدادي"),
                    ("prep_3", "الصف الثالث الإعدادي"),
                    ("secondary_1", "الصف الأول الثانوي"),
                    ("secondary_2", "الصف الثاني الثانوي"),
                    ("secondary_3", "الصف الثالث الثانوي"),
                    ("university", "جامعة"),
                ],
                db_index=True,
                default="",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="course",
            name="subject",
            field=models.CharField(
                blank=True,
                choices=[
                    ("arabic", "اللغة العربية"),
                    ("english", "اللغة الإنجليزية"),
                    ("math", "الرياضيات"),
                    ("science", "العلوم"),
                    ("social_studies", "الدراسات الاجتماعية"),
                    ("physics", "الفيزياء"),
                    ("chemistry", "الكيمياء"),
                    ("biology", "الأحياء"),
                    ("french", "اللغة الفرنسية"),
                    ("german", "اللغة الألمانية"),
                    ("computer", "الحاسب الآلي"),
                    ("other", "أخرى"),
                ],
                db_index=True,
                default="",
                max_length=30,
            ),
        ),
    ]
