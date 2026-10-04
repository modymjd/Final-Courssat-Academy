import django.db.models.deletion
from decimal import Decimal
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
        ('activation_codes', '0003_activation_code_pin_hash_digital_balance'),
        ('courses', '0001_initial'),
        ('finance', '0005_payoutrequest_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='coupon',
            name='applicable_courses',
            field=models.ManyToManyField(blank=True, related_name='coupons', to='courses.course'),
        ),
        migrations.AlterField(
            model_name='coupon',
            name='applicable_plans',
            field=models.ManyToManyField(blank=True, related_name='coupons', to='finance.pricingplan'),
        ),
        migrations.CreateModel(
            name='BulkLicensePack',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('total_seats', models.PositiveIntegerField(default=100)),
                ('assigned_seats', models.PositiveIntegerField(default=0)),
                ('price_per_seat', models.DecimalField(decimal_places=2, default=Decimal('150.00'), max_digits=10)),
                ('total_paid', models.DecimalField(decimal_places=2, default=Decimal('15000.00'), max_digits=12)),
                ('is_active', models.BooleanField(db_index=True, default=True)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('center', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='license_packs', to='accounts.centerprofile')),
                ('course', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='center_license_packs', to='courses.course')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='CouponUsage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('discount_applied', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=10)),
                ('coupon', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='usages', to='finance.coupon')),
                ('order', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='finance.order')),
                ('subscription', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='finance.subscription')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='coupon_usages', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='SeatAllocation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_active', models.BooleanField(db_index=True, default=True)),
                ('allocated_at', models.DateTimeField(auto_now_add=True)),
                ('revoked_at', models.DateTimeField(blank=True, null=True)),
                ('activation_code', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='activation_codes.activationcode')),
                ('license_pack', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='allocations', to='finance.bulklicensepack')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='seat_allocations', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-allocated_at'],
            },
        ),
        migrations.AddIndex(
            model_name='bulklicensepack',
            index=models.Index(fields=['center', 'is_active'], name='finance_bul_center__61ba7f_idx'),
        ),
        migrations.AddIndex(
            model_name='couponusage',
            index=models.Index(fields=['coupon', 'user'], name='finance_cou_coupon__87f65f_idx'),
        ),
        migrations.AddIndex(
            model_name='couponusage',
            index=models.Index(fields=['user', 'created_at'], name='finance_cou_user_id_cbe787_idx'),
        ),
        migrations.AddIndex(
            model_name='seatallocation',
            index=models.Index(fields=['license_pack', 'is_active'], name='finance_sea_license_cae834_idx'),
        ),
        migrations.AddIndex(
            model_name='seatallocation',
            index=models.Index(fields=['student', 'is_active'], name='finance_sea_student_447471_idx'),
        ),
    ]
