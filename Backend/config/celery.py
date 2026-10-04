import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.base")

app = Celery("courssat")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

# Dual-Queue Architecture: Separate heavy video transcoding from fast platform tasks
app.conf.task_routes = {
    "apps.courses.tasks.transcode_video_task": {"queue": "video_queue"},
    "apps.courses.tasks.transcode_video_to_hls_task": {"queue": "video_queue"},
    "apps.courses.tasks.generate_thumbnail_task": {"queue": "video_queue"},
    "apps.courses.tasks.cleanup_scratch_file_task": {"queue": "video_queue"},
    "apps.common.tasks.cleanup_video_scratch_dir_task": {"queue": "default"},
    "apps.notifications.tasks.*": {"queue": "default"},
    "apps.finance.tasks.*": {"queue": "default"},
    "apps.accounts.tasks.*": {"queue": "default"},
}

app.conf.task_default_queue = "default"


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f"Request: {self.request!r}")
