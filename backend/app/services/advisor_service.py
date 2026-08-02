"""AI Security Advisor — rule-based recommendation generator.
Scans limits usage, vendor reputation, risk trend, and failed transactions
to produce prioritized, explainable recommendations. Runs on-demand
(GET /advisor/recommendations) and can be scheduled via a cron hitting
the same endpoint.
"""
from datetime import datetime, timedelta, timezone
from app.core.supabase_client import supabase
from app.services import limits_service


def generate(org_id: str) -> list[dict]:
    recs: list[dict] = []
    now = datetime.now(timezone.utc)

    # 1. Daily limit near exhaustion
    limits = limits_service.get_limits(org_id)
    if limits.get("daily"):
        since = (now - timedelta(days=1)).isoformat()
        spent = sum(float(t["amount"]) for t in (
            supabase.table("transactions").select("amount").eq("organization_id", org_id)
            .eq("status", "approved").gte("created_at", since).execute().data or []
        ))
        pct = spent / float(limits["daily"]) if float(limits["daily"]) else 0
        if pct >= 0.8:
            suggested_daily = round(float(limits["daily"]) * 1.25, 2)
            recs.append({
                "title": "Increase daily spending limit", "priority": "medium", "severity": "warning",
                "confidence": 82, "suggested_action": "Review limit",
                "reason": f"Daily spend is at {pct*100:.0f}% of the ${limits['daily']} cap.",
                "rec_type": "increase_daily_limit",
                "payload": {"current_daily": float(limits["daily"]), "suggested_daily": suggested_daily},
            })

    # 2. Inactive vendors (approved, zero transactions in 30 days)
    vendors = supabase.table("vendors").select("*").eq("organization_id", org_id).eq("status", "approved").execute().data or []
    since30 = (now - timedelta(days=30)).isoformat()
    for v in vendors:
        tx = supabase.table("transactions").select("id", count="exact").eq("vendor_id", v["id"]).gte("created_at", since30).execute()
        if (tx.count or 0) == 0:
            recs.append({
                "title": f'Remove inactive vendor "{v["name"]}"', "priority": "low", "severity": "info",
                "confidence": 68, "suggested_action": "Remove vendor",
                "reason": f'{v["name"]} has received no payments in the last 30 days and remains on the allowlist.',
            })

    # 3. Vendor reputation drop (<60)
    reps = supabase.table("vendor_reputation").select("*, vendors(name)").lt("score", 60).execute().data or []
    for r in reps:
        vname = (r.get("vendors") or {}).get("name", "vendor")
        recs.append({
            "title": f"Vendor reputation dropped ({vname})", "priority": "medium", "severity": "warning",
            "confidence": 75, "suggested_action": "Review vendor",
            "reason": f"{vname} reputation score is {r['score']}/100.",
        })

    # 4. Repeated failed/blocked transactions per agent (last 24h)
    since24 = (now - timedelta(hours=24)).isoformat()
    failed = supabase.table("transactions").select("agent_id").eq("organization_id", org_id).in_(
        "status", ["rejected", "blocked"]).gte("created_at", since24).execute().data or []
    counts: dict[str, int] = {}
    for f in failed:
        counts[f["agent_id"]] = counts.get(f["agent_id"], 0) + 1
    for agent_id, c in counts.items():
        if c >= 3:
            recs.append({
                "title": "Repeated failed transactions", "priority": "high", "severity": "danger",
                "confidence": 88, "suggested_action": "Investigate agent",
                "reason": f"Agent {agent_id} had {c} blocked/rejected transactions in the last 24h.",
            })

    # 5. Rising risk trend
    hist = supabase.table("risk_history").select("score").eq("organization_id", org_id).order("created_at", desc=True).limit(10).execute().data or []
    if len(hist) >= 5:
        recent_avg = sum(h["score"] for h in hist[:5]) / 5
        older_avg = sum(h["score"] for h in hist[5:10]) / max(1, len(hist[5:10]))
        if recent_avg > older_avg + 15:
            recs.append({
                "title": "Spending risk trending upward", "priority": "high", "severity": "danger",
                "confidence": 79, "suggested_action": "Review policies",
                "reason": f"Average risk score rose from {older_avg:.0f} to {recent_avg:.0f} over recent transactions.",
            })

    for r in recs:
        r["organization_id"] = org_id
        r["status"] = "open"
    if recs:
        supabase.table("recommendations").insert(recs).execute()
    return recs
