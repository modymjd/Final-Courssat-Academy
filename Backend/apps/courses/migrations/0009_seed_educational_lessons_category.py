from django.db import migrations


CATEGORY_NAME = "دروس تعليمية"
CATEGORY_SLUG = "educational-lessons"


def seed_educational_lessons_category(apps, schema_editor):
    Category = apps.get_model("courses", "Category")
    Category.objects.get_or_create(
        slug=CATEGORY_SLUG,
        defaults={
            "name": CATEGORY_NAME,
            "icon": "BookOpen",
            "color": "bg-indigo-100",
        },
    )


def remove_educational_lessons_category(apps, schema_editor):
    Category = apps.get_model("courses", "Category")
    Category.objects.filter(slug=CATEGORY_SLUG).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("courses", "0008_course_academic_targeting_blank_strings"),
    ]

    operations = [
        migrations.RunPython(
            seed_educational_lessons_category,
            remove_educational_lessons_category,
        ),
    ]
