from fastapi import APIRouter, Depends
from app.core.security import get_current_user, require_roles, CurrentUser
from app.schemas.vendors import VendorCreate, VendorUpdate
from app.services import vendor_service

router = APIRouter(prefix="/vendors", tags=["vendors"])


@router.get("")
def list_vendors(user: CurrentUser = Depends(get_current_user)):
    return vendor_service.list_vendors(user.organization_id)


@router.get("/{vendor_id}")
def get_vendor(vendor_id: str, user: CurrentUser = Depends(get_current_user)):
    return vendor_service.get_vendor(user.organization_id, vendor_id)


@router.post("")
async def create_vendor(body: VendorCreate, user: CurrentUser = Depends(require_roles("admin", "owner"))):
    return await vendor_service.create_vendor(user.organization_id, body.model_dump())


@router.patch("/{vendor_id}")
async def update_vendor(vendor_id: str, body: VendorUpdate, user: CurrentUser = Depends(require_roles("admin", "owner"))):
    return await vendor_service.update_vendor(user.organization_id, vendor_id, {k: v for k, v in body.model_dump().items() if v is not None})


@router.delete("/{vendor_id}")
async def delete_vendor(vendor_id: str, user: CurrentUser = Depends(require_roles("admin", "owner"))):
    await vendor_service.delete_vendor(user.organization_id, vendor_id)
    return {"message": "deleted"}
