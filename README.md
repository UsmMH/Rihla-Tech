<div align="center">

# RihlaTech

**Powered by AI, driven by you.**

[![Capstone](https://img.shields.io/badge/KSU-IS498-Capstone-1e4b88?style=flat-square)]()
[![React](https://img.shields.io/badge/React_18-61DAFB?style=flat-square&logo=react&logoColor=black)]()
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)]()
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-4169E1?style=flat-square&logo=postgresql&logoColor=white)]()
[![AI](https://img.shields.io/badge/AI-Gemini_·_OpenRouter-8B5CF6?style=flat-square)]()

*King Saud University — IS498 Final Year Project*

</div>

---

## What is it?

Planning a trip means juggling dates, budgets, destinations, and dozens of tabs — most tools either feel generic or leave you doing the heavy lifting. **RihlaTech** is a web app that turns a short quiz and your preferences into a personalized, day-by-day itinerary in minutes. An AI travel companion helps you refine the plan, and every activity links straight to Google Maps for navigation.

---

## Key features

- **Smart quiz & preferences** — logistics (dates, travelers, budget) plus trip style and pace
- **AI itinerary generation** — real venue names, themed days, activities saved to your account
- **“Not sure” destination path** — AI-suggested cities when you haven’t picked one yet
- **Home dashboard** — plan a new trip, ask AI for travel advice, recent trips
- **My Trips** — list, reopen, and delete past itineraries (in-app delete confirmation)
- **Trip chatbot** — context-aware Q&A, propose edits, confirm with **Apply** or “yes”
- **Home consult chat** — general travel Q&A before you start planning
- **Flights & hotels** — Duffel sandbox flight options + hotel cards with Booking.com links (when enabled in quiz)
- **Collapsible trip result** — flights, hotels, and each day expand on demand with horizontal activity cards
- **Google Maps links** — open any activity in Maps; per-day driving routes between stops
- **App shell** — Home · My Trips · Community (coming soon); Profile on desktop nav + mobile header icon
- **Light-mode auth** — login and register match the app’s default light theme

> Full roadmap and API reference: [plan.md](plan.md)

---

## User flow

```
Login → Home dashboard
          ├─ Plan new trip → Quiz → Preferences → [AI destination picker] → Trip result
          ├─ Ask AI (consult) — travel tips without a trip yet
          └─ My Trips → reopen any itinerary

Trip result → Flights / Hotels (if enabled) → Day-by-day itinerary
            → Ask AI (trip chat) → propose edit → Apply / "yes"
            → Open in Maps / Day route → Back to My Trips
```

| Step | What happens |
|------|----------------|
| **Quiz** | Dates, travelers, origin/destination, budget, flight/hotel toggles |
| **Preferences** | Trip purpose, theme, pace, and personalization |
| **Destination picker** | Shown only when destination is “not sure” — AI city suggestions |
| **Result** | Collapsible flights, hotels, and days; Maps deep-links per activity |
| **Chat** | Trip-tied edits on result page; general consult from Home |

---

## Architecture

```mermaid
flowchart TB
    subgraph Client["Browser (React + Vite)"]
        UI[Pages & components]
        UI --> API_CLIENT[API client / JWT]
    end

    subgraph Server["FastAPI backend"]
        ROUTERS[Routers: auth · quiz · trips · places · chat]
        SERVICES[Services: LLM · itinerary · flights · hotels · chat]
        ROUTERS --> SERVICES
    end

    subgraph Data["Data & external APIs"]
        PG[(PostgreSQL 16)]
        LLM[Gemini / OpenRouter / OpenAI]
        DUFFEL[Duffel sandbox]
    end

    API_CLIENT -->|REST /api| ROUTERS
    SERVICES --> PG
    SERVICES --> LLM
    SERVICES --> DUFFEL

    UI -.->|deep-links| GMAPS[Google Maps]
    UI -.->|deep-links| BOOKING[Booking.com]
```

---

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, Tailwind CSS, shadcn/ui, Framer Motion |
| Backend | FastAPI, SQLAlchemy |
| Database | PostgreSQL 16 (Docker) |
| Auth | JWT (python-jose) + bcrypt |
| AI | Gemini, OpenRouter, or OpenAI (`LLM_PROVIDER` in `.env`) |
| Flights | Duffel sandbox (`DUFFEL_ACCESS_TOKEN`) + Google Flights deep-links |
| Hotels | Mock suggestions + Booking.com deep-links |
| Navigation | Google Maps deep-links (per activity and per-day routes) |
| Geocoding | Mapbox Search Box + geocoding v5 (backend) |

---

## Progress

| Phase | Status | Summary |
|-------|--------|---------|
| 0 — Setup | ✅ | FastAPI, PostgreSQL Docker, Vite proxy |
| 1 — Auth | ✅ | Register, login, JWT, protected routes |
| 2 — Quiz | ✅ | Quiz + preferences, AI destination suggestions |
| 3 — Itinerary | ✅ | LLM day-by-day generation, places in DB, result page |
| 4 — Maps | ✅ | City search, Google Maps deep-links on result page |
| 5 — Edit & chat | ✅ | My Trips, chatbot, apply-edit, itinerary updates |
| 5b — App shell & mobile | ✅ | Home dashboard, profile, consult chat, responsive pass |
| 6 — Flights/hotels | ✅ | Duffel sandbox + mock fallback; Booking.com deep-links |
| 6b — UX polish | ✅ | Collapsible result, light auth, nav + delete dialog |
| 7 — Community | — | Share, vote, comment |
| 8 — Admin/deploy | — | Dashboard + cloud hosting |

---

## Setup

### Prerequisites

- Node.js 18+
- Python 3.11+
- Docker Desktop (PostgreSQL)
- API keys — see `.env.example`

### Run locally

```bash
# 1. Environment
cp .env.example .env
# Fill in JWT_SECRET, LLM keys, MAPBOX_ACCESS_TOKEN, DUFFEL_ACCESS_TOKEN (optional)

# 2. Dependencies
npm install
cd backend && python -m venv .venv
.venv\Scripts\pip install -r requirements.txt          # Windows
# source .venv/bin/activate && pip install -r requirements.txt   # macOS/Linux

# 3. Database (host port 5433, not 5432)
docker compose up -d

# 4. Backend
cd backend
.\.venv\Scripts\uvicorn app.main:app --reload --port 8000

# 5. Frontend (new terminal, repo root)
npm run dev
```

Open **http://localhost:5173**

Restart **both** backend and `npm run dev` after changing `.env` (Vite reads `VITE_*` only at startup).

### Scripts

```bash
npm run dev          # Frontend dev server
npm run build        # Production build
npm run typecheck    # TypeScript check

# Backend (from backend/)
.\.venv\Scripts\python scripts\test_llm.py
.\.venv\Scripts\python scripts\test_generate_flow.py
```

---

## Health checks

| URL | Purpose |
|-----|---------|
| http://localhost:5173/api/health | DB connected |
| http://localhost:8000/api/health/llm | LLM provider configured |
| http://localhost:8000/api/health/duffel | Duffel token configured |
| http://localhost:8000/docs | Interactive API docs |

---

## Project structure

```
src/
  pages/               Home dashboard, quiz, preferences, trip result, my trips, profile
  components/trip/     ChatbotSidebar, QuestionFlow, OriginCityInput
  components/layout/   Navbar, AppBottomNav
  components/auth/     AuthLayout (light mode login/register)
  lib/                 API client, auth, trips, places, mapDirections
backend/
  app/
    routers/           auth, quiz, trips, places, chat, health
    services/          llm, itinerary, flights, hotels, edit, chat, consult_chat
    models/            user, trip_plan, place, chat_message, question
```

---

## Known limitations

- **Community / admin** — not started (Phases 7–8)
- **Consult chat** — session history is client-side only; not persisted to the database
- **Hotels** — mock cards with Booking.com links (no live hotel API)

---

## License

Academic capstone project — KSU IS498. Not licensed for commercial use.
