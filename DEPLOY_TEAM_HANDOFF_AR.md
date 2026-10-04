# تسليم Courssat Academy إلى فريق النشر

## حالة الإصدار

- الفرع المطلوب للنشر: `main`
- Backend focused tests: **24 tests — OK**
- Frontend TypeScript: **PASS**
- Frontend production build: **PASS**
- قاعدة البيانات: Migration `assessments.0014` مضافة وتُطبق آليًا.
- نطاق الإطلاق: Pilot محدود. بث 500 فيديو متزامن يحتاج Video CDN خارجي.

## ملفات التشغيل الأساسية

- `docker-compose.prod.yml`
- `.env.production.example`
- `PRODUCTION_RUNBOOK_AR.md`
- `scripts/setup_server.sh`
- `scripts/init_ssl.sh`
- `scripts/production_preflight.sh`
- `scripts/deploy.sh`
- `scripts/backup_database.sh`
- `scripts/restore_database.sh`

## تجهيز GitHub

إعدادات المستودع المقترحة:

1. اجعل `main` فرعًا محميًا.
2. امنع Force Push وDeletion على `main`.
3. فعّل Pull Request قبل الدمج بعد بدء عمل الفريق.
4. أنشئ GitHub Environment باسم `production` وأضف موافقة يدوية.

الأسرار المطلوبة داخل **Settings → Secrets and variables → Actions**:

| Secret | القيمة |
|---|---|
| `SSH_HOST` | IP أو Hostname الخاص بـKVM4 |
| `SSH_USER` | `deployer` |
| `SSH_PORT` | `22` أو المنفذ المخصص |
| `SSH_PRIVATE_KEY` | المفتاح الخاص المخصص للنشر |

لا تضع `.env.production` أو مفاتيح SSL أو قاعدة البيانات داخل GitHub.

## التجهيز الأول للسيرفر

التجهيز الأول لا يتم من GitHub Actions لأنه يتضمن DNS وSSL:

```bash
sudo APP_USER=deployer APP_DIR=/home/deployer/courssat bash scripts/setup_server.sh
```

بعد تسجيل الدخول مجددًا:

```bash
cd /home/deployer/courssat
cp .env.production.example .env.production
chmod 600 .env.production
# املأ جميع القيم الحقيقية
CERTBOT_EMAIL=ops@example.com bash scripts/init_ssl.sh
ENV_FILE=.env.production bash scripts/production_preflight.sh
SKIP_GIT_PULL=1 APP_DIR=/home/deployer/courssat bash scripts/deploy.sh
```

التفاصيل الكاملة وطريقة توليد الأسرار موجودة في `PRODUCTION_RUNBOOK_AR.md`.

## النشر بعد التجهيز الأول

Workflow النشر **يدوي فقط** لمنع النشر التلقائي قبل إعداد الخادم:

1. افتح GitHub Actions.
2. اختر `Deploy to Production`.
3. اختر `Run workflow` على فرع `main`.
4. الـWorkflow يشغّل Quality Gate أولًا، ثم يتصل بالسيرفر عبر SSH.

## التحقق بعد النشر

```bash
curl -fsS https://api.courssat.online/api/v1/health/readiness/
curl -fsSI https://courssat.online
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker exec courssat-nginx nginx -t
```

نفّذ أيضًا رحلة مدرس/طالب كاملة: فيديو، امتحان، واجب، سؤال مقالي، ونظام فتح الدرس التالي.

## النسخ الاحتياطي

قبل إدخال بيانات حقيقية:

1. جهّز `GPG_PASSPHRASE` خارج المستودع.
2. شغّل `scripts/backup_database.sh --verify`.
3. شغّل استعادة تجريبية باستخدام `scripts/restore_database.sh`.
4. احتفظ بنسخة مشفرة خارج KVM4.
