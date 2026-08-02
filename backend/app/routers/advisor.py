from fastapi import APIRouter, Depends
from app.core.exceptions import SentinelError
from app.core.security import get_current_user, require_roles, CurrentUser
from app.core.supabase_client import supabase
from app.services import advisor_service, limits_service

router = APIRouter(prefix="/advisor", tags=["advisor"])


@router.get("/recommendations")
def recommendations(user: CurrentUser = Depends(get_current_user), refresh: bool = False):
    if refresh:
        advisor_service.generate(user.organization_id)
    return supabase.table("recommendations").select("*").eq("organization_id", user.organization_id).eq(
        "status", "open").order("created_at", desc=True).execute().data


@router.post("/recommendations/{rec_id}/dismiss")
def dismiss(rec_id: str, user: CurrentUser = Depends(get_current_user)):
    return supabase.table("recommendations").update({"status": "dismissed"}).eq("id", rec_id).eq(
        "organization_id", user.organization_id).execute().data[0]


@router.post("/recommendations/{rec_id}/apply")
async def apply(rec_id: str, user: CurrentUser = Depends(require_roles("admin", "owner"))):
    """Executes the recommendation's underlying action, when it's a known,
    safe-to-automate type. Anything else — removing a vendor, investigating
    an agent — still requires a human to act on the relevant page; we don't
    guess destructive actions on someone's behalf."""
    res = supabase.table("recommendations").select("*").eq("id", rec_id).eq(
        "organization_id", user.organization_id).maybe_single().execute()
    rec = res.data if res is not None else None
    if not rec:
        raise SentinelError("Recommendation not found", 404)
    if rec["status"] != "open":
        raise SentinelError(f"Recommendation already {rec['status']}", 409)

    rec_type = rec.get("rec_type")
    payload = rec.get("payload") or {}

    if rec_type == "increase_daily_limit":
        await limits_service.update_limits(user.organization_id, {"daily": payload.get("suggested_daily")})
    else:
        raise SentinelError(
            "This recommendation can't be auto-applied — please make the change on the relevant page.", 400,
        )

    return supabase.table("recommendations").update({"status": "applied"}).eq("id", rec_id).execute().data[0]
