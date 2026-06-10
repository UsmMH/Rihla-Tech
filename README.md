# RihlaTech

AI-powered travel planning platform — KSU IS498 Capstone Project.

**Slogan:** Powered by AI, driven by you.

Users register, complete a logistics quiz and personalization preferences, then receive a day-by-day AI-generated itinerary with an interactive map. Flights, hotels, community features, and admin tools are planned for later phases.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, shadcn/ui, Framer Motion |
| Backend | FastAPI, SQLAlchemy |
| Database | PostgreSQL 16 (Docker) |
| Auth | JWT (python-jose) + bcrypt |
| AI | Gemini, OpenRouter, or OpenAI (`LLM_PROVIDER` in `.env`) |
| Maps | Mapbox GL JS + Mapbox Geocoding API |

See [plan.md](plan.md) for the full development roadmap, API reference, and handoff notes.

## Prerequisites

- Node.js 18+
- Python 3.11+
- Docker Desktop (for PostgreSQL)
- API keys: `JWT_SECRET`, at least one LLM key, Mapbox tokens (see `.env.example`)

## Setup

1. **Environment**

   ```bash
   cp .env.example .env
   ```

   Fill in at minimum:
   - `JWT_SECRET`
   - `GEMINI_API_KEY` (recommended) or another LLM key
   - `MAPBOX_ACCESS_TOKEN` and `VITE_MAPBOX_ACCESS_TOKEN` (same public `pk.…` token is fine)

2. **Install dependencies**

   ```bash
   npm install
   cd backend
   python -m venv .venv
   .venv\Scripts\pip install -r requirements.txt   # Windows
   # source .venv/bin/activate && pip install -r requirements.txt   # macOS/Linux
   ```

3. **Start PostgreSQL**

   ```bash
   docker compose up -d
   ```

   Postgres runs on host port **5433** (not 5432).

4. **Backend**

   ```bash
   cd backend
   .venv\Scripts\uvicorn app.main:app --reload --port 8000
   ```

5. **Frontend**

   ```bash
   npm run dev
   ```

   Open http://localhost:5173

Restart **both** backend and `npm run dev` after changing `.env` (Vite reads `VITE_*` vars only at startup).

## Health checks

| URL | Purpose |
|---|---|
| http://localhost:5173/api/health | DB connected |
| http://localhost:8000/api/health/llm | LLM provider configured |
| http://localhost:8000/api/health/mapbox | Mapbox geocoding configured |
| http://localhost:8000/docs | Interactive API docs |

## User flow

```
Landing → Quiz → Preferences → [AI destination picker if "not sure"] → Trip result
```

- **Quiz:** dates, travelers, origin/destination (Mapbox city autocomplete), budget, flights/hotels toggles
- **Preferences:** trip purpose, theme, pace, etc.
- **Result:** AI itinerary (morning / afternoon / evening per day), interactive map with pins, activity cards linked to map pins

## Project structure

```
src/
  pages/               Landing, quiz, preferences, destination picker, trip result
  components/trip/     TripMap, OriginCityInput, QuestionFlow, ChatbotSidebar (stub)
  components/auth/     Login/register
  components/layout/   Navbar, Footer
  lib/                 API client, auth, trips, places, mapbox setup
  data/                Static seed data (alternatives section only)
backend/
  app/
    routers/           auth, quiz, trips, places, health
    services/          llm, itinerary, destinations, geocoding
    models/            user, trip_plan, place, question
```

## Current progress

| Phase | Status | Summary |
|---|---|---|
| 0 — Setup | ✅ | FastAPI, PostgreSQL Docker, Vite proxy |
| 1 — Auth | ✅ | Register, login, JWT, protected routes |
| 2 — Quiz | ✅ | Quiz + preferences, AI destination suggestions |
| 3 — Itinerary | ✅ | LLM day-by-day generation, places in DB, result page |
| 4 — Map | ✅ | Mapbox geocoding, trip map, city autocomplete, card↔pin UI |
| 5 — Edit & chat | 🔜 | Trip history, chatbot, edit flow, dynamic alternatives |
| 6 — Flights/hotels | — | Duffel + Booking deep-links |
| 7 — Community | — | Share, vote, comment |
| 8 — Admin/deploy | — | Dashboard + cloud hosting |

## What's working end-to-end

- Register / log in
- Full quiz → preferences → itinerary generation (Gemini recommended)
- "Not sure" destination path with AI city suggestions
- Mapbox city search when typing **origin** or **destination**
- Trip result with real AI activities (not static demo data)
- Interactive map: pins per activity, day-colored route lines, click card ↔ pin
- Activity cards with category icons (no misleading stock photos)

## Known limitations

- **No trip history yet** — refreshing the page loses the current trip (Phase 5)
- **Edit Trip** starts a new quiz instead of editing the existing plan (Phase 5)
- **Chatbot** UI exists but is not wired to the API (Phase 5)
- **Map routes** are straight lines, not walking/driving directions
- **Explore Alternatives** on the result page uses static demo data (Phase 5)

## Scripts

```bash
npm run dev          # Frontend dev server
npm run build        # Production build
npm run typecheck    # TypeScript check

# Backend (from backend/)
.\.venv\Scripts\python scripts\test_llm.py
.\.venv\Scripts\python scripts\test_generate_flow.py
```

## License

Academic capstone project — KSU IS498.
