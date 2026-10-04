from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("assessments", "0013_questionbankitem_image_url"),
    ]

    operations = [
        migrations.AlterField(
            model_name="exam",
            name="exam_type",
            field=models.CharField(
                choices=[
                    ("EXAM", "امتحان تقييمي رسمي"),
                    ("PRACTICE", "مراجعة وتدريب تفاعلي (مع إظهار الشرح والبرهان)"),
                    ("ASSIGNMENT", "واجب بنظام الأسئلة"),
                ],
                default="EXAM",
                max_length=20,
            ),
        ),
    ]