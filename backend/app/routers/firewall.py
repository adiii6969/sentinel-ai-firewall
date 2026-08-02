from fastapi import APIRouter, Depends, Request
from app.core.exceptions import SentinelError
from app.core.security import get_current_user, require_roles, CurrentUser
from app.core.supabase_client import supabase
from app.services import firewall_service
from app.schemas.transactions import TransactionRequest, ApprovalDecision
from app.schemas.firewall import FirewallRuleCreate, FirewallRuleUpdate
from app.middleware.rate_limit import limiter

router = APIRouter(prefix="/firewall", tags=["firewall"])


@router.post("/transaction")
@limiter.limit("30/minute")
async def submit(request: Request, body: TransactionRequest, user: CurrentUser = Depends(get_current_user)):
    """AI agents call this to request a spend. Never a direct wallet debit."""
    return await firewall_service.submit_transaction(
        user.organization_id, user.id, body.agent_id, body.wallet_id, body.vendor_id, body.amount, body.currency,
    )


@router.get("/pending")
def pending(user: CurrentUser = Depends(get_current_user)):
    return supabase.table("pending_transactions").select("*, vendors(name), agents(name)").eq(
        "organization_id", user.organization_id).eq("status", "pending").order("created_at", desc=True).execute().data


@router.post("/pending/{transaction_id}/decide")
async def decide(transaction_id: str, body: ApprovalDecision, user: CurrentUser = Depends(require_roles("admin", "owner"))):
    return await firewall_service.decide_pending(user.organization_id, transaction_id, user.id, body.decision, body.note)


@router.get("/rules")
def list_rules(user: CurrentUser = Depends(get_current_user)):
    return supabase.table("firewall_rules").select("*").eq("organization_id", user.organization_id).execute().data


@router.post("/rules")
def create_rule(body: FirewallRuleCreate, user: CurrentUser = Depends(require_roles("admin", "owner"))):
    return supabase.table("firewall_rules").insert({**body.model_dump(), "organization_id": user.organization_id}).execute().data[0]


@router.patch("/rules/{rule_id}")
def update_rule(rule_id: str, body: FirewallRuleUpdate, user: CurrentUser = Depends(require_roles("admin", "owner"))):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    res = supabase.table("firewall_rules").update(data).eq("id", rule_id).eq(
        "organization_id", user.organization_id).execute().data
    if not res:
        raise SentinelError("Rule not found", 404)
    return res[0]


@router.delete("/rules/{rule_id}", status_code=204)
def delete_rule(rule_id: str, user: CurrentUser = Depends(require_roles("admin", "owner"))):
    supabase.table("firewall_rules").delete().eq("id", rule_id).eq("organization_id", user.organization_id).execute()
