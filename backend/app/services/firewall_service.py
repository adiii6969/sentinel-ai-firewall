"""AI Spending Firewall — every AI-initiated payment MUST pass through here.
Flow: AI request -> Risk Engine -> Policy Engine -> auto-approve / human
approval / block -> hash-chained audit record -> ledger record -> vendor ->
realtime broadcast + notification.
"""
from datetime import datetime, timezone
from app.core.supabase_client import supabase
from app.core.exceptions import SentinelError
from app.services import risk_engine, policy_engine, audit_service, notification_service, vendor_service
from app.utils.ws_manager import ws_manager


async def submit_transaction(org_id: str, actor: str, agent_id: str, wallet_id: str, vendor_id: str,
                              amount: float, currency: str = "USD") -> dict:
    _wallet_res = supabase.table("wallets").select("*").eq("id", wallet_id).eq("organization_id", org_id).maybe_single().execute()
    wallet = _wallet_res.data if _wallet_res is not None else None
    if not wallet:
        raise SentinelError("Wallet not found", 404)
    vendor = vendor_service.get_vendor(org_id, vendor_id)
    if not vendor:
        raise SentinelError("Vendor not found", 404)

    risk = risk_engine.score_transaction(org_id, agent_id, vendor, amount)
    supabase.table("risk_scores").insert({
        "organization_id": org_id, "score": risk["score"], "level": risk["level"], "factors": risk["factors"],
    }).execute()
    supabase.table("risk_history").insert({"organization_id": org_id, "score": risk["score"], "level": risk["level"]}).execute()
    supabase.table("agents").update({
        "risk_score": risk["score"], "last_activity_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", agent_id).execute()

    policy = policy_engine.evaluate(org_id, agent_id, wallet, vendor, amount, risk["score"])
    decision = policy["decision"]

    base = {
        "organization_id": org_id, "agent_id": agent_id, "wallet_id": wallet_id,
        "vendor_id": vendor_id, "amount": amount, "currency": currency, "risk_score": risk["score"],
    }

    if decision == "review":
        row = supabase.table("pending_transactions").insert({
            **base, "reason": "; ".join(policy["reasons"]), "status": "pending",
        }).execute().data[0]
        await audit_and_broadcast(org_id, actor, "transaction.review_required", "pending_transactions", row["id"],
                                   {"amount": amount, "vendor": vendor["name"], "risk_score": risk["score"]})
        await notification_service.notify(org_id, None, "warning",
            f"Payment to <b>{vendor['name']}</b> flagged for review — ${amount:.2f} (risk {risk['score']})")
        return {"status": "review", "risk": risk, "reasons": policy["reasons"], "transaction": row}

    if decision == "block":
        row = supabase.table("transactions").insert({**base, "status": "blocked"}).execute().data[0]
        await audit_and_broadcast(org_id, actor, "transaction.blocked", "transactions", row["id"],
                                   {"amount": amount, "vendor": vendor["name"], "reasons": policy["reasons"]})
        await notification_service.notify(org_id, None, "danger",
            f"Payment to <b>{vendor['name']}</b> blocked — ${amount:.2f}")
        supabase.table("alerts").insert({
            "organization_id": org_id, "type": "transaction_blocked", "severity": "high",
            "message": f"Blocked ${amount:.2f} to {vendor['name']}: {'; '.join(policy['reasons'])}",
        }).execute()
        return {"status": "blocked", "risk": risk, "reasons": policy["reasons"], "transaction": row}

    # approve
    row = supabase.table("transactions").insert({**base, "status": "approved"}).execute().data[0]
    ledger = _write_ledger_record(row["id"])
    await audit_and_broadcast(org_id, actor, "transaction.approved", "transactions", row["id"],
                               {"amount": amount, "vendor": vendor["name"], "risk_score": risk["score"]})
    await notification_service.notify(org_id, None, "success",
        f"Payment to <b>{vendor['name']}</b> approved — ${amount:.2f}")
    return {"status": "approved", "risk": risk, "transaction": row, "ledger": ledger}


def _write_ledger_record(transaction_id: str) -> dict:
    import hashlib
    last = supabase.table("blockchain_records").select("block_number").order("block_number", desc=True).limit(1).execute().data
    block_number = (last[0]["block_number"] + 1) if last else 1000000
    sig = hashlib.sha256(f"{transaction_id}-{block_number}-{datetime.now(timezone.utc).isoformat()}".encode()).hexdigest()
    return supabase.table("blockchain_records").insert({
        "transaction_id": transaction_id, "hash": "0x" + sig[:40], "block_number": block_number,
        "signature": "0x" + sig, "status": "confirmed",
    }).execute().data[0]


async def audit_and_broadcast(org_id: str, actor: str, action: str, entity_type: str, entity_id: str, metadata: dict):
    row = audit_service.write(org_id, actor, "ai", action, entity_type, entity_id, metadata)
    await ws_manager.broadcast(org_id, {"channel": "transactions", "data": {"action": action, **metadata}})
    return row


async def decide_pending(org_id: str, transaction_id: str, approver_id: str, decision: str, note: str | None) -> dict:
    pending = supabase.table("pending_transactions").select("*").eq("id", transaction_id).eq("organization_id", org_id).single().execute().data
    supabase.table("approvals").insert({
        "transaction_id": transaction_id, "approver_id": approver_id, "decision": decision, "note": note,
    }).execute()
    supabase.table("pending_transactions").update({"status": decision}).eq("id", transaction_id).execute()

    status = "approved" if decision == "approved" else "rejected"
    row = supabase.table("transactions").insert({
        "organization_id": org_id, "agent_id": pending["agent_id"], "wallet_id": pending["wallet_id"],
        "vendor_id": pending["vendor_id"], "amount": pending["amount"], "currency": pending["currency"],
        "risk_score": pending["risk_score"], "status": status, "decided_by": approver_id,
    }).execute().data[0]

    if status == "approved":
        _write_ledger_record(row["id"])
    await audit_and_broadcast(org_id, approver_id, f"transaction.{status}_by_human", "transactions", row["id"],
                               {"amount": float(pending["amount"]), "note": note})
    return row
