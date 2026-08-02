"""Thin wrapper around Supabase Auth (email/password now, Google OAuth later
via the same `sign_in_with_oauth` flow — front end just needs the extra
button, no backend change required).

IMPORTANT - supabase-py version note
--------------------------------------
`.maybe_single().execute()` returns `None` (NOT a response object) when no
row exists.  Calling `.data` on None raises AttributeError.  Always use
`.limit(1).execute()` instead — it always returns a response whose `.data`
is a list (empty or not).
"""
from app.core.supabase_client import supabase, supabase_public
from app.core.exceptions import SentinelError


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _get_profile(user_id: str) -> dict | None:
    """Return the profile row for user_id, or None if it doesn't exist."""
    res = supabase.table("profiles").select("*").eq("id", user_id).limit(1).execute()
    return res.data[0] if res.data else None


def _create_org_and_profile(user_id: str, full_name: str, organization_name: str) -> dict:
    """Create an org + profile row.  If the profile already exists (trigger or race),
    just fetch and return it — never raise a duplicate-key error."""
    # Step 1 – org
    try:
        org = supabase.table("organizations").insert({"name": organization_name}).execute().data[0]
    except Exception as org_err:
        print(f"[auth] org insert failed ({org_err}), falling back to most-recent org")
        orgs = supabase.table("organizations").select("id").limit(1).execute()
        if orgs.data:
            org = orgs.data[0]
        else:
            raise SentinelError("Could not create organisation", 500)

    # Step 2 – profile
    try:
        profile = supabase.table("profiles").insert({
            "id": user_id,
            "organization_id": org["id"],
            "full_name": full_name,
            "role": "owner",
        }).execute().data[0]
        return profile
    except Exception as prof_err:
        err = str(prof_err)
        print(f"[auth] profile insert failed: {err}")
        # Duplicate key means a trigger or previous attempt already created it
        existing = _get_profile(user_id)
        if existing:
            return existing
        raise SentinelError(f"Could not create profile: {err}", 500)


# ---------------------------------------------------------------------------
# public API
# ---------------------------------------------------------------------------

def sign_up(email: str, password: str, full_name: str, organization_name: str) -> dict:
    """Register a new user.  Uses the admin API so no confirmation email is sent."""

    # --- Create the auth user ---
    try:
        result = supabase.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
        })
        user_id = result.user.id
    except SentinelError:
        raise
    except Exception as e:
        msg = getattr(e, "message", None) or str(e)
        if "already been registered" in msg or "already registered" in msg:
            # User exists from a previous partial attempt — sign them in instead
            return _recover_existing_user(email, password, full_name, organization_name)
        raise SentinelError(msg or "Sign up failed", 400)

    # --- Profile (create if not already done by a DB trigger) ---
    profile = _get_profile(user_id)
    if profile is None:
        profile = _create_org_and_profile(user_id, full_name, organization_name)

    # --- Issue a real session token ---
    try:
        session = supabase_public.auth.sign_in_with_password({"email": email, "password": password})
    except Exception as e:
        raise SentinelError(getattr(e, "message", None) or str(e) or "Sign-in after signup failed", 500)

    return {
        "access_token": session.session.access_token,
        "refresh_token": session.session.refresh_token,
        "user": {"id": user_id, "email": email, **profile},
    }


def _recover_existing_user(email: str, password: str, full_name: str, organization_name: str) -> dict:
    """User already exists in Supabase Auth.  Sign them in and ensure the profile exists."""
    try:
        session = supabase_public.auth.sign_in_with_password({"email": email, "password": password})
    except Exception as sign_in_err:
        raise SentinelError(
            getattr(sign_in_err, "message", None) or str(sign_in_err) or "Account already exists. Please sign in.",
            409,
        )
    uid = session.user.id
    profile = _get_profile(uid)
    if profile is None:
        profile = _create_org_and_profile(uid, full_name, organization_name)
    return {
        "access_token": session.session.access_token,
        "refresh_token": session.session.refresh_token,
        "user": {"id": uid, "email": email, **profile},
    }


def ensure_profile(user_id: str, email: str | None, full_name: str | None) -> dict:
    """Called after a Supabase OAuth (Google) login.  Idempotent — safe every login."""
    profile = _get_profile(user_id)
    if profile:
        return profile
    org_name = (full_name or (email or "New workspace").split("@")[0]) + "'s organization"
    return _create_org_and_profile(user_id, full_name or "", org_name)


def sign_in(email: str, password: str) -> dict:
    try:
        result = supabase_public.auth.sign_in_with_password({"email": email, "password": password})
    except Exception as e:
        msg = str(e)
        if hasattr(e, "message") and e.message:
            msg = e.message
        raise SentinelError(msg or "Invalid email or password", 401)
    profile = _get_profile(result.user.id) or {}
    return {
        "access_token": result.session.access_token,
        "refresh_token": result.session.refresh_token,
        "user": {"id": result.user.id, "email": result.user.email, **profile},
    }


def refresh(refresh_token: str) -> dict:
    result = supabase_public.auth.refresh_session(refresh_token)
    return {"access_token": result.session.access_token, "refresh_token": result.session.refresh_token}


def forgot_password(email: str):
    supabase_public.auth.reset_password_email(email)


def reset_password(access_token: str, new_password: str):
    supabase_public.auth.update_user({"password": new_password}, access_token)
