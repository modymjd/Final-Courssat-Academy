# Current Approved Plan — One-Month Pilot Production Readiness

**Approved by the project owner:** 2026-10-04  
**Primary goal:** ship the smallest complete, reliable vertical slice for a
one-month pilot while preserving a safe path to 500 concurrent students.

## Launch-critical user journeys

1. Instructor authentication and profile access.
2. Course creation, modules, lessons, image/video upload and publication.
3. Student enrollment and protected lesson/video access.
4. Exam/quiz/assignment creation with question images, automatic grading,
   manual essay grading and lesson progression gates.
5. Operational readiness: production configuration, health checks, backups,
   logging, media limits and secure defaults.

## Execution order

### P0 — Functional integrity

- Validate the complete exam workflow and close remaining frontend/backend
  contract gaps.
- Validate registration/login/role routing and remove authentication
  regressions.
- Validate course creation, lesson publication, enrollment and protected video
  playback.
- Ensure all uploaded question/cover images are optimized and all video states
  have explicit failure/retry handling.

### P1 — Deployment safety

- Add the local Compose file used by the verified Windows workflow to the
  deliverable.
- Validate production Compose, required environment variables, secrets and
  health checks.
- Ensure backup/restore scripts and migration commands are documented and
  non-destructive.

### P2 — Quality gate

- Run focused backend integration tests for the pilot workflows.
- Run TypeScript, production build and focused UI tests.
- Package only source/configuration changes; exclude databases, secrets,
  generated media, caches and dependencies.
- Produce an Arabic deployment and pilot acceptance walkthrough.

## Explicitly deferred from the pilot

- Hosting 500 HD streams directly on KVM4.
- Building an in-house live-stream/WebRTC service.
- Enabling electronic payment before valid gateway credentials and webhook
  verification are available.
- Cosmetic or secondary dashboard work that does not block the pilot.

---

# Historical Step 0 Audit Report & Implementation Plan: Four Core Platform Features

This document provides a thorough audit of the existing codebase for Courssat (`courssat.online`), identifies what is already implemented versus what is missing or needs refactoring, and outlines the precise, production-ready implementation plan for the four core features.

---

## Part 1: Comprehensive Step 0 Audit Report

### 1. Feature 1 — Video Upload & Processing Pipeline
* **What Already Exists:**
  * `SignedStreamURLView` in [`Backend/apps/courses/views.py`](file:///f:/FlashCard/edusmart/Backend/apps/courses/views.py#L216-L275): Generates Nginx `secure_link` MD5 tokens bound to the student's client IP (`request.META['HTTP_X_FORWARDED_FOR']` or `REMOTE_ADDR`) with a 2-hour (7200s) expiry (`/hls/{lesson.id}/master.m3u8?token=...&expires=...`).
  * `NGINX_SECURE_LINK_SECRET` and `VIDEO_STORAGE_ADAPTER` configured in [`Backend/config/settings/base.py`](file:///f:/FlashCard/edusmart/Backend/config/settings/base.py#L300-L301).
  * `cleanup_video_scratch_dir_task` in [`Backend/apps/common/tasks.py`](file:///f:/FlashCard/edusmart/Backend/apps/common/tasks.py#L10-L48): Celery beat task cleaning scratch files older than 24h.
  * [`Frontend/src/components/video/SecureVideoPlayer.tsx`](file:///f:/FlashCard/edusmart/Frontend/src/components/video/SecureVideoPlayer.tsx): Player built on `hls.js` with quality selection, dynamic moving watermark, screen blur on focus loss, custom controls.
* **What is Missing / Needs Change:**
  * **Video Model**: No standalone `Video` model exists in the database. (Lessons currently hold a plain `video_url` string). A dedicated `Video` model is needed to track processing status (`pending`, `processing`, `ready`, `failed`), error logs, duration, resolutions, and raw file paths.
  * **Chunked / Resumable Upload Backend**: No chunked upload endpoint exists. We need `VideoUploadChunkView` and `VideoUploadCompleteView` supporting 5MB chunks up to 1GB total, verifying MIME types (`video/mp4`, `video/quicktime`).
  * **FFmpeg HLS Transcoding Celery Task**: No FFmpeg transcoding task is registered. We need `transcode_video_to_hls_task` in `apps.courses.tasks` executing FFmpeg to generate 720p, 480p, and 360p renditions with 4-second segments and master playlist `master.m3u8` into a private directory (`MEDIA_ROOT/hls/{video_id}/`).
  * **Frontend Upload UI**: Needs a resilient chunked upload component with real progress percentage, pause/resume, and live status polling (`pending` → `processing` → `ready`/`failed`) using TanStack Query `refetchInterval`.
  * **Player Token Auto-Refresh**: `SecureVideoPlayer.tsx` needs proactive re-fetching of expired `secure_link` tokens before 2 hours expire or upon encountering 403 errors.

---

### 2. Feature 2 — Course Creation & Course Builder
* **What Already Exists:**
  * [`Backend/apps/courses/models.py`](file:///f:/FlashCard/edusmart/Backend/apps/courses/models.py): `Category`, `Course`, `Module`, `Lesson`, and `Review` models.
  * [`Backend/apps/courses/views.py`](file:///f:/FlashCard/edusmart/Backend/apps/courses/views.py): `CourseViewSet`, `ModuleViewSet`, `LessonViewSet` with RBAC permissions (`IsCourseOwnerOrAdmin`, `IsModuleCourseOwnerOrAdmin`, `IsLessonCourseOwnerOrAdmin`).
  * [`Backend/apps/enrollments/models.py`](file:///f:/FlashCard/edusmart/Backend/apps/enrollments/models.py): `Enrollment` and `LessonCompletion` models.
  * [`Frontend/src/pages/instructor/InstructorCourseManagement.tsx`](file:///f:/FlashCard/edusmart/Frontend/src/pages/instructor/InstructorCourseManagement.tsx): Basic table listing instructor's courses.
* **What is Missing / Needs Change:**
  * **Full Course Builder UI**: A complete multi-step / interactive Course Builder page (`/instructor/courses/builder` or `/instructor/courses/:id/edit`) for instructors/centers to:
    * Manage Course metadata (title, category, price, cover image, requirements, objectives, draft/publish toggle).
    * Add, edit, delete, and reorder Modules.
    * Add, edit, delete, and reorder Lessons within Modules.
    * Select/attach an uploaded processed Video to any lesson.
  * **Reordering Mechanism**: Reorder modules and lessons with accessible up/down ordering and drag handles using existing `framer-motion` (avoiding new uninstalled dependencies).
  * **Student Watch Progress**: Connect `completeLesson` API cleanly with lesson completion badges in the course curriculum tree.

---

### 3. Feature 3 — Lesson Summaries
* **What Already Exists:**
  * Previous migration `0004_lecturesummary_lessonqa.py` had a rudimentary model which was cleaned up in `0005`.
  * [`Frontend/src/pages/LessonDetail.tsx`](file:///f:/FlashCard/edusmart/Frontend/src/pages/LessonDetail.tsx#L137-L158): Contains tabs for "Overview" and "Resources" (attachments).
* **What is Missing / Needs Change:**
  * **LessonSummary Model**: Create `LessonSummary` model in `apps.courses.models` linked to `Lesson` with:
    * `lesson`: OneToOneField to `Lesson` (`related_name="summary"`).
    * `content`: Rich-text/HTML content (validated and sanitized server-side via `bleach`/`sanitize_html_content`).
    * `attachment`: FileField (`upload_to="lesson_summaries/"`, PDF/document).
  * **Endpoints & Serializers**: Endpoints for instructors to create/update summaries, and for enrolled students (and course owners) to retrieve and download summaries/attachments.
  * **Frontend UI**:
    * Instructor: Rich text editor / formatted editor with PDF upload inside Course/Lesson Builder.
    * Student: Summary viewer tab in `LessonDetail.tsx` with PDF download action.

---

### 4. Feature 4 — Exam Engine
* **What Already Exists:**
  * [`Backend/apps/assessments/models.py`](file:///f:/FlashCard/edusmart/Backend/apps/assessments/models.py): `Exam`, `QuestionBankItem`, `StudentExam`, `StudentAnswer`.
  * [`Backend/apps/assessments/views.py`](file:///f:/FlashCard/edusmart/Backend/apps/assessments/views.py): `ExamViewSet` with `start`, `submit`, `grade_essay`, `analytics`, and `QuestionBankViewSet`.
  * Server-side auto-grading for `MULTIPLE_CHOICE`, `TRUE_FALSE`, `FILL_BLANK`, and `MATCHING` questions.
  * Anti-cheat tracking (`tab_switches_count`) and multi-attempt enforcement.
  * [`Frontend/src/pages/instructor/InstructorExamBuilder.tsx`](file:///f:/FlashCard/edusmart/Frontend/src/pages/instructor/InstructorExamBuilder.tsx): Exam builder with AI JSON import.
  * [`Frontend/src/pages/exam/ExamSession.tsx`](file:///f:/FlashCard/edusmart/Frontend/src/pages/exam/ExamSession.tsx): Active exam session with timer and proctoring.
* **What is Missing / Needs Change:**
  * **Pass Threshold & Pass/Fail Determination**: Add `pass_threshold` (percentage, default 50%) to `Exam` model and compute `is_passed` on `StudentExam`.
  * **Server-Side Time Enforcement**: Ensure `submit` action explicitly calculates elapsed time (`timezone.now() - attempt.started_at`) against `exam.duration_minutes` (+ 2 min grace period for network latency) to prevent bypassed client timers.
  * **Exam Results Dashboard for Instructors**: A dedicated view for instructors to see student attempt lists, scores, submission timestamps, tab switches, and pass/fail states.
  * **Student Immediate Result Screen**: Result page displaying calculated score, pass/fail status, remaining attempts, and question-level review for practice exams.

---

## Part 2: Explicit Clarifications & Design Decisions

> [!IMPORTANT]
> **File Limits & Policies:**
> 1. **Video Upload Size**: Max 1,024 MB (1 GB) per video, uploaded in 5 MB chunks via `POST /api/v1/courses/videos/upload-chunk/` and finalized via `POST /api/v1/courses/videos/upload-complete/`. Supported MIME types: `video/mp4`, `video/quicktime`.
> 2. **Raw Video Retention**: Once Celery successfully finishes HLS transcoding and generates `master.m3u8` + all renditions, the raw source file in the scratch folder is immediately deleted to save disk space and ensure no raw file is ever exposed.
> 3. **Summaries**: Confirmed as instructor-written rich-text lesson summaries with optional downloadable PDF attachments (not AI-generated transcripts).
> 4. **No New Dependencies**: All frontend UI will strictly use existing dependencies (`@radix-ui/*`, `framer-motion`, `lucide-react`, `react-hook-form`, `zod`, `@tanstack/react-query`, `dompurify`, `i18next`).

---

## Part 3: Role-Based Access Control (RBAC) Matrix

| Feature / Action | Student | Instructor (Owner) | Center Admin | Platform Admin |
| :--- | :---: | :---: | :---: | :---: |
| Upload Video & Trigger Transcoding | ❌ | ✅ | ✅ | ✅ |
| Query Video Processing Status | ❌ | ✅ (Owned) | ✅ (Owned) | ✅ (All) |
| Request HLS Secure Link Token | ✅ (If Enrolled/Free) | ✅ (Owned) | ✅ (Owned) | ✅ (All) |
| Create / Edit / Delete Course / Module / Lesson | ❌ | ✅ (Owned) | ✅ (Owned) | ✅ (All) |
| View Course & Lessons List | ✅ (Published only) | ✅ (Owned drafts + all published) | ✅ (Owned drafts + all published) | ✅ (All) |
| Create / Edit / Delete Lesson Summary & PDF | ❌ | ✅ (Owned) | ✅ (Owned) | ✅ (All) |
| View Lesson Summary & Download PDF | ✅ (If Enrolled) | ✅ (Owned) | ✅ (Owned) | ✅ (All) |
| Create / Edit / Delete Exam & Questions | ❌ | ✅ (Owned) | ✅ (Owned) | ✅ (All) |
| Start & Submit Exam Attempt | ✅ (If Enrolled) | ❌ (Test mode only) | ❌ | ✅ |
| View Exam Results & Analytics | ✅ (Own score only) | ✅ (All students in course) | ✅ (All students in center) | ✅ (All) |

---

## Part 4: Proposed File Changes

### Backend Changes

#### 1. Models & Migrations
* **[MODIFY] [`Backend/apps/courses/models.py`](file:///f:/FlashCard/edusmart/Backend/apps/courses/models.py)**:
  * Add `Video` model (`title`, `uploader`, `raw_file_path`, `status` [pending, processing, ready, failed], `error_message`, `duration_seconds`, `hls_playlist_path`).
  * Add `video` ForeignKey to `Lesson` (nullable until ready).
  * Add `LessonSummary` model (`lesson` OneToOne, `content`, `attachment`, `created_at`, `updated_at`).
* **[MODIFY] [`Backend/apps/assessments/models.py`](file:///f:/FlashCard/edusmart/Backend/apps/assessments/models.py)**:
  * Add `pass_threshold` (default 50) and `lesson` (nullable ForeignKey) to `Exam`.
  * Add `is_passed` property/field to `StudentExam`.

#### 2. Celery Tasks & Video Transcoding
* **[NEW] [`Backend/apps/courses/tasks.py`](file:///f:/FlashCard/edusmart/Backend/apps/courses/tasks.py)**:
  * `transcode_video_to_hls_task`: Calls `ffmpeg` subprocess to produce 720p, 480p, 360p HLS playlists with 4s segment duration into private folder `MEDIA_ROOT/hls/{video_id}/`.
  * Updates `Video` status to `ready` or `failed` (with sanitized error logs).
  * Removes the raw source file upon success.

#### 3. Serializers & Views
* **[MODIFY] [`Backend/apps/courses/serializers.py`](file:///f:/FlashCard/edusmart/Backend/apps/courses/serializers.py)**:
  * Add `VideoSerializer`, `VideoChunkUploadSerializer`, `VideoCompleteUploadSerializer`.
  * Add `LessonSummarySerializer`.
  * Update `LessonSerializer` and `LessonWriteSerializer` to include `video` and `summary`.
* **[MODIFY] [`Backend/apps/courses/views.py`](file:///f:/FlashCard/edusmart/Backend/apps/courses/views.py)**:
  * Add `VideoViewSet` (chunked upload, status polling, listing ready videos for instructor).
  * Add `LessonSummaryViewSet` (CRUD for instructor, read for enrolled students).
  * Update `SignedStreamURLView` to issue signed HLS tokens for `Video` records.
* **[MODIFY] [`Backend/apps/courses/urls.py`](file:///f:/FlashCard/edusmart/Backend/apps/courses/urls.py)**:
  * Register `videos` and `summaries` endpoints.
* **[MODIFY] [`Backend/apps/assessments/views.py`](file:///f:/FlashCard/edusmart/Backend/apps/assessments/views.py)**:
  * Enforce strict server-side deadline calculation (`started_at + duration_minutes + 2 min grace`).
  * Add `attempts` list action on `ExamViewSet` for instructors to view all student attempts with pass/fail and scores.

---

### Frontend Changes

#### 1. API & Types
* **[MODIFY] [`Frontend/src/types/course.ts`](file:///f:/FlashCard/edusmart/Frontend/src/types/course.ts)**:
  * Add `VideoAsset`, `LessonSummary` interfaces.
* **[MODIFY] [`Frontend/src/features/courses/api.ts`](file:///f:/FlashCard/edusmart/Frontend/src/features/courses/api.ts)**:
  * Add `uploadVideoChunk`, `completeVideoUpload`, `getVideoStatus`, `getVideos`.
  * Add `getLessonSummary`, `saveLessonSummary`, `deleteLessonSummary`.
  * Add `reorderModules`, `reorderLessons`.
* **[MODIFY] [`Frontend/src/features/courses/hooks.ts`](file:///f:/FlashCard/edusmart/Frontend/src/features/courses/hooks.ts)**:
  * Add `useUploadVideo`, `useVideoStatus` (with `refetchInterval` while processing), `useLessonSummary`, `useSaveLessonSummary`.

#### 2. Components & Pages
* **[NEW] [`Frontend/src/components/video/ChunkedVideoUploader.tsx`](file:///f:/FlashCard/edusmart/Frontend/src/components/video/ChunkedVideoUploader.tsx)**:
  * Drag-and-drop / file selector with format/size validation.
  * Real chunk-by-chunk progress bar (5MB chunks).
  * Real-time polling indicator for transcoding status.
* **[NEW] [`Frontend/src/pages/instructor/InstructorCourseBuilder.tsx`](file:///f:/FlashCard/edusmart/Frontend/src/pages/instructor/InstructorCourseBuilder.tsx)**:
  * Unified course builder: Metadata tab, Curriculum Builder (Modules & Lessons reordering, Video attachment modal, Lesson Summary editor), Publish controls.
* **[MODIFY] [`Frontend/src/pages/LessonDetail.tsx`](file:///f:/FlashCard/edusmart/Frontend/src/pages/LessonDetail.tsx)**:
  * Integrate rich-text lesson summary and downloadable PDF in "Overview/Summary" tab.
  * Handle automatic player token re-authentication.
* **[MODIFY] [`Frontend/src/components/video/SecureVideoPlayer.tsx`](file:///f:/FlashCard/edusmart/Frontend/src/components/video/SecureVideoPlayer.tsx)**:
  * Add token refresh callback if stream returns 403 or on token expiry.
* **[NEW] [`Frontend/src/pages/exam/ExamResult.tsx`](file:///f:/FlashCard/edusmart/Frontend/src/pages/exam/ExamResult.tsx)**:
  * Student exam result screen with score badge, pass/fail result, and explanations for practice exams.
* **[MODIFY] [`Frontend/src/pages/instructor/InstructorExamManagement.tsx`](file:///f:/FlashCard/edusmart/Frontend/src/pages/instructor/InstructorExamManagement.tsx)**:
  * Add student attempt results view for instructors.

#### 3. Localization (i18n)
* **[MODIFY] [`Frontend/src/locales/ar/common.json`](file:///f:/FlashCard/edusmart/Frontend/src/locales/ar/common.json)** and **[`Frontend/src/locales/en/common.json`](file:///f:/FlashCard/edusmart/Frontend/src/locales/en/common.json)**:
  * Add full translation keys for Video upload, Course builder, Summaries, and Exam results.

---

## Part 5: Verification & Quality Gates Plan

### 1. Automated Tests
* **Backend Django Tests**:
  * `apps.courses.tests.test_video_upload_and_transcoding`: Tests chunked upload, invalid file rejection, Celery task status transitions, and Nginx `secure_link` token verification.
  * `apps.courses.tests.test_course_builder_and_summaries`: Tests module/lesson CRUD, reordering, draft/published student gating, summary permissions.
  * `apps.assessments.tests.test_exam_engine_and_server_grading`: Tests auto-grading, pass threshold calculation, server-side timer enforcement, attempt blocking.
* **Frontend Tests**:
  * `npm run typecheck` (`tsc --noEmit`) - must pass with 0 errors.
  * `npm run lint` (`eslint .`) - must pass with 0 errors.
  * `npm run test` (`vitest run`) - all test suites must pass.

### 2. End-to-End Manual Verification Workflow
1. **Video Upload Flow**: Upload sample video in chunks → Celery processes renditions (720p/480p/360p) → Status becomes `ready` → Student plays via signed token.
2. **Course Builder Flow**: Create course → Add modules and lessons → Reorder items → Attach processed video → Toggle publish → Verify student sees only published content.
3. **Summary Flow**: Instructor writes summary with PDF attachment → Enrolled student views summary and downloads PDF → Non-enrolled student is blocked.
4. **Exam Flow**: Instructor creates exam with multiple-choice + true/false questions and 60% pass threshold → Student starts attempt → Timer enforces submission → Server auto-grades accurately → Result displays pass/fail immediately and logs to instructor dashboard.
