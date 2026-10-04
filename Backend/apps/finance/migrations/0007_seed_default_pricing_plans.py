from decimal import Decimal
from django.db import migrations


def seed_default_plans(apps, schema_editor):
    PricingPlan = apps.get_model("finance", "PricingPlan")
    PlanFeature = apps.get_model("finance", "PlanFeature")

    plans_data = [
        {
            "name": "الخطة الأساسية",
            "slug": "basic",
            "description": "للمتعلمين المبتدئين والباحثين عن التعلم الذاتي",
            "price_monthly": Decimal("199.00"),
            "price_yearly": Decimal("1990.00"),
            "currency": "EGP",
            "is_featured": False,
            "is_active": True,
            "trial_days": 7,
            "order": 1,
            "features": [
                {"label": "الوصول إلى 50+ دورة تعليمية", "is_included": True, "order": 1},
                {"label": "مشاهدة المحتوى غير المحدود", "is_included": True, "order": 2},
                {"label": "تنزيل المحتوى للمشاهدة دون اتصال", "is_included": True, "order": 3},
                {"label": "شهادات إتمام معتمدة", "is_included": True, "order": 4},
                {"label": "دعم بالبريد الإلكتروني", "is_included": True, "order": 5},
            ],
        },
        {
            "name": "الخطة الاحترافية (باقة المعلم)",
            "slug": "teacher-pro",
            "description": "للمعلمين وصناع المحتوى الذين يبحثون عن استوديو تعليمي متكامل",
            "price_monthly": Decimal("1200.00"),
            "price_yearly": Decimal("11520.00"),
            "currency": "EGP",
            "is_featured": True,
            "is_active": True,
            "trial_days": 14,
            "order": 2,
            "features": [
                {"label": "رفع غير محدود للفيديوهات المشفرة بجودة عالية", "is_included": True, "order": 1},
                {"label": "بنك أسئلة ذكي واستوديو اختبارات تصحيح آلي", "is_included": True, "order": 2},
                {"label": "جلسات بث مباشر مدمجة وتقارير أولياء الأمور", "is_included": True, "order": 3},
                {"label": "نظام أكواد التفعيل وتوليد بطاقات PDF بالـ PIN", "is_included": True, "order": 4},
                {"label": "سحب أرباح مباشر عبر إنستاباي والمحافظ البنكية", "is_included": True, "order": 5},
                {"label": "دعم فني مخصص 24/7", "is_included": True, "order": 6},
            ],
        },
        {
            "name": "باقة المراكز والمؤسسات (Center Plan)",
            "slug": "center-enterprise",
            "description": "حلول متكاملة للسناتر التعليمية والمؤسسات لإدارة حتى 100 طالب",
            "price_monthly": Decimal("3000.00"),
            "price_yearly": Decimal("28800.00"),
            "currency": "EGP",
            "is_featured": False,
            "is_active": True,
            "trial_days": 30,
            "order": 3,
            "features": [
                {"label": "ترخيص 100 مقعد طالب وحصص تفعيل مجمعة", "is_included": True, "order": 1},
                {"label": "لوحة تحكم إدارية ومساعدين للمعلمين والمحاضرين", "is_included": True, "order": 2},
                {"label": "حضور وغياب عبر QR Code وإيصالات دفع موثقة", "is_included": True, "order": 3},
                {"label": "تحليلات تقدم الطلاب واختبارات قياس المستوى", "is_included": True, "order": 4},
                {"label": "مدير حساب مخصص وتدريب لفريق العمل", "is_included": True, "order": 5},
            ],
        },
    ]

    for p_data in plans_data:
        features = p_data.pop("features")
        plan, created = PricingPlan.objects.get_or_create(
            slug=p_data["slug"],
            defaults=p_data,
        )
        if not created:
            for k, v in p_data.items():
                setattr(plan, k, v)
            plan.save()

        # Update or create features
        plan.features.all().delete()
        for f in features:
            PlanFeature.objects.create(
                plan=plan,
                label=f["label"],
                is_included=f["is_included"],
                order=f["order"],
            )


def reverse_seed_default_plans(apps, schema_editor):
    PricingPlan = apps.get_model("finance", "PricingPlan")
    PricingPlan.objects.filter(slug__in=["basic", "teacher-pro", "center-enterprise"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0006_couponusage_bulklicensepack_seatallocation'),
    ]

    operations = [
        migrations.RunPython(seed_default_plans, reverse_seed_default_plans),
    ]
