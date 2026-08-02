import csv
import io
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from app.core.security import get_current_user, CurrentUser
from app.core.supabase_client import supabase
from app.services import audit_service

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("")
def list_audit(user: CurrentUser = Depends(get_current_user), actor_type: str | None = None, page: int = 1, page_size: int = 50):
    q = supabase.table("audit_logs").select("*", count="exact").eq("organization_id", user.organization_id)
    if actor_type:
        q = q.eq("actor_type", actor_type)
    start = (page - 1) * page_size
    res = q.order("created_at", desc=True).range(start, start + page_size - 1).execute()
    return {"items": res.data, "total": res.count}


@router.get("/verify")
def verify(user: CurrentUser = Depends(get_current_user)):
    return audit_service.verify_chain(user.organization_id)


@router.get("/export.csv")
def export_csv(user: CurrentUser = Depends(get_current_user)):
    rows = supabase.table("audit_logs").select("*").eq("organization_id", user.organization_id).order("created_at", desc=True).execute().data or []
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=["id", "actor", "actor_type", "action", "entity_type", "entity_id", "hash", "created_at"])
    writer.writeheader()
    for r in rows:
        writer.writerow({k: r.get(k) for k in writer.fieldnames})
    buf.seek(0)
    return StreamingResponse(buf, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=audit_export.csv"})
