from datetime import datetime, timezone
from app.core.exceptions import SentinelError
from app.core.supabase_client import supabase
from app.utils.ws_manager import ws_manager

_MAX_REASON_LEN = 500


def get_state(org_id: str) -> dict:
    res = supabase.table("killswitch").select("*").eq("organization_id", org_id).maybe_single().execute()
    if res is not None and res.data:
        return res.data
    return supabase.table("killswitch").insert({"organization_id": org_id, "is_active": False}).execute().data[0]


async def toggle(org_id: str, is_active: bool, reason: str | None, actor_id: str) -> dict:
    if not actor_id:
        raise SentinelError("An authenticated actor is required to toggle the kill switch", 401)
    if reason and len(reason) > _MAX_REASON_LEN:
        raise SentinelError(f"reason must be under {_MAX_REASON_LEN} characters", 422)
    if is_active and not reason:
        reason = "Manually triggered — no reason provided"

    payload = {"is_active": is_active, "reason": reason, "updated_at": datetime.now(timezone.utc).isoformat()}
    if is_active:
        payload["triggered_by"] = actor_id
        payload["triggered_at"] = datetime.now(timezone.utc).isoformat()
    state = get_state(org_id)
    if state.get("is_active") == is_active:
        # No-op toggle — still return current state without re-freezing/re-broadcasting spuriously.
        return state
    row = supabase.table("killswitch").update(payload).eq("id", state["id"]).execute().data[0]

    if is_active:
        # Freeze every active agent + wallet immediately
        supabase.table("agents").update({"status": "frozen"}).eq("organization_id", org_id).eq("status", "active").execute()
        supabase.table("wallets").update({"status": "frozen"}).eq("organization_id", org_id).eq("status", "active").execute()
        supabase.table("pending_transactions").update({"status": "rejected"}).eq("organization_id", org_id).eq("status", "pending").execute()

    await ws_manager.broadcast(org_id, {"channel": "killswitch", "data": row})
    return row
