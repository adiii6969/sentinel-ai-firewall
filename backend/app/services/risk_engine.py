"""Rule-based AI Risk Score engine — 0 (safe) to 100 (critical).
No external LLM calls: fast, deterministic, free to run on every transaction.
"""
from datetime import datetime, timedelta, timezone
from app.core.supabase_client import supabase


def _level(score: int) -> str:
    if score < 30:
        return "safe"
    if score < 55:
        return "medium"
    if score < 80:
        return "high"
    return "critical"


def score_transaction(org_id: str, agent_id: str, vendor: dict, amount: float) -> dict:
    factors: dict[str, int] = {}
    score = 0

    # 1. Vendor reputation (inverse contribution)
    rep = vendor.get("reputation_score", 50)
    vendor_risk = max(0, 100 - rep)
    factors["vendor_reputation"] = vendor_risk
    score += vendor_risk * 0.30

    if vendor.get("status") == "blocked":
        factors["vendor_blocked"] = 100
        score += 40
    elif vendor.get("status") == "pending":
        factors["vendor_unverified"] = 30
        score += 15

    # 2. Amount vs historical average for this agent
    hist = (
        supabase.table("transactions")
        .select("amount")
        .eq("organization_id", org_id)
        .eq("agent_id", agent_id)
        .eq("status", "approved")
        .order("created_at", desc=True)
        .limit(30)
        .execute()
    ).data or []
    avg = sum(float(t["amount"]) for t in hist) / len(hist) if hist else amount
    if avg > 0 and amount > avg * 3:
        factors["amount_anomaly"] = 25
        score += 25
    elif avg > 0 and amount > avg * 1.5:
        factors["amount_anomaly"] = 10
        score += 10

    # 3. Velocity — transactions by this agent in the last 10 minutes
    since = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    recent = (
        supabase.table("transactions")
        .select("id", count="exact")
        .eq("organization_id", org_id)
        .eq("agent_id", agent_id)
        .gte("created_at", since)
        .execute()
    )
    recent_count = recent.count or 0
    if recent_count >= 8:
        factors["velocity"] = 30
        score += 30
    elif recent_count >= 4:
        factors["velocity"] = 15
        score += 15

    # 4. Business hours (UTC 13:00-21:00 treated as normal business window)
    hour = datetime.now(timezone.utc).hour
    if not (13 <= hour <= 21):
        factors["off_hours"] = 8
        score += 8

    # 5. Recent failed/blocked attempts by this agent
    failed = (
        supabase.table("transactions")
        .select("id", count="exact")
        .eq("organization_id", org_id)
        .eq("agent_id", agent_id)
        .in_("status", ["rejected", "blocked"])
        .gte("created_at", since)
        .execute()
    )
    if (failed.count or 0) >= 2:
        factors["repeated_failures"] = 20
        score += 20

    score = max(0, min(100, round(score)))
    return {"score": score, "level": _level(score), "factors": factors}
