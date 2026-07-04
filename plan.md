# RihlaTech — Development Plan & Handoff

> **Purpose:** Continue development in a new chat without losing context.  
> **Last updated:** June 2026 · **Phases 0–5 committed** · **Mobile UI pass (local, uncommitted)** · **Next: app-shell UX redesign**

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
- **Last commit:** `efd6483` — Phase 5 (chatbot, trip history, maps deep-links)
- **Local (uncommitted):** Mobile-first responsive tweaks (`TripResult`, `ChatbotSidebar`, `QuestionFlow`, `MyTripsPage`)
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

## User flow (current — to be redesigned)

```
LandingPage (marketing) → quiz → preferences → [destination picker] → result
         ↘ My Trips
```

**Pain points (user feedback, June 2026):**
- Feels like a **company/marketing site**, not a consumer travel app
- Navbar shows **Features / How it Works / Destinations** even during quiz, trip result, My Trips — wrong for in-app flows
- No real **app home** after login — `LandingPage` is a marketing hero, not a dashboard
- **Chatbot only on trip result** — user wants AI consult + “plan a trip” from the main screen
- **Community** deferred (Phase 7) but should appear in nav as placeholder or “coming soon”

**Target UX (next priority):**

```
[App shell: bottom tab bar or compact top nav]
  Home      — dashboard: greet user, quick actions (Plan trip, Ask AI), recent trips
  My Trips  — existing list
  Community — placeholder (Phase 7)
  Profile   — account, theme, logout (uses GET /api/auth/me)

Marketing landing (Features, How it Works) → only for logged-out visitors OR separate /welcome route — NOT shown inside the app.

Home screen dual entry:
  1. "Plan a new trip" → existing quiz flow
  2. "Ask AI" → chatbot (consultation mode; may need new backend or draft trip — see below)
```

**Chat from home — design note:**  
Current API requires `trip_plan_id` + generated itinerary (`POST /api/chat/message`, `GET /api/chat/{id}/messages`). Options for home chat:
- **A)** General chat endpoint (no trip; LLM answers travel questions, CTA to start quiz)
- **B)** Auto-create empty `trip_plan` on first message; chat guides user into quiz
- **C)** Reuse chat UI in “browse” mode with mock/demo context until trip exists  
Pick one in next chat before implementing.

---

## User flow (technical, unchanged for now)

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

## Phase 5b — Mobile-first UI (local, uncommitted)

Partial pass done — vertical card stacks, touch targets, sticky quiz nav, full-screen mobile chat:
- [x] `TripResult.tsx` — vertical activity cards on mobile; full-width buttons; bottom Ask AI bar
- [x] `ChatbotSidebar.tsx` — full-screen mobile; larger tap targets; wrapping quick suggestions
- [x] `QuestionFlow.tsx` — sticky bottom Back/Next; single-column choices on mobile
- [x] `MyTripsPage.tsx` — full-width CTAs; larger delete button

**Not done:** app-shell navigation, marketing nav removal, home dashboard, profile page, home chat.

---

## Current priority — App-shell UX redesign

**Goal:** Feel like a normal user travel app (Airbnb / Google Travel vibe), not a dev/marketing landing page.

### Tasks (suggested order)

1. **Navigation model**
   - Split **marketing** (`LandingPage` — Features, How it Works) from **app** routes
   - Logged-in users land on **Home** dashboard, not marketing hero
   - `Navbar.tsx`: context-aware — marketing links only on public landing; app nav elsewhere (Home, My Trips, Profile; Community stub)

2. **Home dashboard** (new `HomeDashboardPage.tsx` or repurpose post-login landing)
   - Greeting + “Plan a new trip” CTA
   - “Ask AI” opens chatbot (consult or plan — per chat design decision)
   - Recent trips (reuse `GET /api/trips` slice)
   - Optional: resume last trip card

3. **Profile page** (new)
   - Email from `GET /api/auth/me`, theme toggle, logout
   - No backend changes required

4. **Wire chat on home**
   - Depends on chat design decision (general vs trip-tied)
   - Reuse `ChatbotSidebar.tsx` where possible

5. **Routing cleanup**
   - `HomePage.tsx` state machine: add `home` | `profile` pages; default authenticated → `home`
   - Consider React Router later if state machine gets unwieldy (optional, not required for FYP)

6. **Commit** mobile UI pass + app-shell work when stable

### Out of scope for this pass
- Phase 6 flights/hotels
- Full Community (Phase 7) — nav stub only
- Admin panel

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

neither## Phase 8 — Admin + deployment

- [ ] Admin dashboard
- [ ] Cloud deploy (Railway / Render / university server — TBD)

---

## MVP build order

1. Auth ✅  
2. Quiz + preferences + destination AI ✅  
3. AI itinerary generation ✅  
4. Map + geocoding ✅  
5. Edit trip + chatbot + trip history + maps deep-links ✅  
5b. Mobile-first responsive tweaks ✅ (local, uncommitted)  
6. **App-shell UX** (home, profile, nav split, home chat) ← **CURRENT**  
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

1. **App-shell UX redesign** — see “Current priority” above; read user pain points in User flow section.

2. **Decide home chat approach** (general chat API vs draft trip vs browse-only UI).

3. **Commit** local mobile UI diff when combined with app-shell work (or split commits).

4. **Phase 6** when ready — ask for **Duffel API token** before wiring flights.

---

## Copy-paste prompt for new chat

```
I'm working on RihlaTech — AI travel planning web app (KSU IS498 capstone).
Read plan.md and README.md first; plan.md is the source of truth.

Repo: UsmMH/Rihla-Tech · local: Rihla-Tech
Stack: React 18 + Vite + Tailwind + FastAPI + PostgreSQL (Docker 5433) + Gemini/OpenRouter + Mapbox (no Google SDK)

Done (committed efd6483 — Phase 5):
- Auth, quiz, AI itinerary, Mapbox city search
- My Trips, delete, chatbot + history, apply-edit, destination alternatives
- Result page: Google Maps deep-links + per-day driving routes
- Chat: context-aware edits, Apply synced to DB

Done locally (uncommitted):
- Mobile-first tweaks: vertical cards on TripResult, full-screen mobile chat,
  sticky quiz nav, touch-friendly buttons (TripResult, ChatbotSidebar, QuestionFlow, MyTripsPage)

NEXT PRIORITY — App-shell UX (consumer app, not marketing site):
1. Remove marketing nav (Features, How it Works, Destinations) from in-app flows
   (quiz, result, My Trips). Marketing stays on public landing only.
2. Add real app Home dashboard after login: greet user, "Plan new trip", "Ask AI",
   recent trips — NOT the current marketing LandingPage hero.
3. App navigation: Home | My Trips | Community (placeholder) | Profile
4. Chatbot accessible from Home — user can consult AI OR start planning a trip.
   Current chat API requires trip_plan_id + itinerary — decide approach (see plan.md).
5. Profile page: auth/me, theme toggle, logout

Key files: plan.md, src/pages/HomePage.tsx, src/pages/LandingPage.tsx,
src/components/layout/Navbar.tsx, src/components/trip/ChatbotSidebar.tsx,
src/pages/TripResult.tsx, src/pages/MyTripsPage.tsx, backend/app/services/chat.py

Constraints: No Google Maps SDK; deep-links OK. Minimal scope. Match existing theme.
Don't commit until I ask. Tell me if you need a design decision before coding.
```

---

## Verify Postgres

```sql
SELECT id, destination, status, itinerary_source FROM trip_plans ORDER BY id DESC LIMIT 5;
SELECT trip_plan_id, day_number, time_slot, name, map_search, latitude, longitude, location_confirmed
FROM places ORDER BY trip_plan_id DESC, day_number, sort_order LIMIT 20;
SELECT trip_plan_id, role, left(content, 60) FROM chat_messages ORDER BY id DESC LIMIT 10;
```
