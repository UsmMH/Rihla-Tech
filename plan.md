# RihlaTech — Development Plan & Handoff

> **Purpose:** Continue development in a new chat without losing context.  
> **Last updated:** June 2026 · Phases 0–1 complete, Phase 2 next.

---

## Project summary

**RihlaTech** is an AI-powered travel planning web app (KSU IS498 FYP). Users register, answer a logistics quiz + personalization preferences, and receive a day-by-day AI itinerary (flights/hotels optional). Includes chatbot, map, community sharing, and admin panel (later).

**Slogan:** Powered by AI, driven by you.

**PRD:** Full requirements doc exists separately (FYP_PRD_Final.pdf). Documentation is the source of truth over the original Replit mockup.

---

## Tech stack (decided)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React 18 + Vite + Tailwind + shadcn/ui | `src/` |
| Backend | FastAPI + SQLAlchemy | `backend/app/` |
| Database | PostgreSQL 16 (Docker) | Port **5433** (5432 conflicts with local Windows Postgres) |
| Auth | JWT (python-jose) + bcrypt | 7-day token expiry |
| AI | OpenAI first (GPT-4o / mini) | Provider abstraction later |
| Maps | Google Places + Mapbox or Google Maps JS | Free tiers for FYP demo |
| Flights/Hotels | Duffel API when keys ready; mock data as fallback | Amadeus self-service shuts down July 2026 |
| Vector DB | Defer — Postgres + pgvector only if needed later | |

---

## How to run locally

```bash
# 1. Env
cp .env.example .env   # fill JWT_SECRET

# 2. Database
docker compose up -d

# 3. Backend
cd backend
.\.venv\Scripts\uvicorn app.main:app --reload --port 8000

# 4. Frontend
npm run dev
```

- App: http://localhost:5173  
- API docs: http://localhost:8000/docs  
- Health: http://localhost:5173/api/health → `{"status":"ok","database":"connected"}`

---

## Repository state

- **Git:** initialized, first commit on `master` (`6784e53`)
- **Not committed:** `.env`, `node_modules/`, `backend/.venv/`
- **GitHub:** not pushed yet — user to add remote and push

---

## Project structure

```
Rihla-Tech/
├── backend/app/
│   ├── main.py              # FastAPI app, CORS, create_all on startup
│   ├── config.py            # Settings from .env
│   ├── database.py          # SQLAlchemy engine + get_db
│   ├── models/user.py       # users table
│   ├── routers/
│   │   ├── health.py        # GET /api/health
│   │   └── auth.py          # register, login, me
│   ├── services/auth.py     # hash password, JWT, create user
│   └── dependencies/auth.py # get_current_user (Bearer token)
├── src/
│   ├── App.tsx              # Auth routing: /login, /register, / → HomePage
│   ├── pages/
│   │   ├── HomePage.tsx     # Trip flow: landing → quiz → result
│   │   ├── LandingPage.tsx
│   │   ├── OnboardingQuiz.tsx   # Static quiz (Phase 2 will split)
│   │   ├── TripResult.tsx
│   │   ├── LoginPage.tsx
│   │   └── RegisterPage.tsx
│   ├── components/layout/   # Navbar (auth-aware), Footer, LogoMark
│   ├── components/trip/     # ChatbotSidebar
│   ├── contexts/            # AuthContext, ThemeContext
│   ├── data/                # Static mock data (replace in Phase 2+)
│   └── lib/
│       ├── api.ts           # apiFetch + ApiError
│       ├── auth.ts          # login, register, fetchMe, token storage
│       ├── navigation.ts    # client-side navigate()
│       └── trips.ts         # Trip API stubs (not wired yet)
├── docker-compose.yml       # Postgres on host port 5433
├── .env.example
└── README.md
```

---

## Completed phases

### Phase 0 — Project setup ✅

- FastAPI backend scaffold
- PostgreSQL via Docker Compose (port 5433)
- Vite proxy `/api` → `localhost:8000`
- `GET /api/health` with DB connection check
- `.env.example`, `.gitignore`

### Phase 1 — Authentication ✅

**Backend endpoints:**

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Create account → JWT |
| POST | `/api/auth/login` | No | Sign in → JWT |
| GET | `/api/auth/me` | Bearer | Current user |

**User model (`users`):** `id`, `email`, `password` (bcrypt hash), `first_name`, `last_name`, `phone_num`, `is_admin`, `created_at`

**Frontend:**

- Login / Register pages with RihlaTech branding
- `AuthContext` — token in `localStorage` (`rihlatech_token`, `rihlatech_user`)
- Protected `/` — unauthenticated users → `/login`
- Navbar shows user name + Log out when authenticated

**UI cleanup done:**

- Removed Replit artifacts (`mockupPreviewPlugin`, `/preview/*` routes, `.replit-artifact`)
- Moved UI from `src/components/mockups/rihlaTech/` → proper `src/pages/`, `src/components/layout/`, etc.
- Navbar: removed Pricing; links scroll to Features / How it Works / Destinations
- Footer simplified; fake stats/links removed
- `index.html` branded as RihlaTech

---

## Product decisions (agreed — follow these in Phase 2+)

### Quiz vs preferences (two-step flow)

| Step | `phase` field | Content |
|---|---|---|
| **Quiz** | `"quiz"` | Logistics: dates, destination (or "not sure"), adults/kids, origin city |
| **Preferences** | `"preferences"` | Personal: trip purpose (fun/heal/explore), theme (historical/modern/natural), budget tier, include flights/hotels toggles |

Keep one `Question` table in ERD; distinguish with `phase` column — don't split into two entities.

### Budget tiers

Three tiers: **Eco** / **Mid** / **Luxury** (not dollar ranges for now).

### Itinerary shape

Day-by-day with time slots:

```
Day 1
  morning:   activity
  afternoon: activity
  evening:   activity
```

`PLACE` entity gets `time_slot` attribute (`morning` | `afternoon` | `evening`).

### Uncertain travelers

- Quiz: "Do you know your destination?" → Yes / Not sure
- If not sure → preferences → AI returns **3 cities + short blurb** (no extra DB table; API response only)
- User picks one → full itinerary generated

### Trip plan fields to add (ERD gaps — implement in Phase 2)

On `TRIP_PLAN`: `start_date`, `end_date`, `num_adults`, `num_children`, `include_flights`, `include_hotels`, `origin`

### Deferred

- Email verification on register (demo uses simple signup)
- Chat message history table (optional user preference blob later)
- Arabic / RTL
- Admin panel (Phase 8)
- Alembic migrations (using `create_all` for now; add Alembic when schema grows)
- Community features (Phase 7)

### MVP build order

1. Auth ✅  
2. Quiz + preferences + AI itinerary + map  
3. Edit trip + chatbot  
4. Flights/hotels + deep-links  
5. Community  
6. Admin  

---

## Phase 2 — Next up (Quiz + Preferences)

**Goal:** Two-step data collection matching the activity diagram; answers saved in DB.

### Backend tasks

- [ ] Models: `Question`, `Answer`, `QuizResponse` (or equivalent), `TripPlan` (minimal)
- [ ] Seed questions with `phase: "quiz"` and `phase: "preferences"`
- [ ] `GET /api/quiz/questions?phase=quiz|preferences`
- [ ] `POST /api/quiz/submit` — save answers linked to user
- [ ] `POST /api/trips/suggest-destinations` — when destination unknown (OpenAI, 3 cities + blurb)

### Frontend tasks

- [ ] Split `OnboardingQuiz.tsx` into **QuizPage** + **PreferencesPage**
- [ ] Update `HomePage.tsx` flow: `landing → quiz → preferences → [destination picker?] → result`
- [ ] Fetch questions from API instead of `src/data/quizSteps.ts`
- [ ] Wire `src/lib/trips.ts` stubs to real endpoints as they're built

### Exit criteria

User logs in → completes quiz + preferences → answers persisted in PostgreSQL.

---

## Phase 3 — AI trip generation

- [ ] `TRIP_PLAN` + `PLACE` tables with `time_slot`, `date`, `order`, lat/lng
- [ ] `POST /api/trips/generate` — OpenAI structured JSON itinerary
- [ ] `GET /api/trips/:id`
- [ ] Replace static `src/data/itinerary.ts` in `TripResult.tsx`

---

## Phase 4 — Map + places

- [ ] Google Places enrichment for lat/lng, ratings
- [ ] Map component with itinerary pins

---

## Phase 5 — Edit + chatbot

- [ ] `POST /api/trips/:id/edit` — natural language → 3 alternatives
- [ ] `POST /api/chat/message` — OpenAI with trip context
- [ ] Wire `ChatbotSidebar.tsx` to real API

---

## Phase 6 — Flights, hotels, deep-links

- [ ] Duffel integration (or mock + real deep-link URLs)
- [ ] Only when `include_flights` / `include_hotels` true in preferences

---

## Phase 7 — Community

- [ ] `COMMUNITY_POST`, share, save, vote, comment

---

## Phase 8 — Admin + deployment

- [ ] Admin dashboard
- [ ] Deploy to cloud (Railway / Render / university server — TBD)

---

## API keys needed (not yet obtained)

- `OPENAI_API_KEY`
- `GOOGLE_PLACES_API_KEY`
- `DUFFEL_ACCESS_TOKEN` (optional for Phase 6)

Add to `.env` when ready; never commit `.env`.

---

## Known gotchas

1. **Postgres port:** Docker maps `5433:5432` because Windows local Postgres uses 5432.
2. **Backend restart:** Required after `.env` changes.
3. **Tables:** Created via `Base.metadata.create_all()` on startup — no Alembic yet.
4. **Static data:** `src/data/*.ts` still powers quiz and itinerary UI until Phase 2–3 APIs are wired.
5. **Trip flow:** Internal state in `HomePage.tsx` (`useState` page: landing | quiz | result) — not URL routes yet.

---

## Prompt for a new chat

Copy this to continue:

```
I'm working on RihlaTech (KSU FYP) — AI travel planner.
Read plan.md and README.md in the repo root for full context.

Stack: React/Vite frontend, FastAPI/PostgreSQL backend.
Phases 0–1 done (setup + JWT auth).
Next: Phase 2 (quiz + preferences flow).

Key decisions: quiz=logistics, preferences=personalization,
budget tiers Eco/Mid/Luxury, day-by-day itinerary with morning/afternoon/evening slots.
Continue from plan.md Phase 2 tasks.
```
