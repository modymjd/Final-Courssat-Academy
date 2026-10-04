from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    isRead = serializers.BooleanField(source="is_read", read_only=True)
    actionUrl = serializers.CharField(source="action_url", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = Notification
        fields = (
            "id",
            "user_id",
            "type",
            "title",
            "message",
            "is_read",
            "isRead",
            "action_url",
            "actionUrl",
            "created_at",
            "createdAt",
        )
        read_only_fields = ("id", "user_id", "created_at")
