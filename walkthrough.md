# ملخص الإصلاحات والتسليم

## ما تم إصلاحه

### الامتحانات والواجبات

- إصلاح اختيار **خطأ** كإجابة صحيحة في سؤال صواب/خطأ.
- فرض إجابة صحيحة واحدة فقط للأسئلة الموضوعية.
- حفظ الصعوبة، عدد المحاولات، نسبة النجاح، الحماية، ووقت البداية والنهاية.
- إضافة نوع `ASSIGNMENT` للواجبات بنظام الأسئلة مع Migration رقم `0014`.
- استبدال صفحة الواجبات الوهمية ببيانات فعلية من API وحالات: مطلوب، جاري الحل، بانتظار التصحيح، تم التقييم.
- منع نشر أو بدء تقييم بلا أسئلة.
- تطبيق حد المحاولات على الامتحان والواجب والاختبار.
- عدم إرسال مفاتيح الإجابة الصحيحة للطالب داخل Snapshot المحاولة.
- إبقاء السؤال المقالي بانتظار تصحيح المدرس ثم إعادة حساب النتيجة وفتح الدرس عند النجاح.
- منع الطالب غير المسجل أو صاحب الاشتراك المنتهي من بدء/تسليم تقييم الدورة.

### الدروس والفيديو والصور

- منع تجاوز ترتيب الدروس من كل مسارات الدرس والتقدم ورابط البث.
- توحيد مسار HLS المشترك بين Backend وCelery وNginx.
- توقيع HLS على مستوى مجلد الفيديو حتى تعمل الـPlaylists والSegments.
- تحويل صور الأسئلة إلى WebP والتحقق من الامتداد والحجم.
- منع الـfallback الوهمي للفيديو في الإنتاج عند غياب FFmpeg.
- الإبقاء على HLS المحلي للـPilot الصغير فقط؛ 500 مشاهدة متزامنة تحتاج CDN فعليًا.

### المصادقة والواجهة

- إصلاح مشكلة كلمات المرور التجريبية ذات نطاق `.test`.
- حذف Tokens القديمة عند رفض تسجيل الدخول.
- إصلاح عقود TypeScript المتأثرة في صفحات الامتحان والدروس ولوحات التحكم.
- إصلاح توجيه الأدوار ومسارات المدرس والطالب في الأجزاء التي تم لمسها.

### التشغيل المحلي والإنتاج

- إضافة `docker-compose.local.yml` لتشغيل PostgreSQL وRedis وBackend وFrontend دون تثبيت PostgreSQL أو FFmpeg على Windows.
- إضافة إعداد Django محلي مستقل.
- إصلاح متغيرات اتصال PostgreSQL في `entrypoint.sh`.
- تنظيم تشغيل API وCelery وCelery Video وBeat.
- حماية Redis بكلمة مرور وAOF وسياسة `noeviction`.
- ضبط PostgreSQL وGunicorn بما يلائم بداية KVM4.
- إصلاح مشاركة شهادات Certbot وإقلاع الشهادة الأول.
- إضافة Exporters لـNode/Nginx/Redis/PostgreSQL وتصحيح مسار Prometheus.
- إضافة فحص إنتاج يرفض الأسرار الافتراضية وروابط Redis غير المتطابقة.
- إضافة Backup مشفر وRestore آمن افتراضيًا إلى قاعدة مؤقتة.

## اختبارات تمت إضافتها

- إعدادات الامتحان وصواب/خطأ والصعوبة والسؤال المقالي.
- حفظ الواجب وموعده ونسبة نجاحه.
- منع نشر تقييم فارغ.
- تطبيق حد محاولات الواجب.
- منع بدء وتسليم التقييم بعد انتهاء الاشتراك.
- منع الوصول إلى الدرس المقفول من المسار المباشر والمسار المتداخل داخل الدورة.
- رفع صورة السؤال وتحويلها إلى WebP.

## أوامر التحقق المطلوبة على جهاز المشروع

```powershell
docker compose -f docker-compose.local.yml exec backend python manage.py migrate
docker compose -f docker-compose.local.yml exec backend python manage.py test apps.assessments.test_exam_settings apps.assessments.tests.test_exam_access apps.courses.tests.test_lesson_progression_access apps.courses.tests.test_progression_service
docker compose -f docker-compose.local.yml exec frontend npm ci --include=dev --prefer-offline --no-audit
docker compose -f docker-compose.local.yml exec frontend npm run typecheck
docker compose -f docker-compose.local.yml exec frontend npm run build
```

## نقطة لا يجب تجاوزها

نجاح المنصة محليًا أو نجاح API تحت 500 مستخدم لا يعني أن KVM4 يستطيع بث 500 فيديو HD. إطلاق هذا العدد يتطلب تكامل CDN/Video Provider واختبارًا حقيقيًا عليه. راجع `PRODUCTION_RUNBOOK_AR.md`.
