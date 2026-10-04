import time
from pathlib import Path

import structlog
from celery import shared_task
from django.conf import settings

logger = structlog.get_logger(__name__)


@shared_task
def cleanup_video_scratch_dir_task():
    """
    Deletes files older than 24 hours from settings.MEDIA_ROOT / 'scratch'.
    Logs how many files were cleaned up and total space freed.
    """
    try:
        scratch_dir = Path(settings.MEDIA_ROOT) / "scratch"
        if not scratch_dir.exists():
            logger.info("cleanup_video_scratch_dir_task.no_scratch_dir", scratch_dir=str(scratch_dir))
            return

        current_time = time.time()
        one_day_ago = current_time - (24 * 3600)

        files_deleted = 0
        space_freed = 0

        for filepath in scratch_dir.iterdir():
            if filepath.is_file():
                try:
                    file_stat = filepath.stat()
                    # Check modification time
                    if file_stat.st_mtime < one_day_ago:
                        file_size = file_stat.st_size
                        filepath.unlink()
                        files_deleted += 1
                        space_freed += file_size
                except Exception as e:
                    logger.error("cleanup_video_scratch_dir_task.file_error", filepath=str(filepath), error=str(e))

        logger.info(
            "cleanup_video_scratch_dir_task.success", files_deleted=files_deleted, space_freed_bytes=space_freed
        )
    except Exception as e:
        logger.error("cleanup_video_scratch_dir_task.failed", error=str(e))
