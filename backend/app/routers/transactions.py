from fastapi import APIRouter, Depends
from app.core.security import get_current_user, CurrentUser
from app.core.supabase_client import supabase

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("")
def list_transactions(
    user: CurrentUser = Depends(get_current_user),
    status: str | None = None,
    vendor_id: str | None = None,
    page: int = 1,
    page_size: int = 25,
):
    q = supabase.table("transactions").select("*, vendors(name), agents(name)", count="exact").eq("organization_id", user.organization_id)
    if status:
        q = q.eq("status", status)
    if vendor_id:
        q = q.eq("vendor_id", vendor_id)
    start = (page - 1) * page_size
    res = q.order("created_at", desc=True).range(start, start + page_size - 1).execute()
    return {"items": res.data, "total": res.count, "page": page, "page_size": page_size}


@router.get("/{transaction_id}")
def get_transaction(transaction_id: str, user: CurrentUser = Depends(get_current_user)):
    return supabase.table("transactions").select("*, vendors(name), agents(name)").eq(
        "id", transaction_id).eq("organization_id", user.organization_id).single().execute().data
