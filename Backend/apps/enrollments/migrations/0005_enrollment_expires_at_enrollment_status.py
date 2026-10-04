# Generated manually for enrollment lifecycle

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('enrollments', '0004_lessonprogress'),
    ]

    operations = [
        migrations.AddField(
            model_name='enrollment',
            name='expires_at',
            field=models.DateTimeField(
                blank=True,
                db_index=True,
                help_text='تاريخ انتهاء صلاحية وصول الطالب للكورس. Null يعني وصول دائم مدى الحياة.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='enrollment',
            name='status',
            field=models.CharField(
                choices=[('active', 'نشط'), ('grace_period', 'فترة سماح'), ('expired', 'منتهي الصلاحية')],
                db_index=True,
                default='active',
                max_length=15,
            ),
        ),
    ]
