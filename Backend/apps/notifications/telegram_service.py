import json
import logging
import urllib.parse
import urllib.request
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone

from apps.notifications.models import ParentConsent, ParentReportChannel, ParentReportLog

logger = logging.getLogger(__name__)
UserModel = get_user_model()  # Runtime Django user model; keep annotations unambiguous for mypy.

TELEGRAM_API_BASE = "https://api.telegram.org"


class TelegramService:
    """
    Enterprise Telegram Bot Service for EduSmart Parent Reports & Student Monitoring.
    Bot: @EduSmartAcademyBot
    """

    @classmethod
    def get_token(cls) -> str:
        return getattr(settings, "TELEGRAM_BOT_TOKEN", "8938758076:AAHZBPR9sm9XbseH0lRagFn7mmXZlxG7IHw")

    @classmethod
    def get_bot_username(cls) -> str:
        return getattr(settings, "TELEGRAM_BOT_USERNAME", "EduSmartAcademyBot")

    @classmethod
    def _api_request(cls, endpoint: str, payload: dict[str, Any]) -> dict[str, Any] | None:
        token = cls.get_token()
        url = f"{TELEGRAM_API_BASE}/bot{token}/{endpoint}"
        headers = {
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": "EduSmart-Enterprise-LMS/1.0",
        }

        try:
            req_data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            req = urllib.request.Request(url, data=req_data, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=12) as response:
                res_body = response.read().decode("utf-8")
                res_json = json.loads(res_body)
                if not res_json.get("ok"):
                    logger.error(f"Telegram API error on {endpoint}: {res_json}")
                return res_json
        except Exception as e:
            logger.error(f"Telegram request failed on {endpoint}: {e}", exc_info=True)
            return None

    @classmethod
    def send_message(
        cls,
        chat_id: str,
        text: str,
        reply_markup: dict[str, Any] | None = None,
        parse_mode: str = "HTML",
        disable_web_page_preview: bool = False,
    ) -> bool:
        if not chat_id:
            logger.warning("Attempted to send telegram message without chat_id.")
            return False

        payload: dict[str, Any] = {
            "chat_id": str(chat_id),
            "text": text,
            "parse_mode": parse_mode,
            "disable_web_page_preview": disable_web_page_preview,
        }
        if reply_markup:
            payload["reply_markup"] = reply_markup

        res = cls._api_request("sendMessage", payload)
        return bool(res and res.get("ok"))

    @classmethod
    def answer_callback_query(cls, callback_query_id: str, text: str | None = None) -> bool:
        payload: dict[str, Any] = {"callback_query_id": callback_query_id}
        if text:
            payload["text"] = text
        res = cls._api_request("answerCallbackQuery", payload)
        return bool(res and res.get("ok"))

    @classmethod
    def generate_linking_code(cls, student: Any) -> str:
        consent, _ = ParentConsent.objects.get_or_create(
            student=student,
            defaults={
                "parent_name": f"ولي أمر {student.first_name}",
                "parent_email": student.email,
                "consent_given": True,
            },
        )

        if not consent.linking_code:
            token_part = hex(abs(hash(f"{student.id}-{student.email}-{settings.SECRET_KEY}")))[2:10].upper()
            consent.linking_code = f"EDU{student.id}{token_part}"
            consent.save(update_fields=["linking_code", "updated_at"])

        return consent.linking_code

    @classmethod
    def get_bot_direct_link(cls, student: Any) -> str:
        code = cls.generate_linking_code(student)
        bot_username = cls.get_bot_username()
        return f"https://t.me/{bot_username}?start={code}"

    @classmethod
    def link_parent(
        cls, code_or_identifier: str, chat_id: str, telegram_user: dict[str, Any] | None = None
    ) -> tuple[bool, str, Any | None]:
        clean_code = code_or_identifier.strip().upper()
        consent = ParentConsent.objects.filter(linking_code__iexact=clean_code).select_related("student").first()

        if not consent:
            student = (
                UserModel.objects.filter(
                    Q(email__iexact=code_or_identifier)
                    | Q(national_id=code_or_identifier)
                    | Q(phone=code_or_identifier)
                ).first()
                if hasattr(UserModel, "objects")
                else None
            )

            if student:
                consent, _ = ParentConsent.objects.get_or_create(
                    student=student,
                    defaults={
                        "parent_name": f"ولي أمر {student.first_name}",
                        "parent_email": student.email,
                        "consent_given": True,
                    },
                )

        if not consent:
            return (
                False,
                "❌ لم يتم العثور على طالب بهذا الكود أو المعرّف. يرجى التأكد من كود الربط الموجود في حساب الطالب على منصة EduSmart.",
                None,
            )

        tg_name = ""
        tg_username = ""
        if telegram_user:
            first = telegram_user.get("first_name", "")
            last = telegram_user.get("last_name", "")
            tg_name = f"{first} {last}".strip()
            tg_username = telegram_user.get("username", "")

        consent.telegram_chat_id = str(chat_id)
        if tg_username:
            consent.telegram_username = tg_username
        if tg_name and (not consent.parent_name or consent.parent_name.startswith("ولي أمر")):
            consent.parent_name = tg_name
        consent.consent_given = True
        consent.save(
            update_fields=["telegram_chat_id", "telegram_username", "parent_name", "consent_given", "updated_at"]
        )

        student = consent.student
        success_msg = (
            f"✅ <b>تم ربط الحساب بنجاح!</b>\n\n"
            f"مرحباً بك <b>{consent.parent_name}</b> في بوت تقارير EduSmart.\n"
            f"👤 <b>الطالب المرتبط:</b> {student.first_name} {student.last_name}\n"
            f"📧 <b>البريد:</b> {student.email}\n\n"
            f"ستصلك الآن تقارير المتابعة الأسبوعية وتنبيهات نتائج الاختبارات والإنجازات فور صدورها تلقائياً."
        )
        return True, success_msg, student

    @classmethod
    def unlink_parent(cls, chat_id: str) -> tuple[bool, str]:
        consents = ParentConsent.objects.filter(telegram_chat_id=str(chat_id))
        count = consents.count()
        if count == 0:
            return False, "⚠️ لا يوجد حساب طالب مرتبط بهذا المحادثة حالياً."

        consents.update(telegram_chat_id="", updated_at=timezone.now())
        return True, "✅ تم إلغاء ربط حساب الطالب بهذا المحادثة بنجاح. يمكنك الربط مجدداً في أي وقت بإرسال كود الطالب."

    @classmethod
    def get_student_metrics(cls, student: Any, days: int = 7) -> dict[str, Any]:
        from apps.analytics.models import DailyLearningLog, FocusSession, UserAchievement
        from apps.assessments.models import StudentExam
        from apps.enrollments.models import Enrollment

        since_date = timezone.now() - timedelta(days=days)
        since_date_only = since_date.date()

        enrollments = Enrollment.objects.filter(student=student).select_related("course")
        courses_data = []
        for en in enrollments:
            total_lessons = en.course.lesson_count
            completed_lessons = en.lesson_completions.count()
            progress = round((completed_lessons / total_lessons) * 100, 1) if total_lessons else 0
            status = "completed" if en.completed_at or progress >= 100 else "in_progress"
            courses_data.append(
                {
                    "title": en.course.title,
                    "progress": progress,
                    "status": status,
                    "is_completed": status == "completed",
                }
            )

        learning_logs = DailyLearningLog.objects.filter(user=student, date__gte=since_date_only)
        total_minutes = sum(log.minutes_spent for log in learning_logs)
        lessons_completed_count = sum(log.lessons_completed for log in learning_logs)
        quizzes_submitted_count = sum(log.quizzes_submitted for log in learning_logs)

        focus_sessions = FocusSession.objects.filter(student=student, start_time__gte=since_date)
        focus_count = focus_sessions.count()
        avg_focus_score = 0
        if focus_count > 0:
            avg_focus_score = round(sum(f.focus_score for f in focus_sessions) / focus_count)

        streak = 0
        from apps.accounts.models import StudentProfile

        profile = StudentProfile.objects.filter(user=student).first()
        if profile:
            streak = profile.study_streak

        recent_exams_qs = (
            StudentExam.objects.filter(student=student, created_at__gte=since_date)
            .select_related("exam", "exam__course")
            .order_by("-created_at")
        )

        if not recent_exams_qs.exists():
            recent_exams_qs = (
                StudentExam.objects.filter(student=student)
                .select_related("exam", "exam__course")
                .order_by("-created_at")[:3]
            )

        exams_data = []
        for se in recent_exams_qs:
            max_s = float(se.exam.max_score or 100)
            score_f = float(se.score or 0)
            pct = round((score_f / max_s) * 100, 1) if max_s > 0 else 0
            exams_data.append(
                {
                    "exam_title": se.exam.title,
                    "course_title": se.exam.course.title if se.exam.course else "عام",
                    "score": score_f,
                    "max_score": max_s,
                    "percentage": pct,
                    "status": se.status,
                    "date": se.created_at.strftime("%Y-%m-%d"),
                }
            )

        new_badges = UserAchievement.objects.filter(user=student, unlocked_at__gte=since_date).select_related("badge")
        badges_list = [b.badge.title for b in new_badges]

        rating = "ممتاز 🌟"
        if total_minutes < 60 and focus_count == 0:
            rating = "يحتاج تشجيع ومتابعة ⚠️"
        elif total_minutes < 180:
            rating = "جيد 👍"

        hours = total_minutes // 60
        mins = total_minutes % 60
        time_formatted = f"{hours} ساعة و {mins} دقيقة" if hours > 0 else f"{mins} دقيقة"

        return {
            "period_days": days,
            "courses": courses_data,
            "total_courses": len(courses_data),
            "total_minutes": total_minutes,
            "time_formatted": time_formatted,
            "lessons_completed_count": lessons_completed_count,
            "quizzes_submitted_count": quizzes_submitted_count,
            "focus_count": focus_count,
            "avg_focus_score": avg_focus_score,
            "streak": streak,
            "exams": exams_data,
            "badges": badges_list,
            "rating": rating,
        }

    @classmethod
    def format_weekly_report(cls, student: Any, parent_name: str = "") -> tuple[str, dict[str, Any]]:
        metrics = cls.get_student_metrics(student, days=7)
        greeting_name = parent_name or f"ولي أمر {student.first_name}"

        lines = [
            "🎓 <b>EduSmart | تقرير الأداء والمتابعة الأسبوعي</b> 📊",
            "━━━━━━━━━━━━━━━━━━━━━",
            f"مرحباً بك أ/ <b>{greeting_name}</b>،",
            f"إليك ملخص أداء ونشاط الطالب: <b>{student.first_name} {student.last_name}</b> خلال الأسبوع الماضي:\n",
            "📚 <b>التقدم الأكاديمي والكورسات:</b>",
        ]

        if metrics["courses"]:
            for c in metrics["courses"][:3]:
                check = "✅" if c["is_completed"] else "📖"
                lines.append(f"  • {check} <b>{c['title']}</b> — إنجاز: <code>{c['progress']}%</code>")
            if len(metrics["courses"]) > 3:
                lines.append(f"  <i>+ {len(metrics['courses']) - 3} دورات أخرى مسجل بها</i>")
        else:
            lines.append("  • لا توجد دورات مسجلة حالياً.")

        lines.extend(
            [
                "",
                "⏱️ <b>نشاط ووقت المذاكرة:</b>",
                f"  • إجمالي وقت المذاكرة: <b>{metrics['time_formatted']}</b>",
                f"  • الدروس المكتملة هذا الأسبوع: <b>{metrics['lessons_completed_count']} درس</b>",
                f"  • أيام الالتزام المتتالي (Streak): 🔥 <b>{metrics['streak']} أيام</b>",
                f"  • جلسات التركيز المنجزة: <b>{metrics['focus_count']} جلسة</b> (معدل تركيز: {metrics['avg_focus_score']}%)",
            ]
        )
        lines.extend(["", "📝 <b>الاختبارات والتقييمات الأخيرة:</b>"])
        if metrics["exams"]:
            for ex in metrics["exams"][:3]:
                score_badge = "🟢" if ex["percentage"] >= 85 else ("🟡" if ex["percentage"] >= 65 else "🔴")
                lines.append(
                    f"  • {score_badge} <b>{ex['exam_title']}</b> ({ex['course_title']})\n"
                    f"     الدرجة: <b>{ex['score']}/{ex['max_score']}</b> (<code>{ex['percentage']}%</code>) — {ex['date']}"
                )
        else:
            lines.append("  • لم يتم خوض اختبارات جديدة هذا الأسبوع.")

        if metrics["badges"]:
            lines.extend(["", "🏆 <b>الأوسمة والإنجازات الجديدة:</b>", "  • 🎉 تم الحصول على: " + ", ".join(metrics["badges"])])

        lines.extend(
            [
                "",
                f"💡 <b>التقييم التربوي العام:</b> {metrics['rating']}",
                "━━━━━━━━━━━━━━━━━━━━━",
                "<i>EduSmart Academy — معاً لمستقبل تعليمي رائد 🚀</i>",
            ]
        )

        text = "\n".join(lines)
        reply_markup = {
            "inline_keyboard": [
                [
                    {"text": "🔄 تحديث التقرير", "callback_data": f"cb_report_{student.id}"},
                    {"text": "📝 كشف الاختبارات", "callback_data": f"cb_exams_{student.id}"},
                ],
                [
                    {"text": "⏱️ سجل التركيز", "callback_data": f"cb_time_{student.id}"},
                    {
                        "text": "🌐 منصة Courssat",
                        "url": getattr(settings, "FRONTEND_URL", "https://courssat.online" if not getattr(settings, "DEBUG", True) else "http://localhost:8080").rstrip("/"),
                    },
                ],
            ]
        }
        return text, reply_markup

    @classmethod
    def format_exams_summary(cls, student: Any) -> tuple[str, dict[str, Any]]:
        from apps.assessments.models import StudentExam

        exams = (
            StudentExam.objects.filter(student=student)
            .select_related("exam", "exam__course")
            .order_by("-created_at")[:8]
        )

        lines = [
            f"📝 <b>كشف درجات واختبارات الطالب: {student.first_name} {student.last_name}</b>",
            "━━━━━━━━━━━━━━━━━━━━━",
        ]
        if not exams:
            lines.append("لا توجد سجلات اختبارات مسجلة حتى الآن.")
        else:
            for i, se in enumerate(exams, 1):
                max_s = float(se.exam.max_score or 100)
                score_f = float(se.score or 0)
                pct = round((score_f / max_s) * 100, 1) if max_s > 0 else 0
                badge = "🟢 ممتاز" if pct >= 85 else ("🟡 جيد" if pct >= 65 else "🔴 يحتاج دعم")
                lines.append(
                    f"<b>{i}. {se.exam.title}</b>\n"
                    f"  📚 المادة: {se.exam.course.title if se.exam.course else 'عام'}\n"
                    f"  🎯 النتيجة: <b>{score_f} / {max_s}</b> (<code>{pct}%</code>) — {badge}\n"
                    f"  📅 التاريخ: {se.created_at.strftime('%Y-%m-%d %I:%M %p')}\n"
                )

        lines.append("━━━━━━━━━━━━━━━━━━━━━")
        text = "\n".join(lines)
        reply_markup = {"inline_keyboard": [[{"text": "📊 التقرير العام", "callback_data": f"cb_report_{student.id}"}]]}
        return text, reply_markup

    @classmethod
    def format_time_summary(cls, student: Any) -> tuple[str, dict[str, Any]]:
        metrics = cls.get_student_metrics(student, days=7)
        lines = [
            f"⏱️ <b>نشاط ووقت تعلم الطالب: {student.first_name} {student.last_name}</b>",
            "━━━━━━━━━━━━━━━━━━━━━",
            f"• إجمالي وقت الدراسة (آخر ٧ أيام): <b>{metrics['time_formatted']}</b>",
            f"• الدروس المكتملة: <b>{metrics['lessons_completed_count']} درس</b>",
            f"• التمارين والواجبات: <b>{metrics['quizzes_submitted_count']} تمرين</b>",
            f"• سلسلة الالتزام اليومي: 🔥 <b>{metrics['streak']} أيام متتالية</b>",
            f"• جلسات التركيز (Pomodoro): <b>{metrics['focus_count']} جلسة</b>",
            f"• متوسط جودة التركيز: <b>{metrics['avg_focus_score']}%</b>",
            "━━━━━━━━━━━━━━━━━━━━━",
        ]
        text = "\n".join(lines)
        reply_markup = {"inline_keyboard": [[{"text": "📊 التقرير العام", "callback_data": f"cb_report_{student.id}"}]]}
        return text, reply_markup

    @classmethod
    def send_exam_graded_alert(cls, student_exam_id: int) -> bool:
        from apps.assessments.models import StudentExam

        try:
            se = StudentExam.objects.select_related("student", "exam", "exam__course").get(pk=student_exam_id)
        except StudentExam.DoesNotExist:
            logger.error(f"StudentExam #{student_exam_id} not found for telegram alert.")
            return False

        consent = ParentConsent.objects.filter(student=se.student, consent_given=True).first()
        if not consent or not consent.telegram_chat_id:
            logger.info(f"No linked telegram chat for student {se.student.id} to send exam alert.")
            return False

        max_s = float(se.exam.max_score or 100)
        score_f = float(se.score or 0)
        pct = round((score_f / max_s) * 100, 1) if max_s > 0 else 0
        eval_text = "ممتاز جداً 🌟" if pct >= 90 else ("جيد جداً 👍" if pct >= 75 else "يحتاج مراجعة 📚")

        msg = (
            f"🔔 <b>تنبيه نتيجة اختبار جديدة!</b> 📝\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"مرحباً <b>{consent.parent_name}</b>،\n"
            f"تم رصد نتيجة اختبار للطالب: <b>{se.student.first_name} {se.student.last_name}</b>:\n\n"
            f"📝 <b>اسم الاختبار:</b> {se.exam.title}\n"
            f"📚 <b>المادة / الدورة:</b> {se.exam.course.title if se.exam.course else 'عام'}\n"
            f"🎯 <b>الدرجة المحصلة:</b> <b>{score_f} / {max_s}</b> (<code>{pct}%</code>)\n"
            f"📊 <b>التقييم:</b> {eval_text}\n"
            f"⏰ <b>تاريخ التسليم:</b> {se.created_at.strftime('%Y-%m-%d %I:%M %p')}\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"<i>EduSmart Academy — متابعة مستمرة لتحقيق التفوق 🎓</i>"
        )

        reply_markup = {"inline_keyboard": [[{"text": "📊 عرض التقرير الشامل", "callback_data": f"cb_report_{se.student.id}"}]]}
        sent = cls.send_message(consent.telegram_chat_id, msg, reply_markup=reply_markup)
        if sent:
            ParentReportLog.objects.create(
                student=se.student,
                sent_by=se.student,
                channel=ParentReportChannel.TELEGRAM,
                report_data_json={"event": "exam_graded", "exam_id": se.exam.id, "score": score_f, "percentage": pct},
                status="SENT",
            )
        return sent

    @classmethod
    def send_certificate_earned_alert(cls, certificate_id: int) -> bool:
        from apps.certificates.models import Certificate

        try:
            cert = Certificate.objects.select_related("student", "course").get(pk=certificate_id)
        except Exception:
            logger.error(f"Certificate #{certificate_id} not found for telegram alert.")
            return False

        consent = ParentConsent.objects.filter(student=cert.student, consent_given=True).first()
        if not consent or not consent.telegram_chat_id:
            return False

        msg = (
            f"🎉 <b>تهانينا! تم إتمام دورة تدريبية بنجاح 🎓</b>\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"مرحباً <b>{consent.parent_name}</b>،\n"
            f"يسعدنا إبلاغكم بأن الطالب <b>{cert.student.first_name} {cert.student.last_name}</b> قد أتم بنجاح ١٠٠٪ من متطلبات دورة:\n\n"
            f"🌟 <b>{cert.course.title}</b>\n"
            f"📜 <b>رقم الشهادة:</b> <code>{cert.serial}</code>\n"
            f"📅 <b>تاريخ الإصدار:</b> {cert.issued_at.strftime('%Y-%m-%d')}\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"فخورون بإنجاز وتميز الطالب ونتمنى له دوام التوفيق! 🚀"
        )

        frontend_url = getattr(settings, "FRONTEND_URL", "https://courssat.online" if not getattr(settings, "DEBUG", True) else "http://localhost:8080").rstrip("/")
        reply_markup = {
            "inline_keyboard": [
                [{"text": "📜 التحقق من الشهادة", "url": f"{frontend_url}/verify-certificate?serial={cert.serial}"}],
                [{"text": "📊 التقرير الكامل", "callback_data": f"cb_report_{cert.student.id}"}],
            ]
        }

        sent = cls.send_message(consent.telegram_chat_id, msg, reply_markup=reply_markup)
        if sent:
            ParentReportLog.objects.create(
                student=cert.student,
                sent_by=cert.student,
                channel=ParentReportChannel.TELEGRAM,
                report_data_json={"event": "certificate_issued", "serial": cert.serial, "course": cert.course.title},
                status="SENT",
            )
        return sent

    @classmethod
    def handle_webhook_update(cls, update: dict[str, Any]) -> None:
        if "callback_query" in update:
            cb = update["callback_query"]
            cb_id = cb.get("id")
            data = cb.get("data", "")
            from_user = cb.get("from", {})
            chat_id = str(from_user.get("id", ""))

            cls.answer_callback_query(cb_id)

            if data.startswith("cb_report_"):
                student_id = data.replace("cb_report_", "")
                student = UserModel.objects.filter(pk=student_id).first()
                if student:
                    consent = ParentConsent.objects.filter(student=student, telegram_chat_id=chat_id).first()
                    parent_name = consent.parent_name if consent else ""
                    text, markup = cls.format_weekly_report(student, parent_name)
                    cls.send_message(chat_id, text, reply_markup=markup)
            elif data.startswith("cb_exams_"):
                student_id = data.replace("cb_exams_", "")
                student = UserModel.objects.filter(pk=student_id).first()
                if student:
                    text, markup = cls.format_exams_summary(student)
                    cls.send_message(chat_id, text, reply_markup=markup)
            elif data.startswith("cb_time_"):
                student_id = data.replace("cb_time_", "")
                student = UserModel.objects.filter(pk=student_id).first()
                if student:
                    text, markup = cls.format_time_summary(student)
                    cls.send_message(chat_id, text, reply_markup=markup)
            return

        if "message" in update:
            msg = update["message"]
            chat = msg.get("chat", {})
            chat_id = str(chat.get("id", ""))
            text = (msg.get("text") or "").strip()
            from_user = msg.get("from", {})

            if not text:
                return

            if text.startswith("/start"):
                parts = text.split()
                if len(parts) > 1:
                    code = parts[1]
                    success, response_msg, student = cls.link_parent(code, chat_id, from_user)
                    if success and student:
                        cls.send_message(chat_id, response_msg)
                        report_text, markup = cls.format_weekly_report(student, from_user.get("first_name", ""))
                        cls.send_message(chat_id, report_text, reply_markup=markup)
                        return
                    cls.send_message(chat_id, response_msg)
                    return
                consent = (
                    ParentConsent.objects.filter(telegram_chat_id=chat_id, consent_given=True)
                    .select_related("student")
                    .first()
                )
                if consent:
                    welcome_msg = (
                        f"مرحباً بك مجدداً أ/ <b>{consent.parent_name}</b> 👋\n\n"
                        f"أنت مرتبط حالياً بحساب الطالب: <b>{consent.student.first_name} {consent.student.last_name}</b>.\n"
                        f"اختر من القائمة أدناه لعرض أحدث تقارير المتابعة والدرجات:"
                    )
                    report_text, markup = cls.format_weekly_report(consent.student, consent.parent_name)
                    cls.send_message(chat_id, welcome_msg)
                    cls.send_message(chat_id, report_text, reply_markup=markup)
                else:
                    help_msg = (
                        "👋 <b>أهلاً بك في بوت تقارير ومتابعة EduSmart!</b> 🎓\n\n"
                        "هذا البوت مخصص لأولياء الأمور لمتابعة المستوى الدراسي للطالب واستلام التقارير الدورية وتنبيهات الاختبارات.\n\n"
                        "🔗 <b>لربط حساب ابنك الطالب:</b>\n"
                        "يرجى إرسال كود الربط الخاص بالطالب (الموجود في صفحة إعدادات حسابه على المنصة) أو كتابة الأمر:\n"
                        "<code>/link &lt;كود_الطالب&gt;</code>\n\n"
                        "💡 <i>مثال: <code>/link EDU123ABC</code></i>"
                    )
                    cls.send_message(chat_id, help_msg)
                return

            if text.startswith("/link"):
                parts = text.split(maxsplit=1)
                if len(parts) > 1:
                    code = parts[1]
                    success, response_msg, student = cls.link_parent(code, chat_id, from_user)
                    cls.send_message(chat_id, response_msg)
                    if success and student:
                        report_text, markup = cls.format_weekly_report(student, from_user.get("first_name", ""))
                        cls.send_message(chat_id, report_text, reply_markup=markup)
                else:
                    cls.send_message(chat_id, "⚠️ يرجى كتابة كود الربط بعد الأمر. مثال:\n<code>/link EDU123ABC</code>")
                return

            consent = (
                ParentConsent.objects.filter(telegram_chat_id=chat_id, consent_given=True)
                .select_related("student")
                .first()
            )
            if not consent:
                if not text.startswith("/"):
                    success, response_msg, student = cls.link_parent(text, chat_id, from_user)
                    cls.send_message(chat_id, response_msg)
                    if success and student:
                        report_text, markup = cls.format_weekly_report(student, from_user.get("first_name", ""))
                        cls.send_message(chat_id, report_text, reply_markup=markup)
                    return
                cls.send_message(chat_id, "⚠️ لا يوجد طالب مرتبط بهذا المحادثة. يرجى إرسال كود الربط الخاص بالطالب للبدء.")
                return

            student = consent.student
            if text in ["/report", "/status", "تقرير", "التقرير"]:
                report_text, markup = cls.format_weekly_report(student, consent.parent_name)
                cls.send_message(chat_id, report_text, reply_markup=markup)
                return
            if text in ["/exams", "/grades", "اختبارات", "الدرجات"]:
                exams_text, markup = cls.format_exams_summary(student)
                cls.send_message(chat_id, exams_text, reply_markup=markup)
                return
            if text in ["/time", "/activity", "وقت المذاكرة", "النشاط"]:
                time_text, markup = cls.format_time_summary(student)
                cls.send_message(chat_id, time_text, reply_markup=markup)
                return
            if text in ["/unlink", "الغاء الربط"]:
                _, unlink_msg = cls.unlink_parent(chat_id)
                cls.send_message(chat_id, unlink_msg)
                return
            if text in ["/help", "مساعدة"]:
                help_text = (
                    "📖 <b>قائمة أوامر بوت EduSmart لولي الأمر:</b>\n\n"
                    "• <code>/report</code> — عرض تقرير المتابعة الشامل والمحدث.\n"
                    "• <code>/exams</code> — كشف درجات ونتائج الاختبارات والواجبات.\n"
                    "• <code>/time</code> — ملخص ساعات المذاكرة وجلسات التركيز.\n"
                    "• <code>/unlink</code> — إلغاء ربط الحساب الحالي.\n"
                    "• <code>/help</code> — عرض هذه المساعدة."
                )
                cls.send_message(chat_id, help_text)
                return

            cls.send_message(
                chat_id,
                f"أهلاً بك <b>{consent.parent_name}</b>! يمكنك استخدام الأزرار أدناه أو كتابة <code>/report</code> لعرض تقرير مستوى الطالب.",
                reply_markup={
                    "inline_keyboard": [
                        [{"text": "📊 عرض التقرير الشامل", "callback_data": f"cb_report_{student.id}"}],
                        [{"text": "📝 نتائج الاختبارات", "callback_data": f"cb_exams_{student.id}"}],
                    ]
                },
            )
