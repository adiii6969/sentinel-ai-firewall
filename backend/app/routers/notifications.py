from fastapi import APIRouter, Depends
from app.core.security import get_current_user, CurrentUser
from app.core.supabase_client import supabase

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(user: CurrentUser = Depends(get_current_user)):
    return supabase.table("notifications").select("*").eq("organization_id", user.organization_id).order(
        "created_at", desc=True).limit(50).execute().data


@router.post("/{notification_id}/read")
def mark_read(notification_id: str, user: CurrentUser = Depends(get_current_user)):
    return supabase.table("notifications").update({"read": True}).eq("id", notification_id).eq(
        "organization_id", user.organization_id).execute().data[0]
