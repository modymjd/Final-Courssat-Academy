from django.test import TestCase, override_settings
from cryptography.fernet import Fernet

from apps.accounts.services.crypto_service import (
    decrypt_national_id,
    encrypt_national_id,
    hash_national_id,
    mask_national_id,
    rotate_national_id,
)


class CryptoServiceTests(TestCase):
    def test_encrypt_and_decrypt_national_id(self):
        nid = "29901010101234"
        ciphertext = encrypt_national_id(nid)
        self.assertNotEqual(ciphertext, nid)
        self.assertTrue(len(ciphertext) > 20)

        decrypted = decrypt_national_id(ciphertext)
        self.assertEqual(decrypted, nid)

    def test_encrypt_and_decrypt_empty(self):
        self.assertEqual(encrypt_national_id(""), "")
        self.assertEqual(decrypt_national_id(""), "")

    def test_key_rotation(self):
        key1 = Fernet.generate_key()
        key2 = Fernet.generate_key()

        nid = "28505051234567"
        # Encrypted with key1 as primary
        cipher1 = encrypt_national_id(nid, keys=[key1])

        # Rotate with key2 as new primary, key1 as fallback
        cipher2 = rotate_national_id(cipher1, new_keys=[key2, key1])

        # Decrypt with key2
        decrypted = decrypt_national_id(cipher2, keys=[key2])
        self.assertEqual(decrypted, nid)

    def test_hmac_sha256_hashing(self):
        nid = "29901010101234"
        with override_settings(NATIONAL_ID_PEPPER="custom_secret_pepper_123"):
            hash1 = hash_national_id(nid)
            hash2 = hash_national_id(nid)
            self.assertEqual(hash1, hash2)
            self.assertEqual(len(hash1), 64)  # SHA-256 hex digest length

        with override_settings(NATIONAL_ID_PEPPER="different_pepper_456"):
            hash3 = hash_national_id(nid)
            self.assertNotEqual(hash1, hash3)

    def test_mask_national_id(self):
        # 14 digits standard Egyptian ID
        self.assertEqual(mask_national_id("29901010101234"), "2990101******4")
        # Empty
        self.assertEqual(mask_national_id(""), "")
        # Short strings
        self.assertEqual(mask_national_id("123"), "***")
        self.assertEqual(mask_national_id("123456"), "12***6")
