# دليل تشغيل Courssat Academy — الإصدار التجريبي

## 1) قرار البنية قبل الرفع

- **Hostinger KVM4** مناسب كبداية لتشغيل Django API وPostgreSQL وRedis والواجهة.
- وضع `VIDEO_STORAGE_ADAPTER=local` مناسب لاختبار محدود فقط، وليس لبث 500 فيديو HD في الوقت نفسه.
- لا تعتبر المنصة جاهزة لـ500 مشاهد فيديو متزامن قبل ربط مزود Video CDN فعلي، ثم تشغيل اختبار ضغط على مسار المشاهدة الحقيقي.
- يمكن إطلاق Pilot صغير لمدة شهر على HLS المحلي مع متابعة CPU وRAM وDisk وBandwidth يوميًا.

## 2) التحقق النهائي محليًا

من PowerShell داخل مجلد المشروع:

```powershell
docker compose -f docker-compose.local.yml up --build -d
docker compose -f docker-compose.local.yml exec backend python manage.py migrate
docker compose -f docker-compose.local.yml exec backend python manage.py test apps.assessments.test_exam_settings apps.assessments.tests.test_exam_access apps.courses.tests.test_lesson_progression_access apps.courses.tests.test_progression_service
docker compose -f docker-compose.local.yml exec frontend npm ci --include=dev --prefer-offline --no-audit
docker compose -f docker-compose.local.yml exec frontend npm run typecheck
docker compose -f docker-compose.local.yml exec frontend npm run build
docker compose -f docker-compose.local.yml ps
```

النتيجة المطلوبة: الاختبارات `OK`، وTypeScript والبناء بلا أخطاء، وكل الخدمات `healthy`.

## 3) تجهيز KVM4

الخادم المقترح: Ubuntu 24.04. نفّذ مرة واحدة:

```bash
sudo APP_USER=deployer APP_DIR=/home/deployer/courssat bash scripts/setup_server.sh
```

سجّل الخروج ثم الدخول لتفعيل مجموعة Docker، وانقل المشروع إلى:

```text
/home/deployer/courssat
```

لا تثبّت PostgreSQL أو Redis أو Nginx على نظام الخادم؛ الخدمات تعمل داخل Docker.

## 4) DNS والشهادة

أنشئ سجلات `A` التالية على IP الخادم:

- `courssat.online`
- `www.courssat.online`
- `api.courssat.online`

بعد انتشار DNS:

```bash
cd /home/deployer/courssat
CERTBOT_EMAIL=YOUR_EMAIL bash scripts/init_ssl.sh
```

يمكن اختبار الشهادة أولًا دون استهلاك حد Let’s Encrypt:

```bash
CERTBOT_EMAIL=YOUR_EMAIL bash scripts/init_ssl.sh --staging
```

بعد نجاح الاختبار احذف شهادة staging من مجلد `infrastructure/nginx/certbot-conf` ثم شغّل الأمر الحقيقي.

## 5) إعداد أسرار الإنتاج

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

ولّد قيمًا URL-safe:

```bash
openssl rand -hex 48   # SECRET_KEY
openssl rand -hex 24   # DB_PASSWORD
openssl rand -hex 24   # REDIS_PASSWORD
openssl rand -hex 32   # NGINX_SECURE_LINK_SECRET
openssl rand -hex 24   # GRAFANA_PASSWORD
openssl rand -hex 32   # NATIONAL_ID_PEPPER
python3 -c "import base64,secrets; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"  # NATIONAL_ID_FERNET_KEYS
```

عدّل `.env.production` ثم:

1. ضع كلمة Redis نفسها داخل `REDIS_URL` و`CELERY_BROKER_URL` و`CELERY_RESULT_BACKEND`.
2. اترك `DEBUG=False`.
3. لا تغيّر `NATIONAL_ID_FERNET_KEYS` بعد بدء إدخال بيانات حقيقية إلا بخطة تدوير مفاتيح.
4. اترك الدفع في وضع الاختبار حتى إدخال مفاتيح Kashier الحقيقية والتحقق من Webhook.
5. للـPilot الصغير:

```dotenv
VIDEO_STORAGE_ADAPTER=local
REQUIRE_VIDEO_CDN=False
```

6. **لا تضبط `REQUIRE_VIDEO_CDN=True`** قبل اكتمال وربط واختبار مزود الفيديو الخارجي.

## 6) فحص الإعداد ثم النشر

```bash
cd /home/deployer/courssat
ENV_FILE=.env.production bash scripts/production_preflight.sh
SKIP_GIT_PULL=1 APP_DIR=/home/deployer/courssat bash scripts/deploy.sh
```

إذا كان المشروع مربوطًا بـGit و`origin/main`، احذف `SKIP_GIT_PULL=1`.

إنشاء أول مدير:

```bash
docker exec -it courssat-backend python manage.py createsuperuser
```

## 7) اختبارات ما بعد الرفع

```bash
curl -fsS https://api.courssat.online/api/v1/health/readiness/
curl -fsSI https://courssat.online
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker exec courssat-nginx nginx -t
```

اختبر يدويًا بحساب مدرس وحساب طالب:

1. إنشاء دورة ووحدة ودرسين.
2. رفع فيديو وانتظار وصوله إلى `ready` ثم تشغيله.
3. إنشاء امتحان صواب/خطأ وتحديد **خطأ** كإجابة صحيحة.
4. إنشاء واجب بنظام الأسئلة مع موعد تسليم ونسبة نجاح.
5. تسجيل الطالب في الدورة.
6. التأكد من منع الدرس التالي قبل اجتياز تقييم الدرس السابق.
7. حل الواجب والامتحان، وتصحيح السؤال المقالي من حساب المدرس.
8. التأكد من تحديث الدرجة وفتح الدرس التالي بعد النجاح.

## 8) النسخ الاحتياطي والاستعادة

أنشئ ملفًا خاصًا لا يقرأه إلا المستخدم:

```bash
cat > /home/deployer/.courssat-backup.env <<'EOF'
DB_NAME=courssat_prod
DB_USER=courssat_admin
DB_PASSWORD=PUT_DB_PASSWORD_HERE
GPG_PASSPHRASE=PUT_A_DIFFERENT_LONG_BACKUP_PASSPHRASE_HERE
EOF
chmod 600 /home/deployer/.courssat-backup.env
```

نسخة مشفرة مع تحقق:

```bash
set -a
source /home/deployer/.courssat-backup.env
set +a
cd /home/deployer/courssat
bash scripts/backup_database.sh --verify
```

اختبار استعادة آمن في قاعدة مؤقتة:

```bash
set -a
source /home/deployer/.courssat-backup.env
set +a
bash scripts/restore_database.sh /home/deployer/backups/courssat/FILE.dump.gpg
```

لا تستخدم `--production --confirm-production` إلا أثناء نافذة صيانة وبعد أخذ Snapshot ونسخة حديثة.

## 9) المراقبة ومعيار Go-Live

لا تفتح PostgreSQL أو Redis أو Grafana مباشرة للإنترنت. المنافذ العامة الوحيدة: `22`, `80`, `443`.

راقب:

- CPU وRAM وDisk.
- HTTP 5xx ووقت استجابة API p95.
- طول Celery queues وفشل المهام.
- أخطاء HLS `403/404`.
- مساحة `media` وPostgreSQL.

معيار إطلاق الـPilot:

- كل Containers سليمة بلا Restart loop.
- رفع الفيديو وتحويله وتشغيله يعمل.
- Backup وRestore تجريبي ناجحان.
- الاختبارات المركزة وTypeScript وBuild ناجحة.
- اختبار ضغط واقعي للـAPI بنسبة أخطاء أقل من 1%.

معيار 500 طالب:

- اختبار API تدريجي حتى 500 مستخدم.
- الفيديو يخرج من CDN/Video Provider فعلي، لا من KVM4.
- اختبار 500 مشاهد على المزود الخارجي مع قياس Bandwidth والأخطاء.
