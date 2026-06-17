# RihlaTech

AI-powered travel planning platform — KSU IS498 Capstone Project.

**Slogan:** Powered by AI, driven by you.

Users register, complete a logistics quiz and personalization preferences, then receive a day-by-day AI-generated itinerary. The result page links each activity to Google Maps for navigation. Flights, hotels, community features, and admin tools are planned for later phases.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, shadcn/ui, Framer Motion |
| Backend | FastAPI, SQLAlchemy |
| Database | PostgreSQL 16 (Docker) |
| Auth | JWT (python-jose) + bcrypt |
| AI | Gemini, OpenRouter, or OpenAI (`LLM_PROVIDER` in `.env`) |
| Maps | Mapbox (city autocomplete, backend geocoding) + Google Maps deep-links on result page |

See [plan.md](plan.md) for the full development roadmap, API reference, and handoff notes.

## Prerequisites

- Node.js 18+
- Python 3.11+
- Docker Desktop (for PostgreSQL)
- API keys: `JWT_SECRET`, at least one LLM key, Mapbox token (see `.env.example`)

## Setup

1. **Environment**

   ```bash
   cp .env.example .env
   ```

   Fill in at minimum:
   - `JWT_SECRET`
   - `GEMINI_API_KEY` (recommended) or another LLM key
   - `MAPBOX_ACCESS_TOKEN` (backend city search + geocoding)

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
- **My Trips:** list, reopen, or delete past itineraries
- **Result:** AI itinerary with real venue names; **Open in Maps** per activity; **Day route** (Google Maps driving directions through that day's stops)
- **Ask AI:** chatbot sidebar — ask questions, request itinerary edits, confirm with **Apply** or "yes"

## Project structure

```
src/
  pages/               Landing, quiz, preferences, destination picker, trip result, my trips
  components/trip/     ChatbotSidebar, PlaceLocationPicker, TripMap (legacy), QuestionFlow
  components/auth/     Login/register
  components/layout/   Navbar, Footer
  lib/                 API client, auth, trips, places, mapDirections
backend/
  app/
    routers/           auth, quiz, trips, places, chat, health
    services/          llm, itinerary, destinations, geocoding, edit, apply_edit, chat
    models/            user, trip_plan, place, chat_message, question
```

## Current progress

| Phase | Status | Summary |
|---|---|---|
| 0 — Setup | ✅ | FastAPI, PostgreSQL Docker, Vite proxy |
| 1 — Auth | ✅ | Register, login, JWT, protected routes |
| 2 — Quiz | ✅ | Quiz + preferences, AI destination suggestions |
| 3 — Itinerary | ✅ | LLM day-by-day generation, places in DB, result page |
| 4 — Map | ✅ | Mapbox geocoding, city autocomplete, embedded map (legacy) |
| 5 — Edit & chat | ✅ | My Trips, chatbot, apply-edit, alternatives, Maps deep-links |
| 6 — Flights/hotels | — | Duffel + Booking deep-links |
| 7 — Community | — | Share, vote, comment |
| 8 — Admin/deploy | — | Dashboard + cloud hosting |

## What's working end-to-end

- Register / log in
- Full quiz → preferences → itinerary generation (Gemini recommended)
- "Not sure" destination path with AI city suggestions
- Mapbox city search when typing **origin** or **destination**
- Trip result with real AI activities and venue names
- **My Trips** — persist, reopen, delete trips; page restore via `localStorage`
- **Chatbot** — persistent history, propose edits, Apply / "yes" to update itinerary
- **Explore Alternatives** — LLM-generated destination alternatives (not activity swaps)
- **Google Maps deep-links** — open venue in Maps; per-day driving route; leg-by-leg between stops
- Light mode default; dark mode toggle

## Known limitations

- **Mobile layout** — desktop-first; responsive polish planned next
- **Flights / hotels** — not wired yet (Phase 6)
- **Community / admin** — not started (Phases 7–8)
- **Embedded map** (`TripMap.tsx`) — not used on result page; deep-links preferred for FYP demo
- Explore Alternatives suggests other **destinations**, not swapping individual activities

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
