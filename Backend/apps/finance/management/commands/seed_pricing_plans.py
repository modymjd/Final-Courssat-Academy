from django.core.management.base import BaseCommand

from apps.finance.models import PlanFeature, PricingPlan


class Command(BaseCommand):
    help = "Seeds default EduSmart / NervaX Tech pricing plans and features"

    def handle(self, *args, **options):
        self.stdout.write("Seeding default pricing plans...")

        # Plan 1: Basic
        basic, _ = PricingPlan.objects.get_or_create(
            slug="basic",
            defaults={
                "name": "الخطة الأساسية",
                "description": "للمتعلمين المبتدئين والباحثين عن التعلم الذاتي",
                "price_monthly": 199.00,
                "price_yearly": 1990.00,
                "currency": "EGP",
                "is_featured": False,
                "is_active": True,
                "trial_days": 7,
                "order": 1,
            },
        )
        basic_features = [
            "الوصول إلى 50+ دورة تعليمية",
            "مشاهدة المحتوى غير المحدود",
            "تنزيل المحتوى للمشاهدة دون اتصال",
            "شهادات إتمام معتمدة",
            "دعم بالبريد الإلكتروني",
        ]
        for idx, feat in enumerate(basic_features, 1):
            PlanFeature.objects.get_or_create(plan=basic, label=feat, defaults={"is_included": True, "order": idx})

        # Plan 2: Pro (Featured)
        pro, _ = PricingPlan.objects.get_or_create(
            slug="pro",
            defaults={
                "name": "الخطة الاحترافية",
                "description": "للمتعلمين الجادين الذين يبحثون عن تجربة تعليمية كاملة وشهادات متقدمة",
                "price_monthly": 399.00,
                "price_yearly": 3830.00,
                "currency": "EGP",
                "is_featured": True,
                "is_active": True,
                "trial_days": 14,
                "order": 2,
            },
        )
        pro_features = [
            "الوصول الكلي لـ 200+ دورة تعليمية",
            "بطاقات التكرار المتباعد الذكية",
            "مؤقت البومودورو المدمج والتحليلات",
            "جلسات مباشرة أسبوعية مع الخبراء",
            "مشاريع عملية مراجعة من المهندسين",
            "شهادات إتمام موثقة برقم مرجعي",
            "دعم فني مخصص 24/7",
        ]
        for idx, feat in enumerate(pro_features, 1):
            PlanFeature.objects.get_or_create(plan=pro, label=feat, defaults={"is_included": True, "order": idx})

        # Plan 3: Enterprise
        enterprise, _ = PricingPlan.objects.get_or_create(
            slug="enterprise",
            defaults={
                "name": "خطة المؤسسات والشركات",
                "description": "حلول متكاملة للمدارس والجامعات والشركات لتدريب منسوبيها",
                "price_monthly": 999.00,
                "price_yearly": 9590.00,
                "currency": "EGP",
                "is_featured": False,
                "is_active": True,
                "trial_days": 30,
                "order": 3,
            },
        )
        enterprise_features = [
            "وصول شامل لجميع دورات المنصة",
            "لوحة تحكم خاصة لإدارة الموظفين والطلاب",
            "تقارير تقدم وأداء تفصيلية (B2B E-Invoice)",
            "تخصيص المسارات التعليمية حسب الطلب",
            "مدير حساب مخصص وتدريب للفرق",
            "ربط مباشر عبر API للمؤسسات",
        ]
        for idx, feat in enumerate(enterprise_features, 1):
            PlanFeature.objects.get_or_create(plan=enterprise, label=feat, defaults={"is_included": True, "order": idx})

        self.stdout.write(self.style.SUCCESS("Successfully seeded default pricing plans and features."))
