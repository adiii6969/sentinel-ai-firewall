from app.core.supabase_client import supabase
from app.utils.ws_manager import ws_manager


def list_vendors(org_id: str) -> list[dict]:
    vendors = supabase.table("vendors").select("*").eq("organization_id", org_id).execute().data or []
    reps = supabase.table("vendor_reputation").select("*").in_(
        "vendor_id", [v["id"] for v in vendors] or ["00000000-0000-0000-0000-000000000000"]
    ).execute().data or []
    rep_by_vendor = {r["vendor_id"]: r for r in reps}
    for v in vendors:
        v["reputation_score"] = rep_by_vendor.get(v["id"], {}).get("score", 50)
    return vendors


def get_vendor(org_id: str, vendor_id: str) -> dict | None:
    _res = supabase.table("vendors").select("*").eq("organization_id", org_id).eq("id", vendor_id).maybe_single().execute()
    v = _res.data if _res is not None else None
    if not v:
        return None
    _rep_res = supabase.table("vendor_reputation").select("*").eq("vendor_id", vendor_id).maybe_single().execute()
    rep = _rep_res.data if _rep_res is not None else None
    v["reputation_score"] = rep["score"] if rep else 50
    return v


async def create_vendor(org_id: str, data: dict) -> dict:
    row = supabase.table("vendors").insert({**data, "organization_id": org_id}).execute().data[0]
    supabase.table("vendor_reputation").insert({"vendor_id": row["id"], "score": 50}).execute()
    row["reputation_score"] = 50
    await ws_manager.broadcast(org_id, {"channel": "vendors", "data": {"action": "created", "vendor": row}})
    return row


async def update_vendor(org_id: str, vendor_id: str, data: dict) -> dict:
    row = supabase.table("vendors").update(data).eq("organization_id", org_id).eq("id", vendor_id).execute().data[0]
    await ws_manager.broadcast(org_id, {"channel": "vendors", "data": {"action": "updated", "vendor": row}})
    return row


async def delete_vendor(org_id: str, vendor_id: str):
    supabase.table("vendors").delete().eq("organization_id", org_id).eq("id", vendor_id).execute()
    await ws_manager.broadcast(org_id, {"channel": "vendors", "data": {"action": "deleted", "vendor_id": vendor_id}})
