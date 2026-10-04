from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.accounts.models import GuardianProfile, StudentProfile
from apps.accounts.serializers.user import UserSerializer

User = get_user_model()


class UserProfileUpdateContractTests(TestCase):
    def setUp(self):
        self.student = User.objects.create_user(
            email="profile-student@test.local",
            password="Password123!",
            first_name="Profile",
            last_name="Student",
            role="student",
            profile_completed=True,
        )
        self.profile = StudentProfile.objects.get(user=self.student)

    def test_student_education_and_guardian_are_persisted(self):
        serializer = UserSerializer(
            instance=self.student,
            data={
                "first_name": "Updated",
                "education_level": "secondary",
                "school_name": "Test Secondary School",
                "grade_level": "secondary_2",
                "guardian": {
                    "full_name": "Student Guardian",
                    "relationship": "father",
                    "phone": "01012345678",
                    "national_id": "29001011234567",
                },
            },
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        self.student.refresh_from_db()
        self.profile.refresh_from_db()
        guardian = GuardianProfile.objects.get(student_profile=self.profile)

        self.assertEqual(self.student.first_name, "Updated")
        self.assertEqual(self.profile.education_level, "secondary")
        self.assertEqual(self.profile.school_name, "Test Secondary School")
        self.assertEqual(self.profile.grade_level, "secondary_2")
        self.assertEqual(guardian.full_name, "Student Guardian")
        self.assertEqual(guardian.phone, "01012345678")

    def test_existing_multiple_guardians_do_not_make_profile_update_fail(self):
        GuardianProfile.objects.create(
            student_profile=self.profile,
            full_name="Older Guardian",
            relationship="father",
            phone="01012345670",
        )
        latest = GuardianProfile.objects.create(
            student_profile=self.profile,
            full_name="Latest Guardian",
            relationship="father",
            phone="01012345671",
        )

        serializer = UserSerializer(
            instance=self.student,
            data={
                "guardian": {
                    "full_name": "Updated Latest Guardian",
                    "relationship": "mother",
                    "phone": "01012345672",
                },
            },
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        latest.refresh_from_db()
        self.assertEqual(latest.full_name, "Updated Latest Guardian")
        self.assertEqual(latest.relationship, "mother")
        self.assertEqual(latest.phone, "01012345672")
        self.assertEqual(GuardianProfile.objects.filter(student_profile=self.profile).count(), 2)

    def test_guardian_field_is_rejected_for_non_student(self):
        instructor = User.objects.create_user(
            email="profile-instructor@test.local",
            password="Password123!",
            first_name="Profile",
            last_name="Instructor",
            role="instructor",
            profile_completed=True,
        )
        serializer = UserSerializer(
            instance=instructor,
            data={
                "guardian": {
                    "full_name": "Invalid Guardian",
                    "relationship": "father",
                    "phone": "01012345678",
                },
            },
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("guardian", serializer.errors)
