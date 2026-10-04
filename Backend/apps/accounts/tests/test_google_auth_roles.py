import pytest
from unittest.mock import patch
from rest_framework.throttling import ScopedRateThrottle
from django.urls import reverse
from rest_framework import status
from apps.accounts.models import UserRole, InstructorProfile, CenterProfile

pytestmark = pytest.mark.django_db

@pytest.fixture
def mock_google_verify():
    with patch("apps.accounts.views.id_token.verify_oauth2_token") as mock_verify:
        mock_verify.return_value = {
            "email_verified": True,
            "email": "test@google.com",
            "given_name": "Test",
            "family_name": "User",
            "name": "Test User",
        }
        yield mock_verify

@pytest.fixture(autouse=True)
def disable_throttling():
    with patch.object(ScopedRateThrottle, "allow_request", return_value=True):
        yield

def test_google_auth_creates_student_by_default(client, mock_google_verify):
    url = reverse("v1:auth-google")
    data = {"credential": "dummy_token"}
    response = client.post(url, data, format="json")
    
    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["user"]["role"] == UserRole.STUDENT
    assert response.data["user"]["email"] == "test@google.com"

def test_google_auth_creates_instructor(client, mock_google_verify):
    url = reverse("v1:auth-google")
    data = {"credential": "dummy_token", "role": UserRole.INSTRUCTOR}
    response = client.post(url, data, format="json")
    
    assert response.status_code == status.HTTP_201_CREATED, response.data
    assert response.data["user"]["role"] == UserRole.INSTRUCTOR
    assert InstructorProfile.objects.filter(user__email="test@google.com").exists()

def test_google_auth_creates_center(client, mock_google_verify):
    url = reverse("v1:auth-google")
    data = {"credential": "dummy_token", "role": UserRole.CENTER}
    response = client.post(url, data, format="json")
    
    assert response.status_code == status.HTTP_201_CREATED, response.data
    assert response.data["user"]["role"] == UserRole.CENTER
    assert CenterProfile.objects.filter(user__email="test@google.com").exists()

def test_google_auth_rejects_invalid_role(client, mock_google_verify):
    url = reverse("v1:auth-google")
    data = {"credential": "dummy_token", "role": "admin"}
    response = client.post(url, data, format="json")
    
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    errors = response.data.get("error", {}).get("errors", {}) if "error" in response.data else response.data
    assert "role" in errors
