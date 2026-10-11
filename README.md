<div align="center">

# RihlaTech

**Powered by AI, driven by you.**

[![React](https://img.shields.io/badge/React_18-61DAFB?style=flat-square&logo=react&logoColor=black)]()
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)]()
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-4169E1?style=flat-square&logo=postgresql&logoColor=white)]()
[![AI](https://img.shields.io/badge/AI-Gemini-8B5CF6?style=flat-square)]()

**Live demo → [rihla-tech.vercel.app](https://rihla-tech.vercel.app)**

*King Saud University — IS498 Final Year Project*

</div>

---

## What is it?

Planning a trip usually means juggling dates, budgets, and a dozen open tabs. **RihlaTech**
turns a short quiz and a few preferences into a personalized, day-by-day travel itinerary
in minutes. An AI travel companion helps you refine the plan, every stop links straight to
Google Maps, and you can share your trips with a community of other travelers.

---

## How it works

```mermaid
flowchart LR
    A[Sign up & verify email] --> B[Answer a short quiz]
    B --> C[Pick your preferences]
    C --> D[AI builds your itinerary]
    D --> E[Refine it by chatting]
    E --> F[Flights / hotels / share]
```

---

## Key features

- **AI itinerary** — day-by-day plan with real venue names, tailored to dates, budget, and interests
- **Destination suggestions** — when you are not sure where to go yet
- **Travel chatbot** — ask questions and apply itinerary edits in plain language
- **Flights** — [SerpApi](https://serpapi.com/) Google Flights (SAR), cached per trip; quiz asks **round trip vs one way**; round trip: pick outbound → return options → book via airline checkout; one way: book from outbound when available; Google Flights fallback links
- **Airports** — Duffel place search for departure/destination IATA (quiz autocomplete + resolution)
- **Hotels** — Mapbox lodging suggestions with Booking.com search links (optional in quiz)
- **Maps** — Google Maps deep-links per activity and day routes
- **Community** — share trips, discover, vote, save, comment
- **Email verification** — Resend one-time codes on register (configurable)
- **Installable PWA** — mobile and desktop

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion |
| Backend | FastAPI, SQLAlchemy, PostgreSQL |
| Auth | JWT + bcrypt; optional email verification (Resend) |
| AI | Gemini, OpenRouter, or OpenAI (`LLM_PROVIDER`) |
| Geocoding & cities | Mapbox |
| Flights | SerpApi `google_flights` (quota + DB cache); Duffel **only** for airport autocomplete |
| Hotels | Mapbox lodging POI + Booking.com deep-links |
| Deploy | Vercel (SPA) · Render (API, `render.yaml`) · Neon (`DATABASE_URL`) |

---

## Progress

| Phase | Status | Summary |
|-------|--------|---------|
| Setup & auth | ✅ | FastAPI, PostgreSQL, JWT, email verification |
| Quiz & preferences | ✅ | Logistics quiz, round/one-way flights, preferences, AI destinations |
| AI itinerary | ✅ | Day-by-day generation persisted per user |
| Maps & chat | ✅ | Google Maps links, chatbot, apply-edit |
| Flights | ✅ | SerpApi search, cache, booking flow, mock mode for dev |
| Hotels | ✅ | Mapbox + mock/Booking links |
| Community & admin | ✅ | Share, discover, moderation dashboard |
| Deploy & PWA | ✅ | Vercel + Render + Neon |

**Deferred:** multi-city trips, SerpApi hotels UI migration, images API. See [`plan.md`](plan.md) and [`SERPAPI_PLAN.md`](SERPAPI_PLAN.md).

---

## Run locally

**Prerequisites:** Node.js 18+, **Python 3.11+** (match `PYTHON_VERSION` in `render.yaml`), Docker Desktop.

```bash
# 1. Environment — copy and fill keys (see comments in file)
cp .env.example .env

# Minimum for a full local run:
#   JWT_SECRET, GEMINI_API_KEY or OPENROUTER_API_KEY, MAPBOX_ACCESS_TOKEN
# Flights without spending SerpApi credits:
#   SERPAPI_MOCK=true
# Live flight search:
#   SERPAPI_API_KEY=...  and  SERPAPI_MOCK=false
# Airport quiz autocomplete / resolution:
#   DUFFEL_ACCESS_TOKEN=...

# 2. Install
npm install
cd backend && python -m venv .venv
.venv\Scripts\pip install -r requirements.txt    # Windows
# source .venv/bin/activate && pip install -r requirements.txt   # macOS/Linux

# 3. Database (host port 5433)
docker compose up -d

# 4. Backend (from backend/)
.\.venv\Scripts\uvicorn app.main:app --reload --port 8000

# 5. Frontend (repo root)
npm run dev
```

Open **http://localhost:5173**. Restart backend after `.env` changes.

**Checks:** `npm run typecheck` · `npm run build` · `python backend/scripts/test_serpapi.py` (DB + mock SerpApi/flights)

---

## Production environment

**Render (API)** — see [`render.yaml`](render.yaml). Set in the dashboard (not in git):

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Neon Postgres (`postgresql://…` is rewritten to `psycopg2` in app) |
| `JWT_SECRET` | Long random string |
| `CORS_ORIGINS` | Your Vercel URL(s), comma-separated |
| `APP_ENV` | `production` |
| `GEMINI_API_KEY` / `OPENROUTER_API_KEY` | At least one LLM |
| `MAPBOX_ACCESS_TOKEN` | Geocoding |
| `DUFFEL_ACCESS_TOKEN` | Airport search in quiz |
| `SERPAPI_API_KEY` | Live flights (`SERPAPI_MOCK=false` on Render) |
| `RESEND_API_KEY` + `RESEND_FROM_EMAIL` | If `REQUIRE_EMAIL_VERIFICATION=true` |

Optional SerpApi tuning: `SERPAPI_MONTHLY_CAP` (default `210`), `SERPAPI_HOURLY_CAP`, `SERPAPI_USER_MONTHLY_CAP`, `SERPAPI_CACHE_TTL_HOURS`.

**Vercel (frontend):** `VITE_API_BASE_URL=https://<your-render-service>.onrender.com/api`

Pin **`PYTHON_VERSION=3.11.9`** on Render if the service is not created from the Blueprint (avoids accidental Python 3.14).

---

## Documentation

- **[`docs/project-summary.md`](docs/project-summary.md)** — architecture, LLM layer, data model, flows
- **[`plan.md`](plan.md)** — roadmap and API notes
- **[`SERPAPI_PLAN.md`](SERPAPI_PLAN.md)** — flights/hotels SerpApi design and quotas

---

## License

Academic capstone project — KSU IS498. Not licensed for commercial use.
