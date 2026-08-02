"""Policy engine — deterministic rule checks that run after risk scoring.
Any single hard rule below is enough to block/require approval.
"""
from datetime import datetime, timedelta, timezone
from app.core.supabase_client import supabase
from app.core.exceptions import KillSwitchActive


def get_killswitch(org_id: str) -> dict | None:
    res = supabase.table("killswitch").select("*").eq("organization_id", org_id).maybe_single().execute()
    return res.data if res is not None else None


def get_limits(org_id: str) -> dict:
    res = supabase.table("limits").select("*").eq("organization_id", org_id).eq("scope", "organization").maybe_single().execute()
    return (res.data if res is not None else None) or {
        "per_transaction": None, "hourly": None, "daily": None,
        "weekly": None, "monthly": None, "risk_freeze_threshold": 80,
    }


def get_agent_limits(org_id: str, agent_id: str) -> dict | None:
    res = supabase.table("limits").select("*").eq("organization_id", org_id).eq("scope", "agent").eq("scope_ref", agent_id).maybe_single().execute()
    return res.data if res is not None else None


def get_rules(org_id: str) -> list[dict]:
    return supabase.table("firewall_rules").select("*").eq("organization_id", org_id).eq("enabled", True).execute().data or []


def _sum_since(org_id: str, agent_id: str, since_iso: str) -> float:
    rows = (
        supabase.table("transactions")
        .select("amount")
        .eq("organization_id", org_id)
        .eq("agent_id", agent_id)
        .eq("status", "approved")
        .gte("created_at", since_iso)
        .execute()
    ).data or []
    return sum(float(r["amount"]) for r in rows)


def _count_since(org_id: str, agent_id: str, since_iso: str) -> int:
    rows = (
        supabase.table("transactions")
        .select("id", count="exact")
        .eq("organization_id", org_id)
        .eq("agent_id", agent_id)
        .gte("created_at", since_iso)
        .execute()
    )
    return rows.count or 0


def _check_spend_windows(org_id: str, agent_id: str, amount: float, limits: dict, now: datetime, label: str) -> str | None:
    windows = [
        ("hourly", timedelta(hours=1)),
        ("daily", timedelta(days=1)),
        ("weekly", timedelta(weeks=1)),
        ("monthly", timedelta(days=30)),
    ]
    for key, delta in windows:
        cap = limits.get(key)
        if cap:
            spent = _sum_since(org_id, agent_id, (now - delta).isoformat())
            if spent + amount > float(cap):
                return f"{label} {key} spending limit of {cap} would be exceeded"
    return None


def evaluate(org_id: str, agent_id: str, wallet: dict, vendor: dict, amount: float, risk_score: int) -> dict:
    """Returns {'decision': 'approve'|'review'|'block', 'reasons': [...]}
    Order: kill switch -> agent status -> wallet/vendor status -> org limits ->
    agent limits -> allowed categories -> time restrictions -> frequency limits -> risk score.
    """
    reasons: list[str] = []

    ks = get_killswitch(org_id)
    if ks and ks.get("is_active"):
        raise KillSwitchActive()

    _agent_res = supabase.table("agents").select("status").eq("organization_id", org_id).eq("id", agent_id).maybe_single().execute()
    agent = _agent_res.data if _agent_res is not None else None
    if agent and agent.get("status") != "active":
        return {"decision": "block", "reasons": [f"agent is {agent.get('status')}"]}

    if wallet.get("status") != "active":
        return {"decision": "block", "reasons": [f"wallet status is {wallet.get('status')}"]}

    if vendor.get("status") == "blocked":
        return {"decision": "block", "reasons": ["vendor is on the blocklist"]}

    limits = get_limits(org_id)
    now = datetime.now(timezone.utc)

    if limits.get("per_transaction") and amount > float(limits["per_transaction"]):
        return {"decision": "block", "reasons": [f"amount exceeds per-transaction limit of {limits['per_transaction']}"]}

    org_breach = _check_spend_windows(org_id, agent_id, amount, limits, now, "organization")
    if org_breach:
        return {"decision": "block", "reasons": [org_breach]}

    agent_limits = get_agent_limits(org_id, agent_id)
    if agent_limits:
        if agent_limits.get("per_transaction") and amount > float(agent_limits["per_transaction"]):
            return {"decision": "block", "reasons": [f"amount exceeds this agent's per-transaction limit of {agent_limits['per_transaction']}"]}
        agent_breach = _check_spend_windows(org_id, agent_id, amount, agent_limits, now, "agent")
        if agent_breach:
            return {"decision": "block", "reasons": [agent_breach]}

    for rule in get_rules(org_id):
        cfg = rule.get("config") or {}
        rtype = rule.get("rule_type")

        if rtype == "allowed_categories":
            allowed = cfg.get("categories") or []
            if allowed and vendor.get("category") not in allowed:
                return {"decision": "block", "reasons": [f"category '{vendor.get('category')}' is not in the allowed list for rule '{rule['name']}'"]}

        elif rtype == "time_restriction":
            start_h, end_h = cfg.get("start_hour", 0), cfg.get("end_hour", 24)
            if not (start_h <= now.hour < end_h):
                return {"decision": "block", "reasons": [f"payments blocked outside {start_h:02d}:00-{end_h:02d}:00 UTC by rule '{rule['name']}'"]}

        elif rtype == "frequency_limit":
            max_per_window = cfg.get("max_count")
            window_seconds = cfg.get("window_seconds", 60)
            if max_per_window:
                since = (now - timedelta(seconds=window_seconds)).isoformat()
                if _count_since(org_id, agent_id, since) >= max_per_window:
                    return {"decision": "block", "reasons": [f"more than {max_per_window} requests in {window_seconds}s — rule '{rule['name']}'"]}

    threshold = limits.get("risk_freeze_threshold", 80)
    if risk_score >= threshold:
        return {"decision": "block", "reasons": [f"risk score {risk_score} >= freeze threshold {threshold}"]}
    if risk_score >= 55:
        reasons.append(f"risk score {risk_score} requires human approval")
        return {"decision": "review", "reasons": reasons}
    if vendor.get("status") == "pending":
        reasons.append("vendor not yet fully verified")
        return {"decision": "review", "reasons": reasons}

    return {"decision": "approve", "reasons": ["all policy checks passed"]}
