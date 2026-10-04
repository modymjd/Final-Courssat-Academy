from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("assessments", "0012_exam_cooldown_seconds_exam_is_checkpoint_mandatory_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="questionbankitem",
            name="image_url",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
    ]