# RihlaTech — Development Plan & Handoff

> **Purpose:** Continue development in a new chat without losing context.  
> **Last updated:** June 2026 · **Phases 0–2 complete** · **Phase 3 next** (AI itinerary generation).

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
| AI / LLM | `backend/app/services/llm.py` | **OpenRouter**, **Gemini**, or **OpenAI** via OpenAI-compatible client; set `LLM_PROVIDER` in `.env` |
| Maps | Google Places + Mapbox or Google Maps JS | Free tiers for FYP demo — Phase 4 |
| Flights/Hotels | Duffel API when keys ready; mock data as fallback | Phase 6 |
| Vector DB | Defer — Postgres + pgvector only if needed later | |

---

## How to run locally

```bash
# 1. Env
cp .env.example .env   # fill JWT_SECRET + LLM keys (see below)

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
- LLM status: http://localhost:8000/api/health/llm → `{"configured":true,"provider":"gemini","model":"..."}`

**Restart backend after any `.env` change.**

---

## LLM configuration (working as of Phase 2)

Copy from `.env.example`. Priority is controlled by `LLM_PROVIDER`:

| `LLM_PROVIDER` | Key required | Notes |
|---|---|---|
| `gemini` | `GEMINI_API_KEY` | **Currently used in dev.** Google AI Studio key. Recommended model: `gemini-2.5-flash` |
| `openrouter` | `OPENROUTER_API_KEY` | Set `OPENROUTER_MODEL` (e.g. `openai/gpt-4o-mini`) |
| `openai` | `OPENAI_API_KEY` | Direct OpenAI |
| `auto` | First available key | gemini → openrouter → openai |

**Test scripts** (run from `backend/`):

```bash
.\.venv\Scripts\python scripts\test_llm.py          # basic LLM connectivity
.\.venv\Scripts\python scripts\test_suggest_flow.py # full destination suggestion (uses latest trip_plan)
```

**Destination suggestions:** `POST /api/trips/suggest-destinations` uses LLM when configured. On failure (quota, 503, bad JSON) it **falls back to mock cities** (Kyoto, Barcelona, Queenstown). Response includes `source` (`gemini` | `openrouter` | `openai` | `mock`) and `fallback_reason`. City picker UI shows a blue or yellow banner accordingly.

---

## Repository state

- **Git:** on `master`; Phase 0–2 work committed locally
- **Not committed:** `.env`, `node_modules/`, `backend/.venv/`
- **Deleted (obsolete):** `src/pages/OnboardingQuiz.tsx`, `src/data/quizSteps.ts`

---

## Project structure

```
Rihla-Tech/
├── backend/app/
│   ├── main.py                 # FastAPI, CORS, create_all + seed questions on startup
│   ├── config.py               # Settings from .env (incl. LLM_PROVIDER, keys)
│   ├── database.py
│   ├── data/quiz_seed.py       # 5 quiz + 5 preference questions (idempotent seed)
│   ├── models/
│   │   ├── user.py
│   │   ├── question.py         # Question + AnswerOption (unique phase+key)
│   │   └── trip_plan.py        # TripPlan + QuizResponse
│   ├── routers/
│   │   ├── health.py           # GET /api/health, GET /api/health/llm
│   │   ├── auth.py
│   │   ├── quiz.py             # questions + submit
│   │   └── trips.py            # suggest-destinations, select destination
│   ├── services/
│   │   ├── auth.py
│   │   ├── quiz.py
│   │   ├── destinations.py     # AI + mock destination suggestions
│   │   └── llm.py              # OpenRouter / Gemini / OpenAI client
│   └── schemas/                  # auth, user, quiz, trip, health
├── backend/scripts/
│   ├── test_llm.py
│   ├── test_suggest_flow.py
│   └── test_gemini_models.py
├── src/
│   ├── App.tsx                   # Auth routing: /login, /register, / → HomePage
│   ├── pages/
│   │   ├── HomePage.tsx          # Trip flow state machine
│   │   ├── LandingPage.tsx
│   │   ├── QuizPage.tsx          # logistics (API-driven)
│   │   ├── PreferencesPage.tsx
│   │   ├── DestinationPickerPage.tsx  # AI city picker ("not sure" path)
│   │   ├── TripResult.tsx        # still static itinerary — Phase 3
│   │   ├── LoginPage.tsx
│   │   └── RegisterPage.tsx
│   ├── components/
│   │   ├── layout/               # Navbar, Footer, LogoMark
│   │   └── trip/
│   │       ├── QuestionFlow.tsx       # shared multi-step UI
│   │       ├── TripDateRangePicker.tsx  # themed calendar range picker
│   │       ├── TripTravelersInput.tsx   # +/- steppers
│   │       └── ChatbotSidebar.tsx       # not wired — Phase 5
│   ├── contexts/                 # AuthContext, ThemeContext
│   ├── data/                     # itinerary.ts etc. — static until Phase 3
│   └── lib/
│       ├── api.ts, auth.ts, quiz.ts, trips.ts, navigation.ts
├── docker-compose.yml
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

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Create account → JWT |
| POST | `/api/auth/login` | No | Sign in → JWT |
| GET | `/api/auth/me` | Bearer | Current user |

**User model (`users`):** `id`, `email`, `password`, `first_name`, `last_name`, `phone_num`, `is_admin`, `created_at`

**Frontend:** Login/Register, `AuthContext` (`rihlatech_token`, `rihlatech_user`), protected `/`, auth-aware Navbar.

### Phase 2 — Quiz + Preferences ✅

**Goal:** Two-step data collection; answers saved in DB; AI destination suggestions when destination unknown.

**Backend endpoints:**

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/quiz/questions?phase=quiz\|preferences` | Bearer | Questions + options for phase |
| POST | `/api/quiz/submit` | Bearer | Save answers; create/update `trip_plan`; returns `needs_destination_suggestion` after preferences |
| POST | `/api/trips/suggest-destinations` | Bearer | 3 AI cities + blurb (or mock fallback) |
| POST | `/api/trips/{id}/destination` | Bearer | User picks suggested city |
| GET | `/api/health/llm` | No | LLM provider/model status |

**Models:**

- `questions` + `answer_options` — seeded on startup; `phase` = `quiz` | `preferences`; unique `(phase, key)`
- `trip_plans` — `destination`, `destination_known`, dates, travelers, origin, preferences fields, `status`
- `quiz_responses` — JSON `value` per question per trip

**Frontend flow (`HomePage.tsx`):**

```
landing → quiz → preferences → [destination picker if "not sure"] → result
```

- `QuizPage` / `PreferencesPage` fetch from API via `src/lib/quiz.ts`
- `QuestionFlow` handles choice, text, date range (calendar), travelers (+/- steppers)
- Destination question skipped when user chose "not sure"
- `TripResult` still shows **static** itinerary from `src/data/itinerary.ts`

**Exit criteria met:** User logs in → quiz + preferences → rows in `trip_plans` + `quiz_responses`. "Not sure" path → AI city picker (verified with Gemini).

**Verify Postgres:**

```sql
SELECT id, destination, destination_known, trip_purpose, theme, status FROM trip_plans ORDER BY id DESC;
SELECT qr.trip_plan_id, q.key, qr.value FROM quiz_responses qr JOIN questions q ON q.id = qr.question_id ORDER BY qr.trip_plan_id;
```

---

## Product decisions (agreed — follow in Phase 3+)

### Quiz vs preferences

| Step | `phase` | Content |
|---|---|---|
| **Quiz** | `"quiz"` | Dates, destination (or "not sure"), adults/kids, origin (text for now; airport dropdown later) |
| **Preferences** | `"preferences"` | Purpose (fun/heal/explore), theme (historical/modern/natural), budget tier (eco/mid/luxury), include flights/hotels |

### Budget tiers

**Eco** / **Mid** / **Luxury** (not dollar ranges).

### Itinerary shape (Phase 3)

```
Day 1
  morning:   activity
  afternoon: activity
  evening:   activity
```

`PLACE` entity gets `time_slot` (`morning` | `afternoon` | `evening`).

### Uncertain destination

Quiz → "not sure" → preferences → `suggest-destinations` → user picks → then generate itinerary (Phase 3).

### Deferred

- Email verification, Arabic/RTL, Alembic (using `create_all` for now)
- **Edit trip** (re-run quiz as new trip today) — Phase 5
- Origin city **dropdown** (airports/Places API) — Phase 4 or when Places key ready
- Admin (Phase 8), Community (Phase 7)

### MVP build order

1. Auth ✅  
2. Quiz + preferences + destination AI ✅ (itinerary still static)  
3. **AI itinerary generation + map** ← **NEXT**  
4. Edit trip + chatbot  
5. Flights/hotels + deep-links  
6. Community  
7. Admin  

---

## Phase 3 — Next up (AI trip generation)

**Goal:** Replace static itinerary with LLM-generated day-by-day plan; persist places.

### Backend tasks

- [ ] Model: `Place` (or `places`) linked to `trip_plan` — `time_slot`, `date`, `order`, `name`, `description`, lat/lng nullable
- [ ] `POST /api/trips/generate` — use `trip_plan` + selected destination; call `llm.py`; structured JSON itinerary
- [ ] `GET /api/trips/:id` — trip plan + places
- [ ] Reuse `llm.py`; same retry/JSON parsing patterns as `destinations.py`

### Frontend tasks

- [ ] Pass `tripPlanId` through flow to `TripResult` (currently result page has no trip context)
- [ ] Call `generate` after destination selected (or when destination known, after preferences)
- [ ] Replace `src/data/itinerary.ts` in `TripResult.tsx` with API data
- [ ] Loading/error states on result page

### Exit criteria

User completes quiz + preferences → sees **real AI itinerary** for their trip stored in DB.

---

## Phase 4 — Map + places

- [ ] Google Places enrichment for lat/lng, ratings
- [ ] Map component with itinerary pins
- [ ] Origin city dropdown (optional here)

---

## Phase 5 — Edit + chatbot

- [ ] `POST /api/trips/:id/edit` — natural language → 3 alternatives
- [ ] `POST /api/chat/message` — LLM with trip context
- [ ] Wire `ChatbotSidebar.tsx`
- [ ] "Edit trip" should reload existing trip, not start blank quiz

---

## Phase 6 — Flights, hotels, deep-links

- [ ] Duffel integration (or mock + deep-link URLs)
- [ ] Only when `include_flights` / `include_hotels` true

---

## Phase 7 — Community

- [ ] `COMMUNITY_POST`, share, save, vote, comment

---

## Phase 8 — Admin + deployment

- [ ] Admin dashboard
- [ ] Deploy to cloud (Railway / Render / university server — TBD)

---

## API keys

| Key | Phase | Status |
|---|---|---|
| `GEMINI_API_KEY` + `LLM_PROVIDER=gemini` | 2+ | **Configured in dev** |
| `OPENROUTER_API_KEY` | 2+ | Optional alternative |
| `OPENAI_API_KEY` | 2+ | Optional fallback |
| `GOOGLE_PLACES_API_KEY` | 4 | Not yet |
| `DUFFEL_ACCESS_TOKEN` | 6 | Not yet |

Never commit `.env`. See `.env.example` for all variables.

---

## Known gotchas

1. **Postgres port:** Docker `5433:5432` (Windows local Postgres on 5432).
2. **Backend restart:** Required after `.env` changes (`settings` loaded at import).
3. **Tables:** `create_all` on startup — no Alembic yet.
4. **Quiz questions duplicated in UI (fixed):** SQLAlchemy `joinedload` on question options requires `.unique()` on the query — see `services/quiz.py`.
5. **Seed duplicates (fixed):** `quiz_seed.py` dedupes by `(phase, key)` on startup.
6. **Mock destinations look like AI:** Kyoto / Barcelona / Queenstown = **always mock**. Any other cities = LLM worked. Check `source` in API response or yellow banner on city picker.
7. **Gemini quotas:** `gemini-2.0-flash` free tier may be exhausted; `gemini-3.5-flash` can 503 under load. Use `gemini-2.5-flash`. Retries (3×) added for transient errors.
8. **Trip flow:** Internal `useState` in `HomePage.tsx` — not URL routes yet. `tripPlanId` not passed to `TripResult` — fix in Phase 3.
9. **TripResult:** Static data only until Phase 3 `generate` endpoint.
10. **Edit trip button:** Restarts quiz as new trip — intentional until Phase 5.

---

## Handoff prompt (paste into new chat)

```
I'm continuing RihlaTech (KSU IS498 FYP). Read plan.md and README.md first.

Phases 0–2 are done: auth, quiz + preferences (DB-backed), AI destination picker
(LLM via llm.py — Gemini/OpenRouter/OpenAI). TripResult still uses static itinerary.

Start Phase 3: AI trip generation per plan.md checklist.
Key files: backend/app/services/llm.py, destinations.py (patterns to reuse),
trip_plan model, src/pages/TripResult.tsx, src/lib/trips.ts.
```

---
