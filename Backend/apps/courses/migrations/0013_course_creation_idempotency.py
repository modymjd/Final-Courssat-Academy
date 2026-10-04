from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0012_lesson_available_from_lesson_is_published_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="course",
            name="creation_idempotency_key",
            field=models.CharField(
                blank=True,
                db_index=True,
                default="",
                editable=False,
                max_length=128,
            ),
        ),
        migrations.AddField(
            model_name="course",
            name="creation_request_hash",
            field=models.CharField(
                blank=True,
                default="",
                editable=False,
                max_length=64,
            ),
        ),
        migrations.AddConstraint(
            model_name="course",
            constraint=models.UniqueConstraint(
                condition=~models.Q(creation_idempotency_key=""),
                fields=("instructor", "creation_idempotency_key"),
                name="courses_course_instructor_creation_idempotency_uniq",
            ),
        ),
    ]
