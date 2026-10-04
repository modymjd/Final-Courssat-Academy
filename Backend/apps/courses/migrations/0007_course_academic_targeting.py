from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("courses", "0006_lessonsummary_video_lesson_video_and_more"),
    ]

    operations = [
        migrations.AddField(
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
                max_length=20,
                null=True,
            ),
        ),
        migrations.AddField(
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
                max_length=20,
                null=True,
            ),
        ),
        migrations.AddField(
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
                max_length=30,
                null=True,
            ),
        ),
        migrations.AddIndex(
            model_name="course",
            index=models.Index(
                fields=["educational_stage", "educational_grade", "subject", "status"],
                name="courses_acad_target_idx",
            ),
        ),
    ]
