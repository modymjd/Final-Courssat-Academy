from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .models import AboutPageContent, Partnership, TeamMember

User = get_user_model()


class PlatformContentAPITests(APITestCase):
    def setUp(self):
        cache.clear()
        # Create normal user
        self.user = User.objects.create_user(
            email="student@example.com",
            password="Password123!",
            first_name="Student",
            last_name="User",
            role="student",
        )

        # Create Super Admin user
        self.super_admin = User.objects.create_user(
            email="superadmin@example.com",
            password="SuperPassword123!",
            first_name="Super",
            last_name="Admin",
            is_superuser=True,
            is_staff=True,
            role="super_admin",
        )

        # Seed initial about content
        self.about_content = AboutPageContent.get_content()
        self.about_content.founder_name = "Eng. Mohamed Elhetawy"
        self.about_content.save()

        # Seed initial team member
        self.team_member = TeamMember.objects.create(
            about_page=self.about_content,
            name="Dr. Ahmed Salem",
            role="Chief Academic Officer",
            quote="Great education for all",
            order=1,
        )

        # Seed initial partnership
        self.partnership = Partnership.objects.create(
            about_page=self.about_content,
            partner_name="NervaX Tech",
            date="2024-01-01",
            description="Technical partnership",
            order=1,
        )

    def authenticate_super_admin(self):
        refresh = RefreshToken.for_user(self.super_admin)
        access_token = refresh.access_token
        access_token["is_2fa_verified"] = True
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(access_token)}")

    def test_public_about_endpoint_returns_200(self):
        url = reverse("v1:public-platform-about")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        founder_name_val = data.get("founderName") or data.get("founder_name")
        self.assertEqual(founder_name_val, "Eng. Mohamed Elhetawy")

        team_list = data.get("teamMembers") or data.get("team_members")
        self.assertEqual(len(team_list), 1)

    def test_super_admin_about_endpoint_requires_auth(self):
        url = reverse("v1:super-admin-about-content")
        response = self.client.get(url)
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_super_admin_about_endpoint_updates_content(self):
        self.authenticate_super_admin()
        url = reverse("v1:super-admin-about-content")

        patch_data = {
            "founder_name": "Eng. Mohamed Elhetawy Updated",
            "company_tagline": "Innovative Software Solutions",
        }
        response = self.client.patch(url, patch_data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.about_content.refresh_from_db()
        self.assertEqual(self.about_content.founder_name, "Eng. Mohamed Elhetawy Updated")

    def test_super_admin_about_endpoint_updates_multipart_with_empty_fields(self):
        self.authenticate_super_admin()
        url = reverse("v1:super-admin-about-content")

        patch_data = {
            "founder_name": "Eng. Mohamed Elhetawy",
            "founder_title": "",
            "founder_quote": "",
            "company_name": "EduSmart Tech",
            "company_tagline": "",
            "company_description": "",
            "platform_name": "EduSmart",
            "platform_tagline": "",
            "platform_description": "",
            "contact_email": "",
            "contact_phone": "",
            "facebook_url": "",
            "instagram_url": "",
            "linkedin_url": "",
            "youtube_url": "",
            "twitter_url": "",
        }
        response = self.client.patch(url, patch_data, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_super_admin_about_endpoint_malformed_multipart_header(self):
        self.authenticate_super_admin()
        url = reverse("v1:super-admin-about-content")

        # Manually setting Content-Type to multipart/form-data without boundary triggers 400
        response = self.client.patch(
            url,
            data=b"raw data",
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_super_admin_team_member_crud(self):
        self.authenticate_super_admin()

        # Create
        list_url = reverse("v1:super-admin-about-team-members-list")
        create_data = {
            "name": "Eng. Sarah Mahmoud",
            "role": "Head of UX",
            "quote": "Seamless experiences",
            "order": 2,
        }
        response = self.client.post(list_url, create_data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_id = response.data.get("id")

        # Update
        detail_url = reverse("v1:super-admin-about-team-members-detail", kwargs={"pk": new_id})
        update_data = {"role": "Head of Product & UX"}
        response = self.client.patch(detail_url, update_data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Delete
        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(TeamMember.objects.filter(id=new_id).exists())

    def test_super_admin_partnership_crud(self):
        self.authenticate_super_admin()

        list_url = reverse("v1:super-admin-about-partnerships-list")
        create_data = {
            "partner_name": "Arab EdTech Group",
            "date": "2025-06-01",
            "description": "Regional expansion",
            "order": 2,
        }
        response = self.client.post(list_url, create_data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_id = response.data.get("id")

        # Delete
        detail_url = reverse("v1:super-admin-about-partnerships-detail", kwargs={"pk": new_id})
        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Partnership.objects.filter(id=new_id).exists())
