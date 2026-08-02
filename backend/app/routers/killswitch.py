from fastapi import APIRouter, Depends
from app.core.security import get_current_user, require_roles, CurrentUser
from app.schemas.killswitch import KillSwitchToggle
from app.services import killswitch_service

router = APIRouter(prefix="/killswitch", tags=["killswitch"])


@router.get("")
def state(user: CurrentUser = Depends(get_current_user)):
    return killswitch_service.get_state(user.organization_id)


@router.post("/toggle")
async def toggle(body: KillSwitchToggle, user: CurrentUser = Depends(require_roles("admin", "owner"))):
    return await killswitch_service.toggle(user.organization_id, body.is_active, body.reason, user.id)
