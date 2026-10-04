from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase

from apps.courses.serializers import VideoUploadChunkSerializer, VideoUploadCompleteSerializer


class VideoUploadSecurityTests(SimpleTestCase):
    def test_upload_id_rejects_path_traversal(self):
        payload = {
            "upload_id": "../escape",
            "chunk_index": 0,
            "total_chunks": 1,
            "chunk": SimpleUploadedFile("chunk.part", b"data"),
        }
        serializer = VideoUploadChunkSerializer(data=payload)
        self.assertFalse(serializer.is_valid())
        self.assertIn("upload_id", serializer.errors)

    def test_chunk_index_must_be_within_total(self):
        payload = {
            "upload_id": "safe-upload",
            "chunk_index": 2,
            "total_chunks": 2,
            "chunk": SimpleUploadedFile("chunk.part", b"data"),
        }
        serializer = VideoUploadChunkSerializer(data=payload)
        self.assertFalse(serializer.is_valid())
        self.assertIn("chunk_index", serializer.errors)

    def test_upload_is_limited_to_1gb_at_eight_mib_per_chunk(self):
        payload = {
            "upload_id": "safe-upload",
            "chunk_index": 0,
            "total_chunks": 129,
            "chunk": SimpleUploadedFile("chunk.part", b"data"),
        }
        serializer = VideoUploadChunkSerializer(data=payload)
        self.assertFalse(serializer.is_valid())
        self.assertIn("total_chunks", serializer.errors)

    def test_complete_endpoint_rejects_unsafe_upload_id(self):
        serializer = VideoUploadCompleteSerializer(
            data={
                "upload_id": "foo/bar",
                "title": "Video",
                "total_chunks": 1,
                "file_name": "video.mp4",
            }
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("upload_id", serializer.errors)
