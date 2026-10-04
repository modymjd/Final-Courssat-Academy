# Courssat Academy — Production Execution Loop

## Purpose

This document is the execution control for the production-stabilization program. Work is performed in small, verifiable loops rather than by making broad unverified changes.

## Mandatory Loop

For every work item:

1. **Inspect** the current implementation and its callers/tests/configuration.
2. **Define the contract** before changing behavior.
3. **Implement the smallest complete production-safe change.**
4. **Run the narrowest relevant verification.**
5. **Run regression verification** for affected layers.
6. **Inspect the resulting diff** for accidental behavior, security, naming, or compatibility regressions.
7. **Commit the change** with an explicit message.
8. **Re-check CI status** before advancing to the next dependent item.
9. **Record evidence** in the phase tracker.
10. **Only then move to the next item.**

A failing gate is a stop condition. It is not a reason to weaken the test, silence the checker, or mark the phase complete.

## Phase Tracker

| Phase | Scope | Status | Exit Gate |
|---|---|---|---|
| 0 | Change control + production gate | **IN PROGRESS** | Deploy cannot run when quality gate fails |
| 1 | Canonical API contract | PENDING | OpenAPI + frontend types agree |
| 2 | Backend data/serializer/state validation | PENDING | Migration, serializer and state tests green |
| 3 | Frontend integration + React Query | PENDING | Typecheck/lint/tests/build green |
| 4 | Authentication + authorization + security | PENDING | Permission matrix and regression tests green |
| 5 | Video/upload/storage pipeline | PENDING | Browser-to-HLS E2E passes |
| 6 | Payments + financial integrity | PENDING | Production config is fail-closed and tested |
| 7 | Redis/Celery/cache/background jobs | PENDING | Worker/beat and cache behavior verified |
| 8 | Docker/Nginx/SSL/DNS/runtime | PENDING | Production smoke suite passes |
| 9 | CI/CD + release engineering | **IN PROGRESS** | Quality gate is blocking deployment |
| 10 | Documentation + final audit | PENDING | No known P0/P1 defects and all gates green |

## Non-Negotiable Rules

- Never use `|| true` to hide a quality-gate failure.
- Never weaken a security test merely to make CI green.
- Never introduce a second API contract when the canonical contract already exists.
- Never use production defaults for secrets, payment credentials, localhost URLs, or signing keys.
- Never deploy from a commit whose required quality gate is failing.
- Never declare production-ready based only on a successful build.

## Definition of Done

The platform is considered production-ready only when all of the following are true:

- Backend lint, type checking, and tests pass.
- Frontend generated-contract check, type checking, lint, tests, and build pass.
- API contract has one canonical representation.
- Database migrations are deterministic and applied successfully.
- Authorization behavior is covered by regression tests.
- Authentication/session/security controls are covered by regression tests.
- Video upload, processing, signed playback, and unauthorized access paths are verified.
- Payment configuration is explicitly production-configured and fail-closed.
- Redis/Celery/cache behavior is verified in production topology.
- Docker Compose configuration is valid and health checks are meaningful.
- Nginx configuration and TLS certificate renewal topology are consistent.
- Public HTTPS, CORS, security headers, API health, and frontend health smoke tests pass.
- CI/CD prevents deployment when any required gate fails.
- No known P0/P1 defect remains open.
