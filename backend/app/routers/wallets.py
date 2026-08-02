from fastapi import APIRouter, Depends
from app.core.security import get_current_user, require_roles, CurrentUser
from app.schemas.wallets import WalletCreate, WalletUpdate
from app.services import wallet_service

router = APIRouter(prefix="/wallets", tags=["wallets"])


@router.get("")
def list_wallets(user: CurrentUser = Depends(get_current_user)):
    return wallet_service.list_wallets(user.organization_id)


@router.get("/{wallet_id}")
def get_wallet(wallet_id: str, user: CurrentUser = Depends(get_current_user)):
    return wallet_service.get_wallet(user.organization_id, wallet_id)


@router.post("")
def create_wallet(body: WalletCreate, user: CurrentUser = Depends(require_roles("admin", "owner"))):
    return wallet_service.create_wallet(user.organization_id, body.model_dump())


@router.patch("/{wallet_id}")
def update_wallet(wallet_id: str, body: WalletUpdate, user: CurrentUser = Depends(require_roles("admin", "owner"))):
    return wallet_service.update_wallet(user.organization_id, wallet_id, {k: v for k, v in body.model_dump().items() if v is not None})


@router.post("/{wallet_id}/freeze")
def freeze_wallet(wallet_id: str, user: CurrentUser = Depends(require_roles("admin", "owner"))):
    return wallet_service.freeze_wallet(user.organization_id, wallet_id)


@router.post("/{wallet_id}/unfreeze")
def unfreeze_wallet(wallet_id: str, user: CurrentUser = Depends(require_roles("admin", "owner"))):
    return wallet_service.unfreeze_wallet(user.organization_id, wallet_id)


@router.delete("/{wallet_id}")
def delete_wallet(wallet_id: str, user: CurrentUser = Depends(require_roles("admin", "owner"))):
    wallet_service.delete_wallet(user.organization_id, wallet_id)
    return {"message": "deleted"}
