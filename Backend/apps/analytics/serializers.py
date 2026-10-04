from rest_framework import serializers

from .models import AchievementBadge, FocusSession, UserAchievement


class AchievementBadgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = AchievementBadge
        fields = ["slug", "title", "description", "icon", "category", "xp_reward"]


class UserAchievementSerializer(serializers.ModelSerializer):
    badge = AchievementBadgeSerializer(read_only=True)

    class Meta:
        model = UserAchievement
        fields = ["id", "badge", "unlocked_at"]


class FocusSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = FocusSession
        fields = [
            "id",
            "session_id",
            "student",
            "start_time",
            "end_time",
            "duration_seconds",
            "focused",
            "focus_score",
            "mode",
            "distractions_count",
            "course_id",
            "created_at",
        ]
        read_only_fields = ["id", "student", "created_at"]

    def validate_duration_seconds(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("مدة الجلسة يجب أن تكون أكبر من الصفر.")
        # Maximum duration for a single focus session is 4 hours (14,400 seconds)
        if value > 14400:
            raise serializers.ValidationError("الحد الأقصى المسموح به لجلسة التركيز الواحدة هو 4 ساعات (14400 ثانية).")
        return value

    def validate_focus_score(self, value):
        if value is not None and not (0 <= value <= 100):
            raise serializers.ValidationError("درجة التركيز يجب أن تكون بين 0 و 100.")
        return value

    def validate_distractions_count(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("عدد التشتتات لا يمكن أن يكون سالباً.")
        return value

    def validate(self, attrs):
        start = attrs.get("start_time")
        end = attrs.get("end_time")
        if start and end and end < start:
            raise serializers.ValidationError({"end_time": "وقت انتهاء الجلسة لا يمكن أن يسبق وقت البدء."})
        return attrs
