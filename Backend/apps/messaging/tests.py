from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.messaging.models import Conversation, Message

User = get_user_model()


class MessagingSecurityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            email="user1@edusmart.test",
            password="Password123!",
            first_name="Ahmed",
            last_name="Ali",
            role="student",
            profile_completed=True,
        )
        self.user2 = User.objects.create_user(
            email="user2@edusmart.test",
            password="Password123!",
            first_name="Sara",
            last_name="Mohamed",
            role="instructor",
            profile_completed=True,
        )
        self.user3 = User.objects.create_user(
            email="user3@edusmart.test",
            password="Password123!",
            first_name="Khaled",
            last_name="Tarek",
            role="student",
            profile_completed=True,
        )

    def test_message_content_is_sanitized_against_xss(self):
        """Verify that malicious script tags in message content are sanitized."""
        self.client.force_authenticate(user=self.user1)

        convo_res = self.client.post("/api/v1/conversations/", data={"recipient_id": self.user2.id})
        self.assertEqual(convo_res.status_code, status.HTTP_201_CREATED)
        convo_id = convo_res.data["id"]

        # Send malicious script tag
        xss_payload = "<script>alert('pwned')</script>Hello World!"
        msg_res = self.client.post(f"/api/v1/conversations/{convo_id}/messages/", data={"content": xss_payload})
        self.assertEqual(msg_res.status_code, status.HTTP_201_CREATED)

        # Message in DB and response should not contain raw <script>
        msg = Message.objects.get(id=msg_res.data["id"])
        self.assertNotIn("<script>", msg.content)
        self.assertIn("Hello World!", msg.content)

    def test_1_on_1_conversation_does_not_leak_group_chat(self):
        """Verify that creating 1-on-1 convo between user1 & user2 does not return existing 3-person group conversation."""
        # 1. Create 3-person conversation
        group_convo = Conversation.objects.create()
        group_convo.participants.set([self.user1, self.user2, self.user3])

        # 2. user1 requests 1-on-1 conversation with user2
        self.client.force_authenticate(user=self.user1)
        res = self.client.post("/api/v1/conversations/", data={"recipient_id": self.user2.id})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertNotEqual(res.data["id"], group_convo.id)

        # 3. Requesting again returns the newly created 1-on-1 convo
        res_repeat = self.client.post("/api/v1/conversations/", data={"recipient_id": self.user2.id})
        self.assertEqual(res_repeat.data["id"], res.data["id"])
