from django.conf import settings
from django.db import models

from apps.common.models import TimestampedModel


class Conversation(TimestampedModel):
    participants = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="conversations")

    class Meta:
        ordering = ["-updated_at"]


class Message(TimestampedModel):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_messages")
    content = models.TextField()
    is_read = models.BooleanField(default=False)

    class Meta:
        indexes = [models.Index(fields=["conversation", "-created_at"])]
        ordering = ["created_at"]
