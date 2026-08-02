from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.supabase_client import supabase, supabase_public

bearer_scheme = HTTPBearer(auto_error=False)


class CurrentUser:
    def __init__(self, id: str, email: str | None, role: str, organization_id: str | None):
        self.id = id
        self.email = email
        self.role = role
        self.organization_id = organization_id


async def get_verified_supabase_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)):
    """Verifies the bearer token with Supabase but does NOT require a
    `profiles` row to exist yet. Used only for the OAuth-completion endpoint,
    since a first-time Google sign-in has no profile/organization until we
    create one."""
    if creds is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    try:
        user_resp = supabase_public.auth.get_user(creds.credentials)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    if not user_resp or not user_resp.user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return user_resp.user


async def get_current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> CurrentUser:
    if creds is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    # Ask Supabase itself to verify the token instead of hand-decoding it.
    # This avoids HS256-secret / asymmetric-signing-key mismatches entirely,
    # since newer Supabase projects sign tokens with rotating ES256/RS256
    # "JWT Signing Keys" rather than the legacy shared "JWT Secret".
    try:
        user_resp = supabase_public.auth.get_user(creds.credentials)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    if not user_resp or not user_resp.user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user_id = user_resp.user.id

    profile = supabase.table("profiles").select("role,organization_id").eq("id", user_id).single().execute()
    if not profile.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No profile found for user")

    return CurrentUser(
        id=user_id,
        email=user_resp.user.email,
        role=profile.data["role"],
        organization_id=profile.data["organization_id"],
    )


def require_roles(*roles: str):
    """Demo mode: any authenticated user with a valid profile is authorized.
    (roles kept as a parameter so call sites are unchanged and this can be
    re-tightened later; the check itself is intentionally permissive.)"""
    async def _checker(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        return user
    return _checker
