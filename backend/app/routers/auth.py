from fastapi import APIRouter, Depends, Request
from app.schemas.auth import SignUpRequest, SignInRequest, RefreshRequest, ForgotPasswordRequest, ResetPasswordRequest, TokenResponse
from app.schemas.common import Msg
from app.services import auth_service
from app.core.security import get_current_user, get_verified_supabase_user, CurrentUser
from app.core.supabase_client import supabase
from app.middleware.rate_limit import limiter

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse)
@limiter.limit("5/minute")
def signup(request: Request, body: SignUpRequest):
    return auth_service.sign_up(body.email, body.password, body.full_name, body.organization_name)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, body: SignInRequest):
    return auth_service.sign_in(body.email, body.password)


@router.post("/refresh")
def refresh(body: RefreshRequest):
    return auth_service.refresh(body.refresh_token)


@router.post("/forgot-password", response_model=Msg)
@limiter.limit("3/minute")
def forgot_password(request: Request, body: ForgotPasswordRequest):
    auth_service.forgot_password(body.email)
    return {"message": "Password reset email sent"}


@router.post("/reset-password", response_model=Msg)
def reset_password(body: ResetPasswordRequest):
    auth_service.reset_password(body.access_token, body.new_password)
    return {"message": "Password updated"}


@router.get("/me")
def me(user: CurrentUser = Depends(get_current_user)):
    profile = supabase.table("profiles").select("*").eq("id", user.id).single().execute().data
    return {"id": user.id, "email": user.email, **profile}


@router.post("/oauth-complete")
def oauth_complete(supa_user=Depends(get_verified_supabase_user)):
    """Call this once, right after Supabase redirects back from Google, with
    the Supabase session's access_token as the bearer token. Provisions an
    organization/profile on first login (no-op on later logins), then
    returns the same shape as /auth/me so the frontend can store it."""
    full_name = (supa_user.user_metadata or {}).get("full_name") or (supa_user.user_metadata or {}).get("name")
    profile = auth_service.ensure_profile(supa_user.id, supa_user.email, full_name)
    return {"id": supa_user.id, "email": supa_user.email, **profile}
