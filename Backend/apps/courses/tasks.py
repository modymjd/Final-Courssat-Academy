import json
import shutil
import subprocess
from pathlib import Path

import structlog
from celery import shared_task
from django.conf import settings

from .models import Video, VideoStatus

logger = structlog.get_logger(__name__)


def generate_master_playlist(output_dir: Path) -> Path:
    """Generates the master.m3u8 HLS multi-variant playlist linking all renditions."""
    master_content = (
        "#EXTM3U\n"
        "#EXT-X-VERSION:3\n"
        "#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720\n"
        "720p.m3u8\n"
        "#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=854x480\n"
        "480p.m3u8\n"
        "#EXT-X-STREAM-INF:BANDWIDTH=700000,RESOLUTION=640x360\n"
        "360p.m3u8\n"
    )
    master_path = output_dir / "master.m3u8"
    master_path.write_text(master_content, encoding="utf-8")
    return master_path


def get_video_duration(raw_path: str) -> int:
    """Probes video duration in seconds using ffprobe if available."""
    try:
        cmd = [
            "ffprobe",
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            raw_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)
        duration = float(data.get("format", {}).get("duration", 0))
        return int(duration)
    except Exception as e:
        logger.warning("get_video_duration.probe_failed", error=str(e), path=raw_path)
        return 0


@shared_task(bind=True, max_retries=2, default_retry_delay=15)
def transcode_video_to_hls_task(self, video_id: int):
    """
    Asynchronously transcodes an uploaded raw video file into multi-bitrate HLS
    (720p, 480p, 360p) with 4-second segments and a master playlist.
    Updates Video status to 'processing' -> 'ready' or 'failed'.
    Deletes raw source file on completion.
    """
    try:
        video = Video.objects.get(id=video_id)
    except Video.DoesNotExist:
        logger.error("transcode_video_to_hls.not_found", video_id=video_id)
        return False

    video.status = VideoStatus.PROCESSING
    video.save(update_fields=["status", "updated_at"])

    raw_path = Path(video.raw_file_path)
    if not raw_path.exists():
        video.status = VideoStatus.FAILED
        video.error_message = f"Raw video file not found at: {raw_path}"
        video.save(update_fields=["status", "error_message", "updated_at"])
        logger.error("transcode_video_to_hls.file_missing", video_id=video.id, raw_path=str(raw_path))
        return False

    output_dir = Path(settings.MEDIA_ROOT) / "hls" / str(video.id)
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        duration = get_video_duration(str(raw_path))
        ffmpeg_cmd = shutil.which("ffmpeg")

        if ffmpeg_cmd:
            # 1. 720p Rendition
            cmd_720p = [
                ffmpeg_cmd,
                "-y",
                "-i",
                str(raw_path),
                "-vf",
                "scale=-2:720",
                "-c:v",
                "libx264",
                "-profile:v",
                "main",
                "-crf",
                "20",
                "-maxrate",
                "2500k",
                "-bufsize",
                "5000k",
                "-c:a",
                "aac",
                "-b:a",
                "128k",
                "-ar",
                "48000",
                "-hls_time",
                "4",
                "-hls_playlist_type",
                "vod",
                "-hls_segment_filename",
                str(output_dir / "720p_%03d.ts"),
                str(output_dir / "720p.m3u8"),
            ]
            subprocess.run(cmd_720p, capture_output=True, check=True)

            # 2. 480p Rendition
            cmd_480p = [
                ffmpeg_cmd,
                "-y",
                "-i",
                str(raw_path),
                "-vf",
                "scale=-2:480",
                "-c:v",
                "libx264",
                "-profile:v",
                "main",
                "-crf",
                "22",
                "-maxrate",
                "1200k",
                "-bufsize",
                "2400k",
                "-c:a",
                "aac",
                "-b:a",
                "96k",
                "-ar",
                "44100",
                "-hls_time",
                "4",
                "-hls_playlist_type",
                "vod",
                "-hls_segment_filename",
                str(output_dir / "480p_%03d.ts"),
                str(output_dir / "480p.m3u8"),
            ]
            subprocess.run(cmd_480p, capture_output=True, check=True)

            # 3. 360p Rendition
            cmd_360p = [
                ffmpeg_cmd,
                "-y",
                "-i",
                str(raw_path),
                "-vf",
                "scale=-2:360",
                "-c:v",
                "libx264",
                "-profile:v",
                "baseline",
                "-crf",
                "24",
                "-maxrate",
                "600k",
                "-bufsize",
                "1200k",
                "-c:a",
                "aac",
                "-b:a",
                "64k",
                "-ar",
                "44100",
                "-hls_time",
                "4",
                "-hls_playlist_type",
                "vod",
                "-hls_segment_filename",
                str(output_dir / "360p_%03d.ts"),
                str(output_dir / "360p.m3u8"),
            ]
            subprocess.run(cmd_360p, capture_output=True, check=True)

        else:
            if not settings.DEBUG:
                raise RuntimeError("FFmpeg is required for production video transcoding but was not found.")
            # Simulation fallback is allowed only in local/test environments.
            logger.info("transcode_video_to_hls.ffmpeg_not_found_fallback", video_id=video.id)
            for res in ["720p", "480p", "360p"]:
                playlist = output_dir / f"{res}.m3u8"
                playlist.write_text(
                    f"#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:4\n#EXTINF:4.000,\n{res}_000.ts\n#EXT-X-ENDLIST\n",
                    encoding="utf-8",
                )
                segment = output_dir / f"{res}_000.ts"
                segment.write_bytes(b"\x00" * 1024)

        generate_master_playlist(output_dir)

        # Update Video record
        video.status = VideoStatus.READY
        video.duration_seconds = duration
        video.resolutions = ["720p", "480p", "360p"]
        video.hls_master_playlist = f"/hls/{video.id}/master.m3u8"
        video.error_message = ""
        video.save(
            update_fields=[
                "status",
                "duration_seconds",
                "resolutions",
                "hls_master_playlist",
                "error_message",
                "updated_at",
            ]
        )

        # Policy: Delete raw source file from scratch directory on success
        try:
            if raw_path.exists():
                raw_path.unlink()
                logger.info("transcode_video_to_hls.raw_file_deleted", path=str(raw_path))
        except Exception as del_err:
            logger.warning("transcode_video_to_hls.raw_delete_failed", error=str(del_err))

        logger.info("transcode_video_to_hls.success", video_id=video.id, output_dir=str(output_dir))
        return True

    except Exception as exc:
        video.status = VideoStatus.FAILED
        video.error_message = str(exc)[:1000]
        video.save(update_fields=["status", "error_message", "updated_at"])
        logger.error("transcode_video_to_hls.failed", video_id=video.id, error=str(exc))
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc) from exc
        raise


@shared_task(autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def notify_new_lesson_task(lesson_id: int) -> int:
    """
    Generates Notification records for all students enrolled in lesson.module.course and their linked guardians.
    """
    try:
        from apps.accounts.models import GuardianProfile
        from apps.enrollments.models import Enrollment
        from apps.notifications.models import Notification, NotificationType

        from .models import Lesson

        lesson = Lesson.objects.select_related("module__course").get(pk=lesson_id)
        course = lesson.module.course
        student_ids = set(
            Enrollment.objects.filter(course=course).values_list("student_id", flat=True)
        )
        if not student_ids:
            return 0

        guardian_ids = set(
            GuardianProfile.objects.filter(
                student_profile__user_id__in=student_ids,
                guardian_user__isnull=False,
            ).values_list("guardian_user_id", flat=True)
        )

        action_url = f"/lesson/{course.id}/{lesson.id}"
        title = f"درس جديد: {lesson.title}"
        message = f"أضاف المعلم درساً جديداً \"{lesson.title}\" في دورة \"{course.title}\"."

        recipients = student_ids | guardian_ids
        notifications = [
            Notification(
                user_id=uid,
                type=NotificationType.COURSE_UPDATE,
                title=title,
                message=message,
                action_url=action_url,
            )
            for uid in recipients
        ]
        created = Notification.objects.bulk_create(notifications, ignore_conflicts=True)
        return len(created)
    except Exception as e:
        logger.warning("notify_new_lesson_task.failed", error=str(e), lesson_id=lesson_id)
        return 0
