#!/usr/bin/env bash
# ==============================================================================
# Courssat Academy - Hostinger KVM 4 Server Comprehensive Status & Audit Script
# مسار السكريبت: scripts/server_status_report.sh
# الاستخدام: bash scripts/server_status_report.sh
# ==============================================================================

set -uo pipefail

APP_DIR="${APP_DIR:-/home/deployer/edusmart}"
if [ ! -d "$APP_DIR" ]; then
    APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

REPORT_FILE="${APP_DIR}/server_audit_report_$(date +'%Y%m%d_%H%M%S').md"
LATEST_REPORT="${APP_DIR}/latest_server_report.md"

# الألوان
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_section() {
    echo -e "\n${BLUE}====================================================================${NC}"
    echo -e "${CYAN}>>> $1${NC}"
    echo -e "${BLUE}====================================================================${NC}"
    echo -e "\n## $1\n" >> "$REPORT_FILE"
}

log_info() {
    echo -e "  [${GREEN}✓${NC}] $1"
    echo -e "* **$1**" >> "$REPORT_FILE"
}

log_warn() {
    echo -e "  [${YELLOW}⚠${NC}] $1"
    echo -e "* ⚠️ **$1**" >> "$REPORT_FILE"
}

log_error() {
    echo -e "  [${RED}✗${NC}] $1"
    echo -e "* ❌ **$1**" >> "$REPORT_FILE"
}

log_raw() {
    echo -e "$1"
    echo -e "```\n$1\n```" >> "$REPORT_FILE"
}

# تهيئة ملف التقرير
cat <<EOF > "$REPORT_FILE"
# تقرير الفحص التشخيصي المباشر لسيرفر Courssat Academy (Hostinger KVM 4)
**تاريخ الفحص:** $(date +'%Y-%m-%d %H:%M:%S %Z')
**مسار المشروع:** \`$APP_DIR\`
**الخادم المضيف:** Hostinger VPS (KVM 4 - 4 vCPU / 16 GB RAM)

---
EOF

cd "$APP_DIR" || exit 1

echo -e "${GREEN}بدء الفحص الشامل من داخل السيرفر...${NC}"

# 1. فحص موارد السيرفر (Hostinger KVM 4 Specs)
log_section "1. فحص موارد السيرفر الفيزيائية (Hostinger KVM 4 Resources)"
MEM_TOTAL=$(free -h | awk '/^Mem:/ {print $2}')
MEM_USED=$(free -h | awk '/^Mem:/ {print $3}')
MEM_FREE=$(free -h | awk '/^Mem:/ {print $4}')
SWAP_TOTAL=$(free -h | awk '/^Swap:/ {print $2}')
SWAP_USED=$(free -h | awk '/^Swap:/ {print $3}')
CPU_CORES=$(nproc)
DISK_USAGE=$(df -h / | awk 'NR==2 {print "المساحة الإجمالية: "$2 " | المستخدم: "$3 " ("$5") | المتبقي: "$4}')
LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}')

log_info "الأنوية المتاحة (vCPU): $CPU_CORES أسرّة معالجة"
log_info "الذاكرة العشوائية (RAM): إجمالي $MEM_TOTAL | مستخدم $MEM_USED | متاح $MEM_FREE"
log_info "ذاكرة التبديل (Swap): إجمالي $SWAP_TOTAL | مستخدم $SWAP_USED"
log_info "القرص الصلب السريع (NVMe): $DISK_USAGE"
log_info "متوسط الضغط (Load Average): $LOAD_AVG"

# 2. فحص حالة مستودع الكود (Git & Codebase Status)
log_section "2. حالة الكود والإصدار البرمجي المرفوع (Git Repository State)"
if [ -d ".git" ]; then
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "Unknown")
    LATEST_COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "Unknown")
    LATEST_COMMIT_MSG=$(git log -1 --pretty=%B 2>/dev/null | head -n 1)
    LATEST_COMMIT_DATE=$(git log -1 --pretty=%cd --date=format:'%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "Unknown")
    GIT_DIRTY=$(git status --porcelain 2>/dev/null | wc -l)
    
    log_info "الفرع الحالي (Branch): $CURRENT_BRANCH"
    log_info "رمز آخر Commit: $LATEST_COMMIT_HASH ($LATEST_COMMIT_DATE)"
    log_info "عنوان التعديل الأخير: $LATEST_COMMIT_MSG"
    if [ "$GIT_DIRTY" -eq 0 ]; then
        log_info "شجرة العمل: نظيفة تماماً (Clean Working Tree) - متطابقة مع Git"
    else
        log_warn "توجد $GIT_DIRTY تعديلات محلية غير مؤكدة (Uncommitted changes) على السيرفر"
    fi
else
    log_warn "لم يتم العثور على مجلد .git في مسار المشروع الحالي"
fi

# 3. فحص حالة حاويات Docker والخدمات النشطة
log_section "3. حالة حاويات Docker الحية (Docker Containers Health)"
if command -v docker &> /dev/null; then
    DOCKER_PS=$(docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}")
    log_raw "$DOCKER_PS"
    
    EXPECTED_CONTAINERS=(
        "courssat-nginx"
        "courssat-backend"
        "courssat-frontend"
        "courssat-postgres"
        "courssat-redis"
        "courssat-celery-default"
        "courssat-celery-video"
        "courssat-celery-beat"
    )
    
    for c in "${EXPECTED_CONTAINERS[@]}"; do
        if docker ps --format '{{.Names}}' | grep -q "^${c}$"; then
            HEALTH=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}running{{end}}' "$c" 2>/dev/null || echo "running")
            if [ "$HEALTH" = "healthy" ] || [ "$HEALTH" = "running" ]; then
                log_info "الحاوية $c: شغال بحالة ممتازة ($HEALTH)"
            else
                log_warn "الحاوية $c: تعمل ولكن حالتها الصحية ($HEALTH)"
            fi
        else
            log_error "الحاوية $c: متوقفة أو غير موجودة!"
        fi
    done
else
    log_error "محرك Docker غير مثبت أو تعذر الوصول إليه"
fi

# 4. فحص قاعدة البيانات وترحيلات Django (Database & Migrations State)
log_section "4. فحص قاعدة بيانات PostgreSQL والترحيلات (Django Migrations)"
if docker ps --format '{{.Names}}' | grep -q "courssat-backend"; then
    DB_PING=$(docker exec courssat-backend python -c "
import django; django.setup();
from django.db import connection;
with connection.cursor() as c:
    c.execute('SELECT 1');
print('DB_CONNECTED')
" 2>/dev/null || echo "FAILED")

    if [ "$DB_PING" = "DB_CONNECTED" ]; then
        log_info "الاتصال بقاعدة بيانات PostgreSQL 16: متصل بنجاح 100%"
        
        TABLE_COUNT=$(docker exec courssat-backend python -c "
import django; django.setup();
from django.db import connection;
with connection.cursor() as c:
    c.execute(\"SELECT count(*) FROM information_schema.tables WHERE table_schema='public';\");
    print(c.fetchone()[0])
" 2>/dev/null || echo "0")
        log_info "إجمالي جداول المنصة المنشأة في قاعدة البيانات: $TABLE_COUNT جدول"
        
        UNAPPLIED=$(docker exec courssat-backend python manage.py showmigrations --plan 2>/dev/null | grep '\[ \]' | wc -l || echo "0")
        if [ "$UNAPPLIED" -eq 0 ]; then
            log_info "حالة الترحيلات (Migrations): كافة الترحيلات مطبقة بالكامل (0 Pending)"
        else
            log_warn "تنبيه: يوجد $UNAPPLIED ترحيل مفقود لم يتم تطبيقه بعد!"
        fi
    else
        log_error "فشل الاتصال بقاعدة بيانات PostgreSQL من داخل الباك إند"
    fi
else
    log_error "حاوية courssat-backend متوقفة، تعذر فحص قاعدة البيانات"
fi

# 5. فحص Redis وعمال Celery
log_section "5. فحص وسيط الرسائل Redis وعمال Celery"
if docker ps --format '{{.Names}}' | grep -q "courssat-redis"; then
    REDIS_PING=$(docker exec courssat-redis sh -c 'redis-cli -a "$REDIS_PASSWORD" --no-auth-warning ping' 2>/dev/null || echo "FAIL")
    if [ "$REDIS_PING" = "PONG" ]; then
        REDIS_KEYS=$(docker exec courssat-redis sh -c 'redis-cli -a "$REDIS_PASSWORD" --no-auth-warning dbsize' 2>/dev/null | awk '{print $1}')
        log_info "وسيط Redis 7.2: يعمل بنجاح (PONG) | عدد المفاتيح المخزنة بالكاش: $REDIS_KEYS"
    else
        log_error "فشل استجابة Redis لطلب ping"
    fi
fi

if docker ps --format '{{.Names}}' | grep -q "courssat-backend"; then
    CELERY_PING=$(docker exec courssat-backend celery -A config inspect ping --timeout=3 2>/dev/null || echo "FAIL")
    if echo "$CELERY_PING" | grep -q "pong"; then
        log_info "عمال Celery: يستجيبون للنداء وجاهزون لاستقبال المهام"
        WORKER_NAMES=$(echo "$CELERY_PING" | grep -o 'celery@[^:]*')
        log_info "العمال النشطون: $WORKER_NAMES"
    else
        log_warn "لم يستجب أي من عمال Celery لطلب inspect ping (قد يكونون في وضع السكون أو معزولين)"
    fi
fi

# 6. فحص فيديوهات HLS والتخزين المحلي على السيرفر (Local HLS Video Storage)
log_section "6. تخزين وفيديوهات HLS المحلية (Local Storage - No Bunny Needed)"
HLS_DIR="/var/www/courssat/media/hls"
if [ -d "$HLS_DIR" ]; then
    TOTAL_HLS_SIZE=$(du -sh "$HLS_DIR" 2>/dev/null | awk '{print $1}')
    M3U8_COUNT=$(find "$HLS_DIR" -name "*.m3u8" 2>/dev/null | wc -l)
    TS_COUNT=$(find "$HLS_DIR" -name "*.ts" 2>/dev/null | wc -l)
    log_info "المسار المحلي للفيديوهات: $HLS_DIR"
    log_info "الحجم الكلي المشغول بالفيديوهات المشفرة محلياً: $TOTAL_HLS_SIZE"
    log_info "عدد قوائم تشغيل المقاطع (M3U8 Playlists): $M3U8_COUNT كورس/درس"
    log_info "عدد شرائح الفيديو المشفرة المقطعة (TS Segments): $TS_COUNT شريحة"
else
    HLS_VOL_SIZE=$(docker system df -v 2>/dev/null | grep 'hls-data' | awk '{print $3}' || echo "غير محدد")
    log_info "مجلد الفيديوهات يدار عبر Docker Volume (hls-data) بحجم: $HLS_VOL_SIZE"
fi

# 7. فحص شهادات التشفير SSL وحالة النطاقات
log_section "7. فحص شهادات التشفير SSL وسلامة النطاقات"
DOMAINS=("courssat.online" "api.courssat.online")
for d in "${DOMAINS[@]}"; do
    SSL_EXP=$(echo | openssl s_client -servername "$d" -connect "$d:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2 || echo "FAIL")
    if [ "$SSL_EXP" != "FAIL" ] && [ -n "$SSL_EXP" ]; then
        log_info "شهادة SSL لنطاق $d: صالحة حتى $SSL_EXP"
    else
        log_warn "تعذر التحقق الخارجي من شهادة SSL لنطاق $d (قد يكون الرابط محلياً أو يحتاج لـ DNS)"
    fi
done

# 8. فحص واجهات الفحص السريع (Live HTTP Smoke Tests)
log_section "8. اختبارات الاستجابة الحية (Local HTTP Smoke Tests)"
LOCAL_API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/health/ 2>/dev/null || echo "000")
if [ "$LOCAL_API_HEALTH" = "200" ]; then
    log_info "نقطة فحص صحة الخادم (API Health /api/v1/health/): كود 200 OK"
else
    log_warn "نقطة فحص صحة الخادم أرجعت كود: $LOCAL_API_HEALTH"
fi

LOCAL_FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/ 2>/dev/null || echo "000")
if [ "$LOCAL_FRONTEND" = "200" ]; then
    log_info "واجهة المستخدم (Frontend SPA Port 8080): كود 200 OK"
else
    log_warn "واجهة المستخدم الفرونت إند أرجعت كود: $LOCAL_FRONTEND"
fi

cp "$REPORT_FILE" "$LATEST_REPORT"

echo -e "\n${GREEN}====================================================================${NC}"
echo -e "${GREEN}اكتمل الفحص الشامل بنجاح!${NC}"
echo -e "تم حفظ التقرير الكامل في المسار:"
echo -e "${YELLOW}$REPORT_FILE${NC}"
echo -e "ويمكنك قراءته مباشرة بأمر: ${CYAN}cat $LATEST_REPORT${NC}"
echo -e "${GREEN}====================================================================${NC}"
