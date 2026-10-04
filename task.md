# Pilot Launch Task Tracker

## Exam and progression

- [x] Persist True/False `false` as a valid correct answer.
- [x] Enforce exactly one correct option for objective questions.
- [x] Persist strict-proctoring and difficulty settings.
- [x] Prevent answer-key leakage in student attempt snapshots.
- [x] Keep essay attempts pending until instructor grading.
- [x] Recalculate score/pass state after manual essay grading.
- [x] Trigger lesson progression after final grading.
- [x] Add focused backend integration tests.
- [x] Resolve TypeScript errors in the touched exam files.
- [x] Audit the remaining exam attempt, result and grading API contracts.

## Authentication and roles

- [x] Fix `.test` email authentication being affected by test-only hashers.
- [x] Clear stale frontend tokens after rejected authentication.
- [x] Audit registration role handling and role-based redirects.
- [x] Confirm regression coverage for instructor/student registration and login.

## Course, media and enrollment

- [x] Add question image upload and WebP conversion.
- [x] Enforce lesson progression access on lesson/progress/stream endpoints.
- [x] Audit instructor course builder API contracts.
- [x] Audit video upload, processing status, failure and playback flow.
- [x] Audit student enrollment and protected lesson access end to end.

## Infrastructure and production

- [x] Add and statically validate `docker-compose.local.yml` in the project deliverable.
- [x] Statically validate production Compose configuration and health checks.
- [x] Audit required production environment variables and unsafe defaults.
- [x] Validate backup and restore script syntax and safety gates.
- [x] Add a concise production deployment/runbook.

## Quality gate and delivery

- [x] Run static contract and unfinished-action audit.
- [/] Run focused backend pilot integration tests (requires the user's Docker runtime).
- [/] Run frontend TypeScript and production build (requires the user's Docker runtime).
- [x] Produce a clean update archive and checksums.
- [x] Produce `walkthrough.md` in Arabic.