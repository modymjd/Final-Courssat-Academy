from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('activation_codes', '0002_alter_activationcodebatch_batch_type'),
    ]

    operations = [
        migrations.AlterField(
            model_name='activationcodebatch',
            name='batch_type',
            field=models.CharField(
                choices=[
                    ('course_access', 'وصول لكورس'),
                    ('digital_balance', 'شحن رصيد محفظة'),
                    ('instructor_join', 'انضمام مدرس'),
                    ('center_student', 'طالب مؤسسة'),
                    ('instructor_student', 'طالب مدرس'),
                ],
                max_length=25,
            ),
        ),
        migrations.AddField(
            model_name='activationcodebatch',
            name='balance_amount',
            field=models.DecimalField(decimal_places=2, default=0, help_text='Wallet credit amount for digital balance vouchers', max_digits=10),
        ),
        migrations.AlterField(
            model_name='activationcode',
            name='password',
            field=models.CharField(max_length=128),
        ),
        migrations.AddField(
            model_name='activationcode',
            name='pin_hash',
            field=models.CharField(blank=True, default='', help_text='PBKDF2/Argon2 hash of PIN', max_length=128),
        ),
        migrations.AddIndex(
            model_name='activationcode',
            index=models.Index(fields=['status', 'code'], name='activation__status_097e16_idx'),
        ),
        migrations.AddIndex(
            model_name='activationcode',
            index=models.Index(fields=['batch', 'status'], name='activation__batch_i_9c4179_idx'),
        ),
    ]
