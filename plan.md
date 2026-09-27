# RihlaTech — Development Plan & Handoff

> **Purpose:** Continue development in a new chat without losing context.  
> **Last updated:** July 2026 · **Phases 0–8 deployed** · **Refinements + Quiz redesign done** · **`dev` branch active** · **Technical summary in `docs/project-summary.md`** · **Next: polish backlog / Nice to have**

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
| AI / LLM | `backend/app/services/llm.py` | **Gemini**, **OpenRouter** (dev default), or **OpenAI**; set `LLM_PROVIDER` in `.env` |
| Maps / Geocoding | **Mapbox** (backend) + **Google Maps deep-links** (result page) | City autocomplete + Search Box POI on backend; no Google SDK |
| Flights | **Duffel** sandbox + mock/deep-link fallback | Phase 6 |
| Hotels | **Mapbox lodging POI** + mock fallback + **Booking.com deep-links** | Real names when Mapbox returns ≥3; no RapidAPI |
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

- **Git:** `main` on GitHub (`UsmMH/Rihla-Tech`) — production; **`dev`** — all active development
- **Branching (required):** Do **all work on `dev`**. Commit and push to `dev`, **not** `main`. User merges `dev` → `main` manually when ready to deploy (Vercel/Render auto-deploy from `main`).
  ```bash
  git checkout dev && git pull
  # ... work, commit ...
  git push origin dev
  # When ready to deploy: merge dev → main on GitHub (user does this)
  ```
- **Do not commit:** `.env`, `node_modules/`, `backend/.venv/`, `.phase5-backup/`, `__pycache__/`
- **Docs:** `plan.md` (this file) is the source of truth for roadmap/status. `docs/project-summary.md` is the technical reference (system architecture, LLM provider-adapter diagram, data model ERD, user-flow diagrams). `README.md` is the concise front door.

---

## Project structure

```
Rihla-Tech/
├── backend/app/
│   ├── main.py
│   ├── models/
│   ├── routers/          auth, quiz, trips, places, chat, community, admin, health
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
│   └── lib/trips.ts, community.ts, quizValidation.ts, places.ts, mapDirections.ts, admin.ts, pwa.ts
├── public/               manifest.json, sw.js, rihlatech-logo.png (PWA)
├── docs/
│   └── project-summary.md  # Technical deep-dive: architecture, LLM layer, data model, flows
├── vercel.json           Frontend-only Vite deploy
├── render.yaml           Backend deploy (Render)
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

**Quiz steps (when destination known):** destination_known → dates → destination → include flights? → [airport origin if yes] → travelers → preferences → result.

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
| GET | `/api/places/search?q=&kind=city\|airport` | City autocomplete (destination) or airport autocomplete (origin when flights=yes) |
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

## Current priority — Refinements & polish

Phase 8 (admin + deploy + PWA) is **done**. **High + Medium refinements** and **Quiz Flow Redesign** are **done**.

**Where we are:** Core FYP feature set is complete. **`dev` branch** has bug fixes and polish (long-trip itinerary, flight/hotel links, Mapbox hotels). Merge `dev` → `main` when ready to deploy.

**Next (pick one):**
1. **Merge `dev` → `main`** — deploy itinerary + hotel/flight polish to Vercel/Render when tested.
2. **Polish backlog** — multi-city trips, email validation, destination picker TBD bug.
3. **Nice to have** — nationality/passport question, Images API (Pexels).

Fix **one item at a time**; mark `[x]` when done.

---

## Phase 8 — Admin + deployment ✅

- [x] Admin API (`/api/admin/*`) — stats, users, trips, unshare, delete
- [x] Admin dashboard UI (Profile → Admin dashboard, `is_admin` only)
- [x] `promote_admin.py` script
- [x] Deploy configs: `render.yaml`, `vercel.json`, `.vercelignore`, `.env.example`
- [x] Deployed: **Vercel** (frontend) + **Render** (API) + **Neon** (Postgres 16)
- [x] PWA: `public/manifest.json`, `public/sw.js`, mobile meta tags in `index.html`
- [x] Production smoke-tested (login, quiz, generate, community, admin)

### Admin API

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/stats` | User/trip/shared/comment counts |
| GET | `/api/admin/users` | List users |
| PATCH | `/api/admin/users/{id}` | Toggle `is_admin` |
| GET | `/api/admin/trips` | List all trips |
| DELETE | `/api/admin/trips/{id}` | Delete any trip |
| DELETE | `/api/admin/trips/{id}/share` | Unshare (moderation) |

**Promote admin:** `cd backend && .\.venv\Scripts\python scripts\promote_admin.py you@example.com`

---

## Refinements & Known Issues

Fix **one item at a time**; mark `[x]` when done; note what changed inline or in git commit.

### High priority

- [x] **Credentials validation (email & password format)** — frontend + backend.  
  *Files:* `src/pages/LoginPage.tsx`, `RegisterPage.tsx`, `backend/app/schemas/user.py`, `backend/app/services/auth.py`  
  *Done:* `credentialsValidation.ts` + `auth.py` — email format + trim/lowercase; register password ≥8 chars, letter + number; mirrored in Pydantic validators. **Follow-up:** stricter TLD rule (reject `user@domain.co`-style typos; require 3+ char TLD unless multi-part domain like `.co.uk`).

- [x] **Remove unnecessary developer notes visible to users** — scan UI copy for TODOs, debug text, internal labels.  
  *Files:* grep `TODO`, `debug`, `developer` in `src/`  
  *Done:* Removed LLM provider badges (Gemini/OpenRouter/Duffel), technical `fallback_reason` text, and sandbox labels from destination picker + trip result.

- [x] **Destination button wrong when destination already known** — still shows "Find my destination"; fix label/navigation logic.  
  *Files:* `PreferencesPage.tsx`, `DestinationPickerPage.tsx`, quiz flow in `HomePage.tsx`  
  *Done:* Preferences final button shows "Generate My Itinerary" when destination was set in quiz; "Find My Destination" only for "not sure" path.

- [x] **Show/hide password toggle** on login and register.  
  *Files:* `LoginPage.tsx`, `RegisterPage.tsx`, `AuthLayout.tsx`  
  *Done:* Shared `PasswordField` component with eye toggle on both auth forms.

- [x] **Clarify flight/hotel cost** — per person vs total on result cards.  
  *Files:* `TripResult.tsx`, flight/hotel card sections, `backend/app/services/flights.py`, `hotels.py`  
  *Done:* `price_note` on offers — Duffel = total for all travelers; mock flights = est. per person; hotels = per room per night + guest count.

- [x] **Wrong loading copy when reopening saved trip** — shows "Generating Your AI Itinerary"; should say "Loading your trip" when trip already exists.  
  *Files:* `TripResult.tsx` (`GET /trips/{id}` path vs `POST /trips/generate` path)  
  *Done:* `loadingPhase` — "Loading your trip..." on fetch; generation copy only when calling `POST /trips/generate`.

- [x] **Partial generation failures** — if flights/hotels load but itinerary is empty, show clear error + retry button (or auto-retry once before error).  
  *Files:* `TripResult.tsx`, `src/lib/trips.ts`  
  *Done:* `tripHasItineraryActivities()` + auto-retry once on generate; inline error + "Retry itinerary" when days stay empty.

### Medium priority

- [x] **Local trips (origin = destination)** — **superseded** by Quiz Flow Redesign.  
  *Origin skipped when flights not included; airport origin uses `cities_conflict()` when flights=yes.*

- [x] **Hide profile / distracting UI during trip planning flow** — quiz, preferences, destination picker, generating.  
  *Files:* `Navbar.tsx`, `QuestionFlow.tsx`, `QuizPage.tsx`, `PreferencesPage.tsx`  
  *Done:* `PlanningBackHeader` — back arrow only on quiz, preferences, destination picker, and trip result until itinerary has activities; full navbar returns after.

- [x] **Center and improve loading animation** during AI generation.  
  *Files:* `TripResult.tsx`, possibly shared loading component  
  *Done:* `TripPlanningLoader` — centered dual-ring animation + logo pulse; used on trip result loading/generating screen.

- [x] **Fix share button placement** on trip result.  
  *Files:* `TripResult.tsx`  
  *Done:* Share moved to top bar (opposite My Trips); Ask AI stays desktop hero + mobile floating bar.

- [x] **Make preferences questions more dynamic and varied** — reduce repetition vs quiz phase.  
  *Files:* `backend/app/data/quiz_seed.py`, `QuestionFlow.tsx`, preferences API  
  *Done:* Added pace + multi-select interests; merged flights/hotels into optional `travel_extras`; refreshed copy; seed upserts preferences on restart.

### Nice to have

- [x] **Remove "Suggested Cities" label** in city search UI.  
  *Files:* `OriginCityInput.tsx` or related search components  
  *Done:* Removed suggestions header; dropdown shows city rows only.

- [x] **Add airports to origin search** (Duffel + Mapbox Search Box).  
  *Files:* `backend/app/services/flights.py`, `geocoding.py`, `place_labels.py`, `routers/places.py`, `OriginCityInput.tsx`  
  *Done:* `/places/search?kind=airport` on origin step; **Duffel** `/places/suggestions` primary (handles `RUH`, `King kh`); Mapbox Search Box `poi_category=airport` fallback; IATA in label; `cities_conflict()` blocks same-city departures; cross-field validation on origin step. **Follow-up fixed:** Google Flights deep-link now uses IATA codes + `through` return date (`flights.py`).

- [ ] **Images API** (Pexels preferred) for trip result / destination visuals.  
  *needs `PEXELS_API_KEY` in env.*

- [ ] **Nationality/passport question** for visa limitation awareness in quiz/preferences.  
  *Files:* quiz seed, `QuestionFlow`, backend quiz models — **next Nice to have if continuing.*

---
  
## Quiz Flow Redesign ✅

- [x] **Conditional origin question** — only ask for origin if the user wants flight suggestions. Flow: Destination → "Include flights?" → Yes: airport origin / No: skip origin entirely.  
  *Done:* `include_flights` quiz step; origin hidden when "No flights needed"; preferences `travel_extras` = hotels only; backend clears origin when flights declined.

- [x] **Mapbox city normalization** — store destination cities as `"City, Country"`; dedupe `Al-Riyadh` → `Riyadh`.  
  *Done:* `_normalize_city_label()` in `geocoding.py`; used in `/places/search?kind=city`.

---

## Git workflow (top priority)

- [x] **`dev` branch set up** — create `dev` from current `main` if it does not exist; all future work happens on `dev`.
  ```bash
  git checkout main && git pull
  git checkout -b dev    # skip if dev already exists
  git push -u origin dev
  ```
- **Rule:** Commit and push to **`dev` only**. Never push to `main`. User merges `dev` → `main` on GitHub when ready to deploy to Vercel/Render.

---

## Bugs (fix on `dev`)

- [x] **Itinerary generation fails for trips ≥ 6 nights** — user reports generate fails when the trip is 6 nights or longer (quiz allows up to 14 nights). Likely LLM output truncation, JSON parse errors, or day-count handling in `backend/app/services/itinerary.py` / `llm.py`. Reproduce: 7+ day range → `POST /trips/generate` → empty days or error on result page.  
  *Files:* `itinerary.py`, `llm_json.py`  
  *Done:* Scale `max_tokens` with trip length (`itinerary_max_tokens`); `parse_llm_itinerary_object` salvages truncated `days` arrays and validates day count; retries bump token budget.

---

## Polish backlog (not scheduled)

- [ ] **Multi-city / multi-country trips** — support users who want to visit multiple cities in one country or across countries in a single trip (quiz UX, itinerary structure, flights/hotels per leg). *Product decision needed: one trip vs linked sub-trips.*
- [x] **Fix hotel card names and Booking.com links** — mock hotels reuse similar names; each card’s link currently goes to the same generic search URL instead of a distinct property/search.  
  *Done:* Mapbox lodging POI search for real hotel names (fallback to mock if fewer than 3 results); per-card Booking.com search uses `"{name}, {city}"` with trip dates/guests.
- [x] **Fix flight card booking links** — individual flight offers share the same Google Flights URL; each card should deep-link to a route-appropriate search (or offer-specific when available).  
  *Done:* Per-offer Google Flights URL uses segment IATA codes (Duffel) or airline name (mock) so each card differs.
- [ ] **Combine hotels + flights booking question** — optional single preferences step ("Booking links") instead of flights in quiz + hotels in preferences. User undecided; low priority.
- [ ] **Email validation edge cases** — e.g. `email123@gmail.cos` still passes; stricter TLD/format rules.
- [ ] **Destination picker TBD bug** — if user exists during AI destination suggestion, destination may be set TBD; "try again" can ask to add destination confusingly.

## Deferred (not in refinement sprint)

- [ ] Desktop home/dashboard wide-screen layout
- [ ] Persist consult chat server-side
- [ ] `/welcome` marketing route

---

## Phase 8 archive — deploy checklist

<details>
<summary>Vercel + Render + Neon (completed)</summary>

1. **Neon** — Postgres 16; `DATABASE_URL` on Render
2. **Render** — `render.yaml`, root `backend/`, health `/api/health`
3. **Vercel** — `vercel.json`, `VITE_API_BASE_URL=https://<api>.onrender.com/api`
4. **Render** — `CORS_ORIGINS` = Vercel URL
5. **Promote admin** on prod via `promote_admin.py`
6. Test all fixes locally first (localhost:5173 + localhost:8000). After we verify, we push to GitHub when ready to deploy.

</details>

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
8. Admin + deploy + PWA ✅  
9. **Refinements** — done (High/Medium + quiz redesign + airport search)  
10. **Nice to have** — nationality question, Images API (deferred)

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
14. **Quiz validation:** City/airport must be picked from suggestions when API returns matches; backend re-validates on submit.
15. **Airport search:** Uses **Duffel** `places/suggestions` (needs `DUFFEL_ACCESS_TOKEN`); Mapbox Search Box airport POI as fallback. Mapbox Geocoding v5 `types=poi` does **not** return airports — do not use for origin.
16. **Quiz re-seed:** Restart backend after pull so `include_flights`, origin copy, and preferences questions update.
17. **Google Flights link:** Built with IATA codes when available — `Flights from RUH to CDG on YYYY-MM-DD through YYYY-MM-DD`.
18. **Long trips:** Itinerary generate for 6+ nights — fixed via scaled token budget + itinerary JSON salvage (July 2026).
19. **Git:** All work on **`dev`** branch; push to `dev`. Merge `dev` → `main` only when ready to deploy (user merges manually).
20. **Hotels:** Mapbox Search Box `poi_category=hotel` for real names when ≥3 results; mock fallback otherwise. Prices are tier estimates. Some cities (e.g. Tokyo) have sparse Mapbox hotel POI — mock cards used.
21. **Flight cards:** Each offer has its own Google Flights deep-link (IATA + airline per offer).

---

## Handoff — start here in next chat

1. **`git checkout dev && git pull`** — all active work is on `dev`; never push to `main`.
2. **Test on `dev`:** 7+ night itinerary generate; hotels section (Mapbox real names + Booking links); flight card links.
3. **When ready:** merge `dev` → `main` on GitHub to deploy (Vercel + Render auto-deploy from `main`).
4. **Then pick:** multi-city trips, nationality question, Images API, or email validation polish.
5. Restart backend after pull (quiz seed).

**Recent session (July 2026):** On `dev` — long-trip itinerary fix (`itinerary_max_tokens` scaling + JSON salvage), per-card flight/hotel Booking links, Mapbox lodging hotel names with mock fallback, and added `docs/project-summary.md` (technical reference with architecture + LLM diagrams). All High/Medium refinements + Quiz redesign confirmed complete.

---

## Copy-paste prompt for new chat

```
I'm working on RihlaTech — AI travel planning web app (KSU IS498 capstone).
Read plan.md and README.md first; plan.md is the source of truth.

Repo: UsmMH/Rihla-Tech — work on **`dev`** branch (merge to `main` only when deploying)
Stack: React 18 + Vite + Tailwind + FastAPI + PostgreSQL 16 + Gemini/Duffel/Mapbox
Deployed: Vercel (frontend) + Render (API) + Neon (DB). PWA enabled. Prod deploys from `main`.

Done: Phases 0–8 + Refinements + Quiz redesign + airport origin (Duffel).
On `dev` (not yet merged to main): long-trip itinerary fix (≥6 nights), per-card flight Google Flights links, Mapbox lodging hotels + Booking.com deep-links.

CURRENT WORK (priority order):
1. Test `dev` locally (7+ nights, hotels Mapbox, flight links) — then merge `dev` → `main` when ready
2. Polish backlog: multi-city trips, email validation, destination picker TBD bug
3. Nice to have: nationality question, Images API (Pexels)

Constraints:
- Work on `dev`: git checkout dev && git pull → commit → git push origin dev
- No Google Maps SDK; deep-links OK
- No RapidAPI hotel scrapers; no Booking.com API (deep-links only)
- Don't commit .env, .phase5-backup/, node_modules/, backend/.venv/
- Ask before git commit unless I say to commit
- Minimal scope per fix; match existing code style

Notes:
- Hotels: Mapbox `poi_category=hotel` → real names; mock fallback if <3 results or API fails
- Hotel/flight prices on cards are estimates unless Duffel returns real flight totals
- Origin airport search = Duffel primary; needs DUFFEL_ACCESS_TOKEN
- Flights=no skips origin; hotels optional in preferences travel_extras
- Restart backend after pull for quiz seed
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
