from fastapi import APIRouter, Depends
from app.core.security import get_current_user, require_roles, CurrentUser
from app.schemas.limits import LimitsUpdate
from app.services import limits_service

router = APIRouter(prefix="/limits", tags=["limits"])


@router.get("")
def get_limits(user: CurrentUser = Depends(get_current_user)):
    return limits_service.get_limits(user.organization_id)


@router.patch("")
async def update_limits(body: LimitsUpdate, user: CurrentUser = Depends(require_roles("admin", "owner"))):
    return await limits_service.update_limits(user.organization_id, {k: v for k, v in body.model_dump().items() if v is not None})
