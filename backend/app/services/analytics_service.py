from datetime import datetime, timedelta, timezone
from collections import Counter
from app.core.supabase_client import supabase


def overview(org_id: str) -> dict:
    now = datetime.now(timezone.utc)
    month_ago = (now - timedelta(days=30)).isoformat()
    week_ago = (now - timedelta(days=7)).isoformat()
    day_ago = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    monthly_tx = supabase.table("transactions").select("*").eq("organization_id", org_id).gte("created_at", month_ago).execute().data or []
    weekly_tx = [t for t in monthly_tx if t["created_at"] >= week_ago]
    today_tx = [t for t in monthly_tx if t["created_at"] >= day_ago]

    def total(rows, status=None):
        rows = [r for r in rows if status is None or r["status"] == status]
        return round(sum(float(r["amount"]) for r in rows), 2)

    approved = [t for t in monthly_tx if t["status"] == "approved"]
    blocked = [t for t in monthly_tx if t["status"] == "blocked"]
    decided = [t for t in monthly_tx if t["status"] in ("approved", "rejected", "blocked")]

    vendor_counts = Counter(t["vendor_id"] for t in monthly_tx)
    top_vendor_ids = [v for v, _ in vendor_counts.most_common(5)]
    vendors = {v["id"]: v["name"] for v in (
        supabase.table("vendors").select("id,name").in_("id", top_vendor_ids or ["00000000-0000-0000-0000-000000000000"]).execute().data or []
    )}
    top_vendors = [{"vendor": vendors.get(v, "Unknown"), "transactions": c} for v, c in vendor_counts.most_common(5)]

    risk_trend = supabase.table("risk_history").select("score,created_at").eq("organization_id", org_id).order("created_at", desc=True).limit(20).execute().data or []
    avg_risk_score = round(sum(r["score"] for r in risk_trend) / len(risk_trend)) if risk_trend else 0

    return {
        "monthly_spend": total(monthly_tx, "approved"),
        "weekly_spend": total(weekly_tx, "approved"),
        "today_spend": total(today_tx, "approved"),
        "approved_today": len([t for t in today_tx if t["status"] == "approved"]),
        "blocked_today": len([t for t in today_tx if t["status"] == "blocked"]),
        "avg_risk_score": avg_risk_score,
        "top_vendors": top_vendors,
        "risk_trend": list(reversed(risk_trend)),
        "approval_rate": round(len(approved) / len(decided) * 100, 1) if decided else 100.0,
        "blocked_payments": len(blocked),
        "blocked_amount": total(monthly_tx, "blocked"),
        "fraud_prevented": total(monthly_tx, "blocked"),
        "total_transactions": len(monthly_tx),
    }
