"""Two Supabase clients:
- `supabase`: service-role key, used by the backend for all DB writes/reads.
  RLS is bypassed here by design — the FastAPI layer IS the trust boundary.
- `supabase_public`: anon key, used only to proxy Auth calls (sign in/up)
  so Supabase issues real user JWTs.
"""
from supabase import create_client, Client
from app.core.config import settings

supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
supabase_public: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
