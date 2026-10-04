Courssat Academy - Local Docker
================================

المتطلبات:
- Docker Desktop يعمل بنظام Linux containers.
- لا تحتاج إلى تثبيت PostgreSQL أو Redis أو FFmpeg على Windows.

التشغيل الأول من PowerShell داخل مجلد المشروع:

  docker compose -f docker-compose.local.yml down
  docker compose -f docker-compose.local.yml up --build -d
  docker compose -f docker-compose.local.yml ps

الروابط:
- Frontend: http://localhost:8080
- Swagger:  http://localhost:8000/api/docs/
- Admin:    http://localhost:8000/admin/

إنشاء حساب إدارة:

  docker compose -f docker-compose.local.yml exec backend python manage.py createsuperuser

تطبيق Migrations بعد استلام تحديث:

  docker compose -f docker-compose.local.yml exec backend python manage.py migrate

تشغيل الاختبارات المركزة:

  docker compose -f docker-compose.local.yml exec backend python manage.py test apps.assessments.test_exam_settings apps.assessments.tests.test_exam_access apps.courses.tests.test_lesson_progression_access apps.courses.tests.test_progression_service

فحص الواجهة:

  docker compose -f docker-compose.local.yml exec frontend npm ci --include=dev --prefer-offline --no-audit
  docker compose -f docker-compose.local.yml exec frontend npm run typecheck
  docker compose -f docker-compose.local.yml exec frontend npm run build

السجلات:

  docker compose -f docker-compose.local.yml logs backend --tail 200
  docker compose -f docker-compose.local.yml logs frontend --tail 200

إعادة التشغيل دون حذف البيانات:

  docker compose -f docker-compose.local.yml restart backend frontend

حذف البيئة بالكامل، بما فيها قاعدة البيانات المحلية:

  docker compose -f docker-compose.local.yml down -v

تنبيه: لا تستخدم down -v إذا كنت تريد الاحتفاظ بالبيانات.
