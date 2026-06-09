# RihlaTech

AI-powered travel planning platform — KSU IS498 Capstone Project.

**Stack:** React (Vite) · FastAPI · PostgreSQL · OpenAI (planned)

## Prerequisites

- Node.js 18+
- Python 3.11+
- Docker Desktop (for PostgreSQL)

## Setup

1. **Clone and install**

   ```bash
   cp .env.example .env
   npm install
   ```

2. **Start PostgreSQL**

   ```bash
   docker compose up -d
   ```

3. **Backend**

   ```bash
   cd backend
   python -m venv .venv
   .venv\Scripts\pip install -r requirements.txt   # Windows
   .venv\Scripts\uvicorn app.main:app --reload --port 8000
   ```

4. **Frontend**

   ```bash
   npm run dev
   ```

   Open http://localhost:5173

## Project structure

```
src/
  components/layout/   Navbar, Footer, LogoMark
  components/trip/     Trip-specific UI (chatbot sidebar)
  components/auth/     Login/register layout
  components/ui/       Shared UI primitives (shadcn)
  contexts/            Auth + theme providers
  data/                Static seed data (until API wired)
  lib/                 API client, auth, navigation, trip stubs
  pages/               Route-level pages
  themes.ts            Light/dark design tokens
backend/
  app/                 FastAPI application
```

## API docs

With the backend running: http://localhost:8000/docs

## Current progress

- Phase 0: Project setup, health check, PostgreSQL
- Phase 1: User registration, login, JWT auth
- Phase 2+: Quiz, preferences, AI trip generation (next)
