# RihlaTech — Development Plan & Handoff

> **Purpose:** Continue development in a new chat without losing context.  
> **Last updated:** June 2026 · **Phases 0–5 complete (committed)** · **Next: mobile-first UI pass** · **Phase 6 after UI**

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
cp .env.example .env   # fill JWT_SECRET, LLM keys, Mapbox tokens (see below)

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

**Restart backend AND `npm run dev` after any `.env` change** (Vite only reads `VITE_*` at startup).

---

## Environment variables (`.env`)

| Variable | Used by | Phase |
|---|---|---|
| `JWT_SECRET` | Auth | 1+ |
| `LLM_PROVIDER`, `GEMINI_API_KEY`, etc. | LLM | 2+ |
| `MAPBOX_ACCESS_TOKEN` | Backend geocoding + Search Box + city/POI search | 4+ |
| `VITE_MAPBOX_ACCESS_TOKEN` | Optional; legacy embedded map components | 4+ |

Same Mapbox **public** token (`pk.…`) can be used for both. Recommended scopes: geocoding, Search Box.

---

## Repository state

- **Git:** `main` on GitHub (`UsmMH/Rihla-Tech`)
- **Phases 0–5:** committed on `main`
- **Do not commit:** `.env`, `node_modules/`, `backend/.venv/`, `.phase5-backup/`, `__pycache__/`

---

## Project structure

```
Rihla-Tech/
├── backend/app/
│   ├── main.py
│   ├── models/
│   │   ├── place.py          # map_search, location_hint, mapbox_id, location_confirmed
│   │   ├── trip_plan.py, chat_message.py, user.py, question.py
│   ├── routers/
│   │   ├── auth.py, quiz.py, trips.py, places.py, chat.py, health.py
│   ├── services/
│   │   ├── llm.py, llm_json.py, itinerary.py, destinations.py
│   │   ├── geocoding.py      # Search Box POI + geocoding v5
│   │   ├── edit.py, apply_edit.py, chat.py
│   └── schemas/trip.py
├── src/
│   ├── pages/
│   │   ├── HomePage.tsx, TripResult.tsx, MyTripsPage.tsx, ...
│   ├── components/trip/
│   │   ├── ChatbotSidebar.tsx, PlaceLocationPicker.tsx, TripMap.tsx (legacy), ...
│   └── lib/trips.ts, places.ts, mapDirections.ts, activityType.ts
├── plan.md
└── README.md
```

---

## User flow (`HomePage.tsx`)

```
landing → quiz → preferences → [destination picker if "not sure"] → result
```

- **My Trips** in navbar — list/load past trips; delete with confirm
- `tripPlanId` + last page persisted in `localStorage` — refresh on result page restores trip
- Result page: `GET /trips/{id}` first; if 404 → `POST /trips/generate`
- **Ask AI** button opens chatbot sidebar (single button; no separate Edit Trip)
- Activity cards: real **venue names** as titles
- **Maps UX:** per-activity Google Maps deep-links + per-day driving routes (no embedded map on result page)

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
| POST | `/api/quiz/submit` | Save answers; returns `needs_destination_suggestion` |

### Trips (Phase 2–5)

| Method | Path | When called |
|---|---|---|
| GET | `/api/trips` | My Trips list |
| DELETE | `/api/trips/{id}` | Delete trip |
| POST | `/api/trips/suggest-destinations` | "Not sure" path → city picker |
| POST | `/api/trips/{id}/destination` | User picks suggested city |
| POST | `/api/trips/generate` | Result page — create AI itinerary + `places` rows |
| GET | `/api/trips/{id}` | Result page — load trip |
| POST | `/api/trips/{id}/enrich-places` | Re-geocode (skips `location_confirmed` pins) |
| POST | `/api/trips/{id}/edit` | LLM → 3 **destination** alternatives |
| POST | `/api/trips/{id}/apply-edit` | Apply itinerary changes; optional `chat_message_id` |
| PATCH | `/api/trips/{id}/places/{place_id}` | Save user-confirmed map location |

### Places (Phase 4–5)

| Method | Path | Description |
|---|---|---|
| GET | `/api/places/search?q=` | City autocomplete (origin/destination) |
| GET | `/api/places/search-poi?q=&trip_plan_id=` | POI search (Search Box) |

### Chat (Phase 5)

| Method | Path | Description |
|---|---|---|
| GET | `/api/chat/{trip_plan_id}/messages` | Load chat history |
| POST | `/api/chat/message` | Send message; auto-applies on "yes"; returns `proposes_edit` + `apply_instruction` |

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | DB status |
| GET | `/api/health/llm` | LLM provider/model |
| GET | `/api/health/mapbox` | Geocoding configured? |

---

## Completed phases

### Phase 0 — Project setup ✅

### Phase 1 — Authentication ✅

### Phase 2 — Quiz + Preferences ✅

### Phase 3 — AI itinerary generation ✅

### Phase 4 — Map + places ✅

Mapbox geocoding v5, `TripMap.tsx`, city autocomplete, card↔pin linking, category icons.

### Phase 5 — Edit + chatbot + trip history + maps deep-links ✅

**Backend:**
- [x] `GET /api/trips`, `DELETE /api/trips/{id}`
- [x] `POST /api/trips/{id}/edit` — destination alternatives (LLM)
- [x] `POST /api/trips/{id}/apply-edit` — update places by `place_id`, optional `chat_message_id`
- [x] `POST /api/chat/message`, `GET /api/chat/{id}/messages` — persistent `chat_messages`
- [x] Chat context: history + pending-edit awareness; supersede stale Apply proposals
- [x] Itinerary prompt: real **venue names** + `map_search`, `location_hint`, optional LLM lat/lng
- [x] `places` columns: `map_search`, `location_hint`, `mapbox_id`, `location_confirmed`
- [x] `PATCH /api/trips/{id}/places/{place_id}` — user-confirmed locations
- [x] `GET /api/places/search-poi` — Mapbox Search Box POI search
- [x] Mapbox Search Box as primary POI resolver (backend)

**Frontend:**
- [x] `MyTripsPage.tsx` — list, open, delete trips
- [x] `ChatbotSidebar.tsx` — history, Apply button, yes-confirmation, DB-synced apply state
- [x] Trip persistence via `localStorage` (`tripPlanId` + page)
- [x] Dynamic destination alternatives on result page (`POST /edit`)
- [x] Single **Ask AI** button; light mode default
- [x] **Maps pivot:** `TripResult` uses Google Maps deep-links per activity + per-day driving routes + leg-by-leg links (`mapDirections.ts`)
- [x] Embedded `TripMap` retained in codebase but not shown on result page

**Acceptable for now:**
- Explore Alternatives = other **destinations**, not activity swaps
- `PlaceLocationPicker.tsx` / `TripMap.tsx` kept for future use; result page uses deep-links only

---

## Current priority — Mobile-first UI pass

- Responsive layout for trip result, quiz, chatbot sidebar
- Touch-friendly targets; vertical card stack on mobile
- Polish typography, spacing, and navigation for general users
- Then Phase 6 (flights/hotels)

---

## Phase 6 — Flights, hotels, deep-links

- [ ] Duffel sandbox (flights) or mock + deep-links
- [ ] Mock hotel cards + Booking.com search URLs
- [ ] Only when `include_flights` / `include_hotels` true

**API needed before starting:** Duffel sandbox token (confirm with team). Hotels = deep-links only, no extra API.

---

## Phase 7 — Community

- [ ] Share, save, vote, comment

---

## Phase 8 — Admin + deployment

- [ ] Admin dashboard
- [ ] Cloud deploy (Railway / Render / university server — TBD)

---

## MVP build order

1. Auth ✅  
2. Quiz + preferences + destination AI ✅  
3. AI itinerary generation ✅  
4. Map + geocoding ✅  
5. Edit trip + chatbot + trip history + maps deep-links ✅  
6. **Mobile-first UI polish** ← **CURRENT**  
7. Flights/hotels + deep-links  
8. Community  
9. Admin  

---

## Known gotchas

1. **Postgres port:** Docker `5433:5432`.
2. **Backend restart:** Required after `.env` changes and for new columns (`chat_messages`, `places.map_search`, etc. via `create_all` + patches in `main.py`).
3. **Frontend restart:** Required after `VITE_*` env changes.
4. **LLM JSON:** Prefer **Gemini** for reliability.
5. **Geocoding:** Search Box >> Geocoding v5 for POIs; `location_confirmed` pins skipped on enrich.
6. **Chat apply:** User says "yes" or taps **Apply to itinerary**; state synced via DB (`proposes_edit` flag).
7. **Theme:** Light mode default; clear `rihlatech_theme` in localStorage to reset.
8. **Maps on result page:** Google Maps URL deep-links only — driving mode for routes.
9. **Typecheck:** `npm run typecheck` needs `typescript` in devDependencies (not installed in all envs).

---

## Handoff — start here in next chat

1. **Mobile-first UI pass** — trip result, quiz flow, chatbot sidebar, navbar.

2. **Phase 6** when ready — ask for **Duffel API token** before wiring flights.

---

## Verify Postgres

```sql
SELECT id, destination, status, itinerary_source FROM trip_plans ORDER BY id DESC LIMIT 5;
SELECT trip_plan_id, day_number, time_slot, name, map_search, latitude, longitude, location_confirmed
FROM places ORDER BY trip_plan_id DESC, day_number, sort_order LIMIT 20;
SELECT trip_plan_id, role, left(content, 60) FROM chat_messages ORDER BY id DESC LIMIT 10;
```

---

## Copy-paste prompt for new chat

```
I'm working on RihlaTech — AI travel planning web app (KSU IS498 capstone).
Read plan.md and README.md first; plan.md is the source of truth.

Repo: UsmMH/Rihla-Tech · local: Rihla-Tech
Stack: React 18 + Vite + Tailwind + FastAPI + PostgreSQL (Docker 5433) + Gemini/OpenRouter + Mapbox (no Google SDK)

Done (Phases 0–5 committed):
- Auth, quiz, AI itinerary, Mapbox city search
- My Trips, delete, chatbot + history, apply-edit, destination alternatives
- Trip restore via localStorage; light mode default
- Result page: Google Maps deep-links per activity + per-day driving routes (no embedded map)
- Chat: context-aware edits, Apply button synced to DB

Next task: Mobile-first UI polish on trip result, quiz, and chatbot.
Then Phase 6 (Duffel flights + Booking.com hotel deep-links).

Key files: plan.md, src/pages/TripResult.tsx, src/components/trip/ChatbotSidebar.tsx,
src/pages/HomePage.tsx, src/pages/MyTripsPage.tsx, backend/app/services/chat.py

Constraints: No Google Places/Maps SDK; deep-link URLs OK. Follow existing conventions.
```
