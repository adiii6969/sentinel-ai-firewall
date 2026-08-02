from fastapi import APIRouter, Depends
from app.core.security import get_current_user, CurrentUser
from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
def overview(user: CurrentUser = Depends(get_current_user)):
    return analytics_service.overview(user.organization_id)
