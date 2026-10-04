from django.core.management.base import BaseCommand

from apps.courses.models import Lesson


def parse_duration_string(val: str) -> int:
    if not val:
        return 0
    val = val.strip()
    if ":" in val:
        parts = val.split(":")
        try:
            if len(parts) == 2:
                return int(parts[0]) * 60 + int(parts[1])
            elif len(parts) == 3:
                return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        except ValueError:
            return 0
    try:
        return int(float(val))
    except ValueError:
        return 0


def format_seconds_to_mmss(total_seconds: int) -> str:
    m = total_seconds // 60
    s = total_seconds % 60
    return f"{m:02d}:{s:02d}"


class Command(BaseCommand):
    help = "Audits lesson durations against actual video asset duration_seconds and reports discrepancies."

    def add_arguments(self, parser):
        parser.add_argument(
            "--fix",
            action="store_true",
            help="Automatically sync lesson.duration string to match video.duration_seconds when available.",
        )

    def handle(self, *args, **options):
        should_fix = options.get("fix", False)
        lessons = Lesson.objects.select_related("video", "module__course").all()

        total = lessons.count()
        video_lessons = 0
        discrepancies = []
        missing_duration = []

        self.stdout.write(self.style.NOTICE(f"Scanning {total} lessons in database...\n"))

        for lesson in lessons:
            if lesson.type != "video":
                continue
            video_lessons += 1
            stored_parsed = parse_duration_string(lesson.duration)
            video_actual = lesson.video.duration_seconds if (lesson.video and lesson.video.duration_seconds) else 0

            if not video_actual and not stored_parsed:
                missing_duration.append({
                    "id": lesson.id,
                    "title": lesson.title,
                    "course": lesson.module.course.title,
                    "reason": "Both lesson.duration and video.duration_seconds are 0 or missing",
                })
            elif video_actual > 0 and stored_parsed > 0 and abs(video_actual - stored_parsed) > 5:
                discrepancies.append({
                    "id": lesson.id,
                    "title": lesson.title,
                    "course": lesson.module.course.title,
                    "stored": lesson.duration,
                    "stored_seconds": stored_parsed,
                    "video_seconds": video_actual,
                    "diff": stored_parsed - video_actual,
                })
                if should_fix:
                    lesson.duration = format_seconds_to_mmss(video_actual)
                    lesson.save(update_fields=["duration"])

        self.stdout.write(self.style.SUCCESS(f"Total video lessons: {video_lessons}"))
        self.stdout.write(self.style.SUCCESS(f"Total discrepancies found: {len(discrepancies)}"))
        self.stdout.write(self.style.WARNING(f"Total missing durations: {len(missing_duration)}\n"))

        if discrepancies:
            self.stdout.write(self.style.ERROR("Discrepancies found:"))
            for d in discrepancies[:30]:
                safe_title = str(d['title']).encode("ascii", "replace").decode("ascii")
                safe_course = str(d['course']).encode("ascii", "replace").decode("ascii")
                self.stdout.write(
                    f"  - Lesson [{d['id']}] '{safe_title}' (Course: {safe_course}): "
                    f"stored='{d['stored']}' ({d['stored_seconds']}s) vs video={d['video_seconds']}s (diff: {d['diff']}s)"
                )
            if len(discrepancies) > 30:
                self.stdout.write(f"  ... and {len(discrepancies) - 30} more.")

        if should_fix:
            self.stdout.write(self.style.SUCCESS("\n[FIX APPLIED] Updated mismatched lesson durations to match video durations."))
