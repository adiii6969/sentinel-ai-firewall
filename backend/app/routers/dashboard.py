from fastapi import APIRouter, Depends
from app.core.security import get_current_user, CurrentUser
from app.core.supabase_client import supabase
from app.services import analytics_service, killswitch_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
def summary(user: CurrentUser = Depends(get_current_user)):
    org_id = user.organization_id
    analytics = analytics_service.overview(org_id)
    tx = supabase.table("transactions").select("*").eq("organization_id", org_id).order("created_at", desc=True).limit(10).execute().data or []
    alerts = supabase.table("alerts").select("*").eq("organization_id", org_id).eq("resolved", False).order("created_at", desc=True).limit(10).execute().data or []
    ks = killswitch_service.get_state(org_id)
    vendors = supabase.table("vendors").select("id", count="exact").eq("organization_id", org_id).execute()
    wallets = supabase.table("wallets").select("id", count="exact").eq("organization_id", org_id).execute()
    pending = supabase.table("pending_transactions").select("id", count="exact").eq("organization_id", org_id).eq("status", "pending").execute()
    active_agents = supabase.table("agents").select("id", count="exact").eq("organization_id", org_id).eq("status", "active").execute()
    total_agents = supabase.table("agents").select("id", count="exact").eq("organization_id", org_id).execute()
    return {
        "analytics": analytics,
        "recent_transactions": tx,
        "active_alerts": alerts,
        "killswitch": ks,
        "vendor_count": vendors.count or 0,
        "wallet_count": wallets.count or 0,
        "pending_approvals": pending.count or 0,
        "active_agents_count": active_agents.count or 0,
        "total_agents_count": total_agents.count or 0,
        "system_status": [
            {"name": "AI Firewall", "ok": True},
            {"name": "Kill Switch", "ok": not ks.get("is_active", False)},
            {"name": "Auto Freeze", "ok": True},
            {"name": "Monitoring", "ok": True},
        ],
    }
