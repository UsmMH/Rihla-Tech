# RihlaTech — Development Plan & Handoff

> **Purpose:** Continue development in a new chat without losing context.  
> **Last updated:** June 2026 · **Phases 0–4 complete** · **Phase 5 next** (edit, chatbot, trip history).

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
| AI / LLM | `backend/app/services/llm.py` | **Gemini** (dev default), **OpenRouter**, or **OpenAI**; set `LLM_PROVIDER` in `.env` |
| Maps / Geocoding | **Mapbox** (not Google) | `MAPBOX_ACCESS_TOKEN` (backend) + `VITE_MAPBOX_ACCESS_TOKEN` (frontend) |
| Flights | **Duffel** sandbox + mock/deep-link fallback | Phase 6 |
| Hotels | Mock cards + **Booking.com deep-links** (no RapidAPI) | Phase 6 |
| Vector DB | Defer — Postgres + pgvector only if needed later | |

**Avoid for FYP:** Google Places/Maps (billing/setup pain), unofficial RapidAPI flight/hotel scrapers.

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
| `MAPBOX_ACCESS_TOKEN` | Backend geocoding + place search | 4+ |
| `VITE_MAPBOX_ACCESS_TOKEN` | Frontend map tiles | 4+ |

Same Mapbox **public** token (`pk.…`) can be used for both. Token needs **styles:read**, **tiles:read**, and geocoding scopes. Ensure `http://localhost:5173` is allowed in [Mapbox token URL restrictions](https://account.mapbox.com/access-tokens/) (or use unrestricted token for local dev).

---

## LLM configuration

Copy from `.env.example`. Priority is controlled by `LLM_PROVIDER`:

| `LLM_PROVIDER` | Key required | Notes |
|---|---|---|
| `gemini` | `GEMINI_API_KEY` | **Recommended for dev.** Model: `gemini-2.5-flash` |
| `openrouter` | `OPENROUTER_API_KEY` | Free models can truncate JSON — use paid/cheap model or Gemini |
| `openai` | `OPENAI_API_KEY` | Direct OpenAI |
| `auto` | First available key | gemini → openrouter → openai |

**JSON parsing:** `backend/app/services/llm_json.py` — shared salvage/retry logic for truncated LLM output. Used by `destinations.py` and `itinerary.py`.

**Test scripts** (run from `backend/`):

```bash
.\.venv\Scripts\python scripts\test_llm.py
.\.venv\Scripts\python scripts\test_suggest_flow.py
.\.venv\Scripts\python scripts\test_generate_flow.py
.\.venv\Scripts\python scripts\test_llm_json.py
```

**Destination suggestions:** `POST /api/trips/suggest-destinations` — LLM or mock fallback (Kyoto / Barcelona / Queenstown). UI shows blue (AI) or yellow (demo) banner.

---

## Repository state

- **Git:** `main` on GitHub (`UsmMH/Rihla-Tech`)
- **Last commit:** `f35de00` — *Complete Phase 3: AI itinerary generation and resilient LLM JSON parsing*
- **Local (uncommitted):** All Phase 4 work — map, geocoding, quiz place search, result-page UI polish
- **Not committed:** `.env`, `node_modules/`, `backend/.venv/`

**Recommended next git commit:** Phase 4 (map + geocoding + place autocomplete + result UI polish).

---

## Project structure

```
Rihla-Tech/
├── backend/app/
│   ├── main.py                 # create_all, schema patch (itinerary_source column)
│   ├── config.py               # + mapbox_access_token
│   ├── models/
│   │   ├── place.py            # places table (Phase 3+)
│   │   ├── trip_plan.py        # + itinerary_source, places relationship
│   │   ├── question.py, user.py
│   ├── routers/
│   │   ├── health.py           # /health, /health/llm, /health/mapbox
│   │   ├── auth.py, quiz.py
│   │   ├── trips.py            # suggest, generate, get, destination, enrich-places
│   │   └── places.py           # GET /places/search (city autocomplete)
│   ├── services/
│   │   ├── llm.py, llm_json.py
│   │   ├── destinations.py, itinerary.py
│   │   └── geocoding.py        # Mapbox geocode, spacing, enrich_trip_places
│   └── schemas/trip.py         # TripDetailResponse, MapPinPublic, etc.
├── src/
│   ├── pages/
│   │   ├── HomePage.tsx        # trip flow state machine; passes tripPlanId
│   │   ├── TripResult.tsx      # API itinerary + map + card↔pin linking
│   │   └── DestinationPickerPage.tsx, QuizPage.tsx, PreferencesPage.tsx, ...
│   ├── components/trip/
│   │   ├── TripMap.tsx         # direct mapbox-gl (not react-map-gl)
│   │   ├── OriginCityInput.tsx # Mapbox city search (origin + destination quiz steps)
│   │   ├── QuestionFlow.tsx, ChatbotSidebar.tsx (not wired)
│   ├── lib/
│   │   ├── trips.ts, places.ts, mapboxSetup.ts, activityType.ts
│   │   └── quiz.ts, api.ts, auth.ts
│   └── data/itinerary.ts       # still used for "Explore Alternatives" static cards only
├── plan.md
└── .env.example
```

---

## User flow (`HomePage.tsx`)

```
landing → quiz → preferences → [destination picker if "not sure"] → result
```

- `tripPlanId` held in `useState` — **lost on page refresh / "Start Over"** (no trip history UI yet)
- Result page: `GET /trips/{id}` first; if 404 → `POST /trips/generate`; then background `POST /trips/{id}/enrich-places` for map pins
- Quiz: origin **and** destination (when user knows their destination) use Mapbox city autocomplete

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

### Trips (Phase 2–4)

| Method | Path | When called |
|---|---|---|
| POST | `/api/trips/suggest-destinations` | "Not sure" path → city picker |
| POST | `/api/trips/{id}/destination` | User picks suggested city |
| POST | `/api/trips/generate` | Result page — create AI itinerary + `places` rows |
| GET | `/api/trips/{id}` | Result page — load trip; auto-enrich missing/clustered coords |
| POST | `/api/trips/{id}/enrich-places` | Force full re-geocode (clears coords first) |
| GET | `/api/places/search?q=` | City autocomplete (origin + destination quiz steps) |

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | DB status |
| GET | `/api/health/llm` | LLM provider/model |
| GET | `/api/health/mapbox` | Geocoding configured? |

---

## Completed phases

### Phase 0 — Project setup ✅

FastAPI, PostgreSQL Docker (5433), Vite proxy, health check.

### Phase 1 — Authentication ✅

JWT auth, login/register, protected `/`, `AuthContext`.

### Phase 2 — Quiz + Preferences ✅

DB-backed quiz/preferences, AI destination suggestions, destination picker for "not sure" path.

### Phase 3 — AI itinerary generation ✅

**Backend:**
- `Place` model (`places` table) — `day_number`, `trip_date`, `time_slot`, `name`, `description`, `activity_type`, `duration`, `latitude`, `longitude`
- `POST /api/trips/generate` — LLM day-by-day plan (morning/afternoon/evening), mock fallback
- `GET /api/trips/{id}` — trip + grouped itinerary
- `trip_plans.itinerary_source` — tracks LLM provider used
- `llm_json.py` — resilient JSON parse + retries

**Frontend:**
- `tripPlanId` → `TripResult`
- Loading / error / retry states
- Itinerary from API (not static Tokyo data)
- `alternatives` section still static (`itinerary.ts`) — Phase 5

**Verified:** Full flow with Gemini; e.g. Cusco, Peru and Athens, Greece itineraries generated and stored.

### Phase 4 — Map + places ✅

**Goal:** Mapbox geocoding + interactive map on result page.

**Backend:**
- [x] `geocoding.py` — Mapbox forward geocode with **country filter** + distance check from destination (fixes US false positives)
- [x] `enrich_trip_places()` — backfill lat/lng; re-geocode invalid or overly clustered coords (~450 m min separation)
- [x] `places_need_spacing_refresh()` — auto re-geocode on GET when pins too close
- [x] `POST /api/trips/{id}/enrich-places` — force full re-geocode
- [x] `GET /api/places/search` — city autocomplete API
- [x] LLM itinerary prompt — spread activities across neighborhoods/days

**Frontend:**
- [x] `TripMap.tsx` — direct **mapbox-gl** (react-map-gl v8 crashed); pins per activity, colored day routes (straight-line), pin offset when stacked, `flyTo` on selection
- [x] `mapboxSetup.ts` — Vite `?worker` import for Mapbox GL
- [x] `OriginCityInput` — inline Mapbox suggestions on **origin and destination** quiz steps
- [x] `TripResult.tsx` — map + itinerary; removed fake Picsum images; category icon headers; **card ↔ pin linking** (click card → map flies; click pin → card scrolls into view)
- [x] `activityType.ts` — type icons/gradients + day pin colors
- [x] Trip response includes `map_pins`, `places_geocoded`, `geocoding_configured`
- [x] Background geocoding after itinerary loads (doesn't block generate)

**Verified:** Map tiles render; pins in correct country; 9–12 activities pinned; autocomplete on origin + destination.

**Deferred polish (optional, not blocking Phase 5):**
- Mapbox **Directions API** for road-following routes instead of straight lines
- Tighter pin spacing / geocoding diversity for dense city centers (e.g. central Athens)
- Remove unused `react-map-gl` npm dependency
- Google Places ratings/photos

---

## Phase 5 — Edit + chatbot (NEXT)

- [ ] `POST /api/trips/:id/edit` — natural language → 3 alternatives
- [ ] `POST /api/chat/message` — LLM with trip context
- [ ] Wire `ChatbotSidebar.tsx`
- [ ] **Trip history** — list/load past `trip_plans` for user (no way to revisit old trips today)
- [ ] "Edit trip" reloads existing trip instead of blank quiz
- [ ] Replace static `alternatives` in `TripResult` with API

---

## Phase 6 — Flights, hotels, deep-links

- [ ] Duffel sandbox (flights) or mock + deep-links
- [ ] Mock hotel cards + Booking.com search URLs
- [ ] Only when `include_flights` / `include_hotels` true

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
5. **Edit trip + chatbot + trip history** ← **NEXT**  
6. Flights/hotels + deep-links  
7. Community  
8. Admin  

---

## Known gotchas

1. **Postgres port:** Docker `5433:5432`.
2. **Backend restart:** Required after `.env` changes.
3. **Frontend restart:** Required after `VITE_*` env changes.
4. **Tables:** `create_all` + startup `ALTER TABLE … ADD COLUMN IF NOT EXISTS itinerary_source`.
5. **Mock destinations:** Kyoto / Barcelona / Queenstown = always mock. Check `source` in API or yellow banner.
6. **LLM JSON:** Free OpenRouter models may truncate JSON → retries + `llm_json.py` salvage. Prefer **Gemini** for reliability.
7. **Generate can be slow:** LLM call only on generate now; geocoding runs in background. Vite proxy timeout extended to 5 min.
8. **No trip history:** `tripPlanId` is session-only in `HomePage` state — cannot reload a past trip from UI without Phase 5.
9. **Edit trip button:** Restarts quiz as new trip — intentional until Phase 5.
10. **Mapbox geocoding:** Queries use `{place}, {destination}` + `country=XX` from destination string. Wrong coords >120 km from destination are re-geocoded.
11. **TripMap:** Uses direct `mapbox-gl`, not `react-map-gl` (v8 caused React crashes). Blank map → check token scopes + restart `npm run dev` after worker setup change.
12. **Map routes:** Straight lines between activities per day — not walking/driving directions yet.
13. **Dense cities:** Multiple activities may still cluster in historic centers; spacing logic helps but isn't perfect.
14. **Static leftovers:** `src/data/itinerary.ts` — only "Explore Alternatives" section on result page.
15. **Activity images:** Removed fake Picsum photos; cards use honest category icons instead.

---

## Handoff — start here in next chat

1. **Commit Phase 4** ask user if he wants to commit phase 4 if not yet pushed (map, geocoding, place search, result UI polish).

2. **Phase 5 priorities:**
   - Trip history ("My Trips") — persist `tripPlanId`, list user's `trip_plans`
   - Wire `ChatbotSidebar` + `POST /api/chat/message`
   - Edit flow + dynamic alternatives API
   - "Edit Trip" should reopen existing plan, not blank quiz

3. **Optional Phase 4 polish** (when time allows):
   - Mapbox Directions API for real routes
   - Pin spacing tuning for dense destinations

**Ask for API keys only when needed:**
- Mapbox — Phase 4 (done)
- Duffel — Phase 6
- No hotel API key planned (deep-links)

---

## Verify Postgres

```sql
SELECT id, destination, status, itinerary_source FROM trip_plans ORDER BY id DESC LIMIT 5;
SELECT trip_plan_id, day_number, time_slot, name, latitude, longitude
FROM places ORDER BY trip_plan_id DESC, day_number, sort_order LIMIT 20;
```
