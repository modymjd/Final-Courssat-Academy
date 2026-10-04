# EduSmart

**منصة التعليم الإلكتروني المتكاملة**

Enterprise-grade educational platform built with modern web technologies.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui
- **State**: TanStack React Query, React Context
- **Animation**: Framer Motion
- **Charts**: Recharts

## Getting Started

```bash
cp .env.example .env      # then edit VITE_API_URL if your backend runs elsewhere
npm install
npm run dev
```

The backend is expected at `http://localhost:8000/api/v1` by default. Start it with:

```bash
cd ../Backend
.venv/Scripts/python.exe manage.py runserver 127.0.0.1:8000
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Architecture

```
src/
├── app/           # App shell, providers
├── components/    # UI components (ui/, common/, layout/, course/, auth/)
├── features/      # Feature modules (auth, courses, users, notifications)
├── hooks/         # Shared React hooks
├── lib/           # Utilities, constants, API client
├── pages/         # Page components
├── services/      # Mock API services
└── types/         # TypeScript interfaces
```

## License

Copyright © 2024-2026 NERVA X. All rights reserved.
