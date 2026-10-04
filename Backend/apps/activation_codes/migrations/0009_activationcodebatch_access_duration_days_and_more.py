# Generated manually for activation code access duration and fixed access

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('activation_codes', '0008_alter_centerquotarequest_center'),
    ]

    operations = [
        migrations.AddField(
            model_name='activationcodebatch',
            name='access_duration_days',
            field=models.PositiveIntegerField(
                blank=True,
                help_text='مدة صلاحية الكورس بالأيام بعد التفعيل (مثال: 30 للشهر، 120 للترم). اترك فارغاً إذا كان مدى الحياة.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='activationcodebatch',
            name='fixed_access_until',
            field=models.DateField(
                blank=True,
                help_text='تاريخ محدد ثابت لانتهاء وصول جميع الطلاب (مثال: 30 يونيو).',
                null=True,
            ),
        ),
    ]
