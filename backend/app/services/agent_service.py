"""AI Agent Management — register, freeze, rotate session keys, and expose
per-agent spending history / risk so the firewall and dashboard have a real
subject to attach policy, wallets, and audit records to."""
import secrets
from datetime import datetime, timezone
from app.core.supabase_client import supabase


def _gen_session_key() -> str:
    return "sk_live_" + secrets.token_hex(16)


def list_agents(org_id: str) -> list[dict]:
    agents = supabase.table("agents").select("*").eq("organization_id", org_id).order("created_at", desc=True).execute().data or []
    ids = [a["id"] for a in agents] or ["00000000-0000-0000-0000-000000000000"]

    wallets = supabase.table("wallets").select("*").in_("agent_id", ids).execute().data or []
    wallets_by_agent: dict[str, list] = {}
    for w in wallets:
        wallets_by_agent.setdefault(w["agent_id"], []).append(w)

    tx = supabase.table("transactions").select("agent_id,amount,status,created_at").in_("agent_id", ids).execute().data or []
    spend_by_agent: dict[str, float] = {}
    count_by_agent: dict[str, int] = {}
    last_seen: dict[str, str] = {}
    for t in tx:
        aid = t["agent_id"]
        if t["status"] == "approved":
            spend_by_agent[aid] = spend_by_agent.get(aid, 0) + float(t["amount"])
        count_by_agent[aid] = count_by_agent.get(aid, 0) + 1
        if aid not in last_seen or t["created_at"] > last_seen[aid]:
            last_seen[aid] = t["created_at"]

    for a in agents:
        a["wallets"] = wallets_by_agent.get(a["id"], [])
        a["total_spent"] = round(spend_by_agent.get(a["id"], 0), 2)
        a["transaction_count"] = count_by_agent.get(a["id"], 0)
        a["last_activity_at"] = last_seen.get(a["id"], a.get("last_activity_at"))
    return agents


def get_agent(org_id: str, agent_id: str) -> dict | None:
    _res = supabase.table("agents").select("*").eq("organization_id", org_id).eq("id", agent_id).maybe_single().execute()
    a = _res.data if _res is not None else None
    if not a:
        return None
    a["wallets"] = supabase.table("wallets").select("*").eq("agent_id", agent_id).execute().data or []
    history = (
        supabase.table("transactions").select("*").eq("agent_id", agent_id)
        .order("created_at", desc=True).limit(50).execute().data or []
    )
    a["spending_history"] = history
    a["total_spent"] = round(sum(float(t["amount"]) for t in history if t["status"] == "approved"), 2)
    a["transaction_count"] = len(history)
    return a


def create_agent(org_id: str, data: dict) -> dict:
    return supabase.table("agents").insert({
        **data,
        "organization_id": org_id,
        "session_key": _gen_session_key(),
        "risk_score": 0,
        "last_activity_at": datetime.now(timezone.utc).isoformat(),
    }).execute().data[0]


def update_agent(org_id: str, agent_id: str, data: dict) -> dict:
    return supabase.table("agents").update(data).eq("organization_id", org_id).eq("id", agent_id).execute().data[0]


def set_status(org_id: str, agent_id: str, status: str, reason: str | None = None) -> dict:
    row = supabase.table("agents").update({"status": status}).eq("organization_id", org_id).eq("id", agent_id).execute().data[0]
    if status == "frozen":
        supabase.table("wallets").update({"status": "frozen"}).eq("agent_id", agent_id).execute()
        supabase.table("alerts").insert({
            "organization_id": org_id, "type": "agent_frozen", "severity": "high",
            "message": f"Agent \"{row['name']}\" frozen" + (f" — {reason}" if reason else ""),
        }).execute()
    elif status == "active":
        supabase.table("wallets").update({"status": "active"}).eq("agent_id", agent_id).eq("status", "frozen").execute()
    return row


def rotate_session_key(org_id: str, agent_id: str) -> dict:
    return supabase.table("agents").update(
        {"session_key": _gen_session_key()}
    ).eq("organization_id", org_id).eq("id", agent_id).execute().data[0]


def touch_activity(agent_id: str):
    supabase.table("agents").update({"last_activity_at": datetime.now(timezone.utc).isoformat()}).eq("id", agent_id).execute()


def delete_agent(org_id: str, agent_id: str):
    supabase.table("agents").delete().eq("organization_id", org_id).eq("id", agent_id).execute()
