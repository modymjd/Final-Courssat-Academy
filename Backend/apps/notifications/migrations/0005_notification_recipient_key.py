from django.db import migrations, models
from django.db.models import Q


def deduplicate_notifications(apps, schema_editor):
    Notification = apps.get_model("notifications", "Notification")

    seen = set()
    duplicates = []
    queryset = (
        Notification.objects.filter(action_url__gt="")
        .order_by("user_id", "type", "action_url", "-created_at", "-id")
        .values_list("id", "user_id", "type", "action_url")
    )

    for notification_id, user_id, notification_type, action_url in queryset.iterator():
        key = (user_id, notification_type, action_url)
        if key in seen:
            duplicates.append(notification_id)
        else:
            seen.add(key)

    if duplicates:
        Notification.objects.filter(id__in=duplicates).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("notifications", "0004_parentconsent_explicit_consent"),
    ]

    operations = [
        migrations.RunPython(deduplicate_notifications, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="notification",
            constraint=models.UniqueConstraint(
                fields=("user", "type", "action_url"),
                condition=Q(action_url__gt=""),
                name="notifications_user_type_action_url_uniq",
            ),
        ),
    ]
