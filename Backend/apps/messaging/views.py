from django.db.models import Count
from django.shortcuts import get_object_or_404
from django.utils.html import escape, strip_tags
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import User

from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer


class ConversationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Conversation.objects.filter(participants=self.request.user).prefetch_related("participants", "messages")

    def create(self, request, *args, **kwargs):
        recipient_id = request.data.get("recipient_id")
        if not recipient_id:
            return Response({"detail": "recipient_id required"}, status=status.HTTP_400_BAD_REQUEST)
        if str(recipient_id) == str(request.user.id):
            return Response({"detail": "Cannot create conversation with yourself."}, status=status.HTTP_400_BAD_REQUEST)

        recipient = get_object_or_404(User, pk=recipient_id)
        # Match only exact 2-participant 1-on-1 conversations to avoid leaking group chats
        existing = (
            Conversation.objects.annotate(p_count=Count("participants"))
            .filter(p_count=2, participants=request.user)
            .filter(participants=recipient)
            .first()
        )
        if existing:
            return Response(ConversationSerializer(existing, context={"request": request}).data)
        convo = Conversation.objects.create()
        convo.participants.set([request.user, recipient])
        return Response(
            ConversationSerializer(convo, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get", "post"], url_path="messages")
    def messages(self, request, pk=None):
        convo = self.get_object()
        if request.method == "GET":
            qs = convo.messages.select_related("sender").order_by("-created_at")
            page = self.paginate_queryset(qs)
            serializer = MessageSerializer(page or qs, many=True, context={"request": request})
            return self.get_paginated_response(serializer.data) if page is not None else Response(serializer.data)

        raw_content = request.data.get("content") or ""
        # Sanitize HTML tags and escape to prevent Stored XSS
        clean_content = escape(strip_tags(str(raw_content))).strip()
        if not clean_content:
            return Response({"detail": "content required"}, status=status.HTTP_400_BAD_REQUEST)
        if len(clean_content) > 5000:
            return Response(
                {"detail": "Message length exceeds maximum allowed limit (5000 chars)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        msg = Message.objects.create(conversation=convo, sender=request.user, content=clean_content)
        convo.save(update_fields=["updated_at"])
        return Response(MessageSerializer(msg, context={"request": request}).data, status=status.HTTP_201_CREATED)
