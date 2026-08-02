# Sentinel Backend

FastAPI + Supabase backend for the Sentinel AI Spending Firewall. Talks to
Supabase Postgres via the service-role key (server is the trust boundary),
Supabase Auth for identity, and pushes realtime events over a native
FastAPI WebSocket at `/api/v1/ws`.

## 1. Supabase setup

1. Create a project at supabase.com.
2. SQL Editor → run `app/database/schema.sql` (creates all tables, indexes, RLS).
3. Settings → API → copy `URL`, `anon` key, `service_role` key.
4. Settings → API → JWT Settings → copy the JWT secret.
5. (Optional, later) Authentication → Providers → enable Google, add your
   OAuth client ID/secret — no backend code change needed, the frontend
   just calls `supabase.auth.signInWithOAuth({provider:'google'})` and Supabase
   redirects back with a session; our `/auth/me` endpoint accepts that JWT.

## 2. Local run

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in Supabase values
uvicorn app.main:app --reload --port 8000
```

Swagger docs: http://localhost:8000/docs

## 3. Seed a first organization

Sign up via `POST /api/v1/auth/signup` — this creates the `organizations`
row and an `owner` profile automatically. Then create a wallet/agent/vendor
via SQL or the respective endpoints to start submitting transactions.

## 4. Deploy

- **Backend** → Railway or Render: set the same env vars as `.env`, start
  command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- **Frontend** → Vercel: static hosting, no build step. Set `window.SENTINEL_API_BASE`
  (see `js/api.js`) to your deployed backend URL.
- **Database** → already hosted by Supabase.

## API surface (all under `/api/v1`, Swagger has full schema)

- `auth`: signup, login, refresh, forgot/reset password, me
- `dashboard`: `/dashboard/summary` — single call powering the dashboard page
- `firewall`: `/firewall/transaction` (AI submits spend), `/firewall/pending`, `/firewall/pending/{id}/decide`, `/firewall/rules`
- `risk`: history, scores, alerts
- `vendors`: CRUD + reputation
- `transactions`: list/filter/paginate
- `limits`: get/update spending caps
- `killswitch`: get state, toggle (freezes agents/wallets/pending tx instantly)
- `advisor`: `/advisor/recommendations?refresh=true` regenerates rule-based recs
- `analytics`: `/analytics/overview`
- `audit`: list, `/audit/verify` (recomputes hash chain), `/audit/export.csv`
- `notifications`: list, mark read
- `ws`: `GET /api/v1/ws?token=<jwt>` — realtime push for transactions/killswitch/notifications

## Design notes (why some spec items were simplified for a lean MVP)

- **No SQLAlchemy/Alembic** — the Supabase Python client talks straight to
  Postgres with the service-role key; `schema.sql` is the single source of
  truth for the schema, applied directly in the Supabase SQL editor.
- **No Redis** — nothing here yet needs a cache; add it if a specific
  endpoint becomes a bottleneck under real load.
- **"Blockchain audit trail"** is a SHA-256 hash-chained ledger
  (`audit_logs.prev_hash` → `hash`, verifiable via `/audit/verify`) plus a
  `blockchain_records` table with block/signature fields shaped so it can
  be pointed at a real chain later without changing the API contract.
- **AI Risk Score / Advisor** are rule-based (per your instruction) —
  deterministic, free to run on every request, and each output includes
  the specific factors/reasons that produced it.
