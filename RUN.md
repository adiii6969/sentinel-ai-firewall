# Sentinel — Run Guide

## 0. What changed in this pass
- Added the missing `backend/.env.example` (README referenced it, it didn't exist — nobody could have followed the README as written).
- Advisor "Apply" button is now real: `POST /advisor/recommendations/{id}/apply`, wired to the UI.
  Only the "increase daily limit" recommendation auto-applies (safe, reversible). Others still
  correctly require a human — the original "Dismiss only" design was right for anything destructive.
- The "Simulate payment request" button on the Firewall page existed in HTML but had no JS behind
  it. It now opens a modal, loads your real agents/wallets/vendors, and submits through the real
  `/firewall/transaction` pipeline (risk scoring, limits, rules — not a separate fake path).
- Google OAuth: wired end-to-end (`js/oauth.js`, `login.html`, `register.html`,
  `POST /auth/oauth-complete`). Fixed a real bug along the way: a first-time Google login would
  have 403'd forever because only email/password signup created the organization/profile row —
  added `auth_service.ensure_profile()` to provision it on first OAuth login.
- Added `backend/Dockerfile`, `Dockerfile.frontend`, `docker-compose.yml`.
- Added `backend/tests/test_advisor_service.py` covering the new apply logic.

## 1. Supabase (needed either way — Docker or local)
1. Create a project at supabase.com.
2. SQL Editor → run `backend/app/database/schema.sql`.
   - If you already ran an older version of this file on an existing project, also run
     `backend/app/database/migrations/002_recommendations_apply.sql` (adds two columns).
3. Settings → API → copy `URL`, `anon` key, `service_role` key, and (API → JWT Settings) the JWT secret.
4. Copy `backend/.env.example` to `backend/.env` and fill those four values in.

## 2. Run locally (no Docker)
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
In a second terminal, from the project root:
```bash
python -m http.server 5500
```
Open http://localhost:5500/index.html. Swagger docs: http://localhost:8000/docs

## 3. Run with Docker
```bash
cp backend/.env.example backend/.env   # fill in your Supabase values first
docker compose up --build
```
Backend on http://localhost:8000, frontend on http://localhost:5500.

## 4. Google OAuth (optional)
1. In Supabase: Authentication → Providers → Google → enable it, using your own Google Cloud
   OAuth client ID/secret (Google Cloud Console → Credentials → OAuth client ID, type "Web
   application", authorized redirect URI is the one Supabase shows you on that screen).
2. Open `js/oauth.js` and set `window.SENTINEL_SUPABASE_URL` and
   `window.SENTINEL_SUPABASE_ANON_KEY` to your project's values (same anon key as `.env`, safe
   to expose client-side).
3. That's it — the "Continue with Google" buttons on `login.html`/`register.html` now work; no
   backend code change needed beyond what's already wired.

## 5. First login
`POST /api/v1/auth/signup` via the UI register page creates your first organization + owner
account automatically. Then add a wallet/agent/vendor from their respective pages (or SQL) before
submitting transactions.

## 6. Run the test suite
```bash
cd backend
pip install -r requirements.txt
pytest
```

## 7. Still outstanding — needs a decision or credentials from you
These weren't attempted because each needs something only you can provide, and guessing would
mean shipping code nobody can actually verify:

| Item | What's needed from you |
|---|---|
| Real payment rail (Stripe) | Stripe test/live keys, and a decision on sync vs. webhook-driven settlement |
| Real blockchain settlement | Which chain/testnet (or confirm the hash-chained Postgres ledger is fine for now) |
| Email/SMS/Slack notifications | A provider (Resend/SendGrid, Twilio, or a Slack webhook URL) |
| CI/CD + hosting | Target platform (Railway, Render, Fly.io, AWS, etc.) |
| Full router/E2E test suite | No blocker — just a larger, separate pass; happy to do it next |

Tell me which of these to do next (or say "all", and I'll go in order) and, where relevant, hand
me the credentials/decisions above.
