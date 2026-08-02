from fastapi import APIRouter, Depends
from app.core.security import get_current_user, CurrentUser
from app.core.supabase_client import supabase

router = APIRouter(prefix="/risk", tags=["risk"])


@router.get("/history")
def history(user: CurrentUser = Depends(get_current_user)):
    return supabase.table("risk_history").select("*").eq("organization_id", user.organization_id).order("created_at", desc=True).limit(50).execute().data


@router.get("/scores")
def scores(user: CurrentUser = Depends(get_current_user)):
    return supabase.table("risk_scores").select("*").eq("organization_id", user.organization_id).order("created_at", desc=True).limit(50).execute().data


@router.get("/alerts")
def alerts(user: CurrentUser = Depends(get_current_user)):
    return supabase.table("alerts").select("*").eq("organization_id", user.organization_id).order("created_at", desc=True).limit(50).execute().data


@router.post("/alerts/{alert_id}/resolve")
def resolve(alert_id: str, user: CurrentUser = Depends(get_current_user)):
    return supabase.table("alerts").update({"resolved": True}).eq("id", alert_id).eq("organization_id", user.organization_id).execute().data[0]
