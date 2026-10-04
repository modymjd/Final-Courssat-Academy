# mkanak — Backend

Django 5 + DRF + PostgreSQL API for the mkanak / EduSmart platform.

## Quick start

```bash
cd Backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env         # then edit DB_* to match your local Postgres

# Create the database (one-time)
createdb -U postgres mkanak

python manage.py migrate
python manage.py seed_demo    # loads demo users, categories, courses, enrollments
python manage.py runserver 0.0.0.0:8000
```

Demo accounts created by `seed_demo`:

| Role       | Email                | Password    |
|------------|----------------------|-------------|
| student    | student@mkanak.dev   | Passw0rd!   |
| instructor | instructor@mkanak.dev| Passw0rd!   |
| admin      | admin@mkanak.dev     | Passw0rd!   |

## API

- `GET  /api/schema/`               — OpenAPI schema (JSON)
- `GET  /api/docs/`                 — Swagger UI
- `POST /api/v1/auth/register/`     — Student self-registration
- `POST /api/v1/auth/login/`        — JWT login (email + password)
- `POST /api/v1/auth/refresh/`      — Refresh access token
- `POST /api/v1/auth/logout/`       — Blacklist refresh token
- `GET  /api/v1/auth/me/`           — Current user

Full route list is under `/api/docs/`.

## Project layout

```
Backend/
├── manage.py
├── requirements.txt
├── .env.example
├── config/
│   ├── settings/{base,development,production}.py
│   ├── urls.py
│   └── wsgi.py / asgi.py
└── apps/
    ├── common/           # base model, pagination, permissions
    ├── accounts/         # User, Student, Instructor, Admin profiles, JWT auth
    ├── courses/          # Category, Course, Module, Lesson, Review
    ├── enrollments/      # Enrollment, lesson completion
    ├── assessments/      # Grade
    ├── notifications/    # Notification
    ├── messaging/        # Conversation, Message
    ├── live_sessions/    # LiveSession
    ├── calendar_events/  # CalendarEvent
    └── certificates/     # Certificate
```
