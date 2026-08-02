from app.core.supabase_client import supabase


def list_wallets(org_id: str) -> list[dict]:
    wallets = supabase.table("wallets").select("*").eq("organization_id", org_id).order("created_at", desc=True).execute().data or []
    ids = [w["agent_id"] for w in wallets if w.get("agent_id")] or ["00000000-0000-0000-0000-000000000000"]
    agents = supabase.table("agents").select("id,name,status").in_("id", ids).execute().data or []
    a_by_id = {a["id"]: a for a in agents}
    for w in wallets:
        agent = a_by_id.get(w.get("agent_id"))
        w["agent_name"] = agent["name"] if agent else "Unassigned"
        w["agent_status"] = agent["status"] if agent else None
    return wallets


def get_wallet(org_id: str, wallet_id: str) -> dict | None:
    _res = supabase.table("wallets").select("*").eq("organization_id", org_id).eq("id", wallet_id).maybe_single().execute()
    return _res.data if _res is not None else None


def create_wallet(org_id: str, data: dict) -> dict:
    return supabase.table("wallets").insert({**data, "organization_id": org_id}).execute().data[0]


def update_wallet(org_id: str, wallet_id: str, data: dict) -> dict:
    return supabase.table("wallets").update(data).eq("organization_id", org_id).eq("id", wallet_id).execute().data[0]


def freeze_wallet(org_id: str, wallet_id: str) -> dict:
    return update_wallet(org_id, wallet_id, {"status": "frozen"})


def unfreeze_wallet(org_id: str, wallet_id: str) -> dict:
    return update_wallet(org_id, wallet_id, {"status": "active"})


def delete_wallet(org_id: str, wallet_id: str):
    supabase.table("wallets").delete().eq("organization_id", org_id).eq("id", wallet_id).execute()
