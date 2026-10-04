import base64
import hashlib
import hmac
import secrets

from cryptography.fernet import Fernet
from django.conf import settings
from django.db import migrations


def backfill_data(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    StudentProfile = apps.get_model('accounts', 'StudentProfile')
    
    fernet_key = getattr(settings, 'NATIONAL_ID_FERNET_KEY', None)
    if fernet_key:
        cipher_suite = Fernet(fernet_key.encode())
    else:
        cipher_suite = None

    pepper = getattr(settings, 'NATIONAL_ID_PEPPER', 'default_pepper_fallback').encode()

    for user in User.objects.exclude(national_id__exact="").exclude(national_id__isnull=True):
        if not user.national_id:
            continue
            
        # Hash
        h = hmac.new(pepper, user.national_id.encode(), hashlib.sha256).hexdigest()
        user.national_id_hash = h
        
        # Encrypt
        if cipher_suite:
            user.national_id_encrypted = cipher_suite.encrypt(user.national_id.encode()).decode()
        else:
            user.national_id_encrypted = base64.b64encode(user.national_id.encode()).decode()
        
        user.save(update_fields=['national_id_hash', 'national_id_encrypted'])
        
    for sp in StudentProfile.objects.filter(student_code__isnull=True) | StudentProfile.objects.filter(student_code=""):
        for _ in range(10):
            candidate = f"STU-{secrets.token_hex(3).upper()[:5]}"
            if not StudentProfile.objects.filter(student_code=candidate).exists():
                sp.student_code = candidate
                sp.save(update_fields=['student_code'])
                break


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0017_studentprofile_student_code_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill_data, reverse_code=migrations.RunPython.noop),
    ]
