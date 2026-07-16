# RihlaTech — Development Plan & Handoff

> **Purpose:** Continue development in a new chat without losing context.  
> **Last updated:** July 2026 · **Phases 0–7b committed & pushed** · **Next: Phase 8 (Admin + deploy)**

---

## Project summary

**RihlaTech** is an AI-powered travel planning web app (KSU IS498 FYP). Users register, answer a logistics quiz + personalization preferences, and receive a day-by-day AI itinerary (flights/hotels optional). Includes chatbot, maps deep-links, community sharing, and admin panel (later).

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
| AI / LLM | `backend/app/services/llm.py` | **Gemini** (dev default), **OpenRouter**, or **OpenAI**; set `LLM_PROVIDER` in `.env` |
| Maps / Geocoding | **Mapbox** (backend) + **Google Maps deep-links** (result page) | City autocomplete + Search Box POI on backend; no Google SDK |
| Flights | **Duffel** sandbox + mock/deep-link fallback | Phase 6 |
| Hotels | Mock cards + **Booking.com deep-links** (no RapidAPI) | Phase 6 |
| Vector DB | Defer — Postgres + pgvector only if needed later | |

**Avoid for FYP:** Google Places/Maps SDK (billing/setup pain), unofficial RapidAPI flight/hotel scrapers.  
**OK for FYP:** Google Maps **deep-links** (opens external app — no API key).

---

## How to run locally

```bash
# 1. Env
cp .env.example .env   # fill JWT_SECRET, LLM keys, Mapbox, Duffel (see below)

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
- LLM status: http://localhost:8000/api/health/llm  
- Mapbox status: http://localhost:8000/api/health/mapbox  
- Duffel status: http://localhost:8000/api/health/duffel  

**Restart backend AND `npm run dev` after any `.env` change** (Vite only reads `VITE_*` at startup).

---

## Environment variables (`.env`)

| Variable | Used by | Phase |
|---|---|---|
| `JWT_SECRET` | Auth | 1+ |
| `LLM_PROVIDER`, `GEMINI_API_KEY`, etc. | LLM | 2+ |
| `MAPBOX_ACCESS_TOKEN` | Backend geocoding + Search Box + city/POI search | 4+ |
| `VITE_MAPBOX_ACCESS_TOKEN` | Optional; legacy embedded map components | 4+ |
| `DUFFEL_ACCESS_TOKEN` | Duffel sandbox flight search | 6 |

Same Mapbox **public** token (`pk.…`) can be used for both. Recommended scopes: geocoding, Search Box.

---

## Repository state

- **Git:** `main` on GitHub (`UsmMH/Rihla-Tech`) — synced with remote
- **Do not commit:** `.env`, `node_modules/`, `backend/.venv/`, `.phase5-backup/`, `__pycache__/`

---

## Project structure

```
Rihla-Tech/
├── backend/app/
│   ├── main.py
│   ├── models/
│   ├── routers/          auth, quiz, trips, places, chat, community, health
│   ├── services/
│   │   ├── llm.py, itinerary.py, destinations.py, geocoding.py
│   │   ├── flights.py, hotels.py          # Phase 6
│   │   ├── community.py                   # Phase 7
│   │   ├── quiz_validation.py             # Quiz input validation
│   │   ├── edit.py, apply_edit.py, chat.py, consult_chat.py
│   └── schemas/trip.py, community.py
├── src/
│   ├── pages/              AppDashboard, TripResult, CommunityPage, CommunityTripPage, ...
│   ├── components/
│   │   ├── layout/       Navbar, AppBottomNav
│   │   ├── auth/         AuthLayout (light mode)
│   │   └── trip/         QuestionFlow, OriginCityInput, ChatbotSidebar
│   └── lib/trips.ts, community.ts, quizValidation.ts, places.ts, mapDirections.ts
├── plan.md
└── README.md
```

---

## User flow (current)

```
Login (light mode) → Home dashboard
          ├─ Plan new trip → Quiz → Preferences → [AI destination picker] → Trip result
          ├─ Ask AI (consult) — general travel Q&A, no trip required
          └─ My Trips → reopen / delete itineraries

Trip result → collapsible Flights / Hotels / Days
            → Share to Community (optional caption)
            → Ask AI (trip chat) → propose edit → Apply / "yes"
            → Google Maps deep-links per activity + day route
            → Back to My Trips

Community → Discover feed / Saved bookmarks
          → open shared trip → vote, save, comment (read-only itinerary)

App nav (mobile): Home · My Trips · Community | Profile icon (top-right)
App nav (desktop): Home · My Trips · Community · Profile
```

**Session behavior:**
- Login / app open → always lands on **Home** (not last trip page)
- `localStorage` keeps last `tripPlanId` for internal resume hints only (no Home “continue” card)
- Result page: `GET /trips/{id}` first; if 404 → `POST /trips/generate`

---

## API reference (implemented)

### Auth (Phase 1)

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account → JWT |
| POST | `/api/auth/login` | Sign in → JWT |
| GET | `/api/auth/me` | Current user |

### Quiz (Phase 2)

| Method | Path | Description |
|---|---|---|
| GET | `/api/quiz/questions?phase=quiz\|preferences` | Questions + options |
| POST | `/api/quiz/submit` | Save answers; returns `needs_destination_suggestion` (validated server-side) |

### Trips (Phase 2–6)

| Method | Path | When called |
|---|---|---|
| GET | `/api/trips` | My Trips list |
| DELETE | `/api/trips/{id}` | Delete trip |
| POST | `/api/trips/suggest-destinations` | "Not sure" path → city picker |
| POST | `/api/trips/{id}/destination` | User picks suggested city |
| POST | `/api/trips/generate` | Result page — create AI itinerary + `places` rows |
| GET | `/api/trips/{id}` | Result page — load trip |
| GET | `/api/trips/{id}/flights` | Result page — when `include_flights` |
| GET | `/api/trips/{id}/hotels` | Result page — when `include_hotels` |
| POST | `/api/trips/{id}/enrich-places` | Re-geocode (skips `location_confirmed` pins) |
| POST | `/api/trips/{id}/edit` | LLM → 3 **destination** alternatives |
| POST | `/api/trips/{id}/apply-edit` | Apply itinerary changes; optional `chat_message_id` |
| PATCH | `/api/trips/{id}/places/{place_id}` | Save user-confirmed map location |

### Places (Phase 4–5)

| Method | Path | Description |
|---|---|---|
| GET | `/api/places/search?q=` | City autocomplete (origin/destination) |
| GET | `/api/places/search-poi?q=&trip_plan_id=` | POI search (Search Box) |

### Chat (Phase 5 + 5b)

| Method | Path | Description |
|---|---|---|
| GET | `/api/chat/{trip_plan_id}/messages` | Load trip chat history |
| POST | `/api/chat/message` | Trip chat; auto-applies on "yes"; returns `proposes_edit` + `apply_instruction` |
| POST | `/api/chat/consult` | Home consult chat — no trip required; client-side history in request body |

### Community (Phase 7)

| Method | Path | Description |
|---|---|---|
| GET | `/api/community/feed` | Discover shared trips |
| GET | `/api/community/saved` | Current user's saved trips |
| GET | `/api/community/trips/{id}` | Shared trip detail (read-only itinerary) |
| POST | `/api/community/trips/{id}/share` | Share own trip (`caption` optional) |
| DELETE | `/api/community/trips/{id}/share` | Unshare own trip |
| POST | `/api/community/trips/{id}/vote` | Toggle upvote |
| POST | `/api/community/trips/{id}/save` | Toggle bookmark |
| GET | `/api/community/trips/{id}/comments` | List comments |
| POST | `/api/community/trips/{id}/comments` | Add comment |
| DELETE | `/api/community/comments/{id}` | Delete own comment |

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | DB status |
| GET | `/api/health/llm` | LLM provider/model |
| GET | `/api/health/mapbox` | Geocoding configured? |
| GET | `/api/health/duffel` | Duffel token configured? |

---

## Completed phases

### Phase 0–5b ✅

See git history (`b20c8a3`, `efd6483`, etc.) for auth, quiz, AI itinerary, maps deep-links, chatbot, app shell, consult chat.

### Phase 6 — Flights, hotels, deep-links ✅

**Backend:**
- [x] `backend/app/services/flights.py` — Duffel sandbox + mock + Google Flights deep-links
- [x] `backend/app/services/hotels.py` — mock cards + Booking.com deep-links
- [x] `GET /api/trips/{id}/flights`, `/hotels`
- [x] `GET /api/health/duffel`
- [x] `DUFFEL_ACCESS_TOKEN` in config + `.env.example`

**Frontend:**
- [x] Collapsible **Flights** / **Hotels** sections on trip result (horizontal card scroll)
- [x] Collapsible **per-day** itinerary panels (Day 1 open by default)
- [x] Trip result **← My Trips** back navigation (no bottom Home button)

### Phase 6b — UX polish ✅

- [x] Light-mode **login / register** (`AuthLayout` uses `lightTheme`)
- [x] Mobile nav: no hamburger on app screens; **Profile** icon top-right; bottom bar Home · My Trips · Community
- [x] My Trips: removed marketing footer; in-app delete confirmation (no browser `confirm`)
- [x] Removed redundant Home **“Continue planning”** card (use Recent trips / My Trips)
- [x] Origin/destination search: close suggestions after picking a city
- [x] Quiz footer: fixed button heights + spacer (no layout shift on step change)
- [x] My Trips: hide “Itinerary ready” badge for completed trips

### Phase 7 — Community ✅

**Backend:**
- [x] `trip_plans.is_shared`, `share_caption`, `shared_at` + `trip_votes`, `trip_saves`, `trip_comments` tables
- [x] `GET /api/community/feed`, `/saved`, `/trips/{id}`, comments + share/vote/save toggles

**Frontend:**
- [x] **Community** page — Discover / Saved tabs with vote, save, comment counts
- [x] **Community trip detail** — read-only itinerary + comments
- [x] **Share** button on trip result (caption modal, unshare)

### Phase 7b — Quiz validation & UX polish ✅

**Validation (`src/lib/quizValidation.ts`, `backend/app/services/quiz_validation.py`):**
- [x] Cities — pick from Mapbox suggestions when results exist; format + Mapbox verify on submit
- [x] Dates — no past departures; max 14 nights; errors only when both dates set
- [x] Travelers — caps (20 total); choice options must match allowed keys
- [x] Cross-field — origin ≠ destination
- [x] UX — no error banners while Next is grayed; city errors only after tapping Next

**Other polish:**
- [x] Mobile quiz — scrollable content + pinned footer (no layout jump between steps)
- [x] Desktop nav — logo left · tabs centered · Profile right (`max-w-5xl`)
- [x] Faster itinerary — geocoding deferred to background on trip result (not blocking generate)
- [ ] Desktop home/dashboard wide-screen layout (deferred)

---

## Current priority — Phase 8: Admin + deployment

**In progress (local):**
- [x] Admin API (`/api/admin/*`) — stats, users, trips, unshare, delete
- [x] Admin dashboard UI (Profile → Admin dashboard, `is_admin` only)
- [x] `promote_admin.py` script
- [x] Deploy configs: `render.yaml`, `vercel.json`, `.env.example` updates
- [ ] Deploy to Render + Neon + Vercel (manual steps below)
- [ ] Smoke-test on production URL

### Deploy checklist (Vercel + Render + Neon)

1. **Neon** — create Postgres DB; copy `DATABASE_URL` (use `?sslmode=require` if needed).
2. **Render** — New Web Service from repo; apply `render.yaml` or set:
   - Root: `backend`
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Env: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, LLM/Mapbox/Duffel keys
3. **Promote admin** (after first register on prod):  
   `python scripts/promote_admin.py your@email.com` (Render shell or locally with prod `DATABASE_URL`)
4. **Vercel** — import repo; framework Vite; env:
   - `VITE_API_BASE_URL=https://<render-service>.onrender.com/api`
   - `VITE_MAPBOX_ACCESS_TOKEN` (optional)
5. **Render** — set `CORS_ORIGINS` to your Vercel URL (e.g. `https://rihlatech.vercel.app`).
6. **Smoke test** — register → quiz → generate → community → admin panel.

### Admin API

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/stats` | User/trip/shared/comment counts |
| GET | `/api/admin/users` | List users |
| PATCH | `/api/admin/users/{id}` | Toggle `is_admin` |
| GET | `/api/admin/trips` | List all trips |
| DELETE | `/api/admin/trips/{id}` | Delete any trip |
| DELETE | `/api/admin/trips/{id}/share` | Unshare (moderation) |

**Local admin:** `cd backend && .\.venv\Scripts\python scripts\promote_admin.py you@example.com`

---

## MVP build order

1. Auth ✅  
2. Quiz + preferences + destination AI ✅  
3. AI itinerary generation ✅  
4. Map + geocoding ✅  
5. Edit trip + chatbot + trip history + maps deep-links ✅  
5b. App-shell UX + mobile polish + consult chat ✅  
6. Flights/hotels + deep-links ✅  
6b. Trip result UX + auth light mode + nav polish ✅  
7. Community ✅  
7b. Quiz validation + mobile/nav polish ✅  
8. Admin  

---

## Known gotchas

1. **Postgres port:** Docker `5433:5432`.
2. **Backend restart:** Required after `.env` changes.
3. **Frontend restart:** Required after `VITE_*` env changes.
4. **LLM JSON:** Prefer **Gemini** for reliability.
5. **Duffel:** Test token starts with `duffel_test_`; restart backend after adding to `.env`.
6. **Chat apply:** User says "yes" or taps **Apply to itinerary**; state synced via DB.
7. **Theme:** Light mode default in app; login/register always light. Clear `rihlatech_theme` in localStorage to reset.
8. **Login landing:** Always Home — not last trip page.
9. **Consult chat:** Client-side history only; not persisted to DB.
10. **Maps on result page:** Google Maps deep-links only.
11. **Typecheck:** `npm run typecheck` needs `typescript` in devDependencies.
12. **Itinerary speed:** `POST /trips/generate` is LLM-bound; Mapbox geocoding runs in background on result page via `enrich-places`.
13. **Flights/hotels:** Loaded after itinerary appears (Duffel can be slow; does not block generate spinner).
14. **Quiz validation:** City must be picked from suggestions when Mapbox returns matches; backend re-validates on submit.

---

## Handoff — start here in next chat

1. **Phase 8 — Admin + deployment** — dashboard, cloud hosting (Vercel + Render + Neon pattern).

2. **Optional polish** — desktop wide-screen home; persist consult chat server-side; `/welcome` marketing route.

---

## Copy-paste prompt for new chat

```
I'm working on RihlaTech — AI travel planning web app (KSU IS498 capstone).
Read plan.md and README.md first; plan.md is the source of truth.

Repo: UsmMH/Rihla-Tech
Stack: React 18 + Vite + Tailwind + FastAPI + PostgreSQL (Docker 5433) + Gemini/Duffel/Mapbox

Done (Phases 0–7 committed on main):
- Community: share trips, Discover/Saved feed, vote, save, comment
- Duffel flights + mock hotels; collapsible trip result; Google Maps deep-links
- App shell: Home · My Trips · Community; light auth; consult chat

Local / uncommitted polish (Phase 7b):
- Quiz & preferences validation (cities, dates max 14 nights, travelers, origin ≠ destination)
- Mobile quiz layout fix; desktop nav (centered tabs, Profile right)
- Faster generate: geocoding runs in background on result page

NEXT: Commit 7b if needed → Phase 8 (admin + deploy)

Constraints:
- No Google Maps SDK; deep-links OK
- No RapidAPI hotel scrapers
- Don't commit .env, .phase5-backup/, node_modules/, backend/.venv/
- Ask before git commit unless I say to commit

Key files: plan.md, src/lib/quizValidation.ts, backend/app/services/quiz_validation.py,
src/components/trip/QuestionFlow.tsx, src/pages/TripResult.tsx
```

---

## Verify Postgres

```sql
SELECT id, destination, status, itinerary_source FROM trip_plans ORDER BY id DESC LIMIT 5;
SELECT trip_plan_id, day_number, time_slot, name, map_search, latitude, longitude, location_confirmed
FROM places ORDER BY trip_plan_id DESC, day_number, sort_order LIMIT 20;
SELECT trip_plan_id, role, left(content, 60) FROM chat_messages ORDER BY id DESC LIMIT 10;
SELECT id, destination, is_shared, shared_at FROM trip_plans WHERE is_shared = TRUE ORDER BY shared_at DESC LIMIT 5;
SELECT trip_plan_id, count(*) FROM trip_votes GROUP BY trip_plan_id;
```
