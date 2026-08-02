from fastapi import APIRouter, Depends
from app.core.security import get_current_user, require_roles, CurrentUser
from app.schemas.agents import AgentCreate, AgentUpdate, AgentFreeze
from app.services import agent_service

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("")
def list_agents(user: CurrentUser = Depends(get_current_user)):
    return agent_service.list_agents(user.organization_id)


@router.get("/{agent_id}")
def get_agent(agent_id: str, user: CurrentUser = Depends(get_current_user)):
    return agent_service.get_agent(user.organization_id, agent_id)


@router.post("")
def create_agent(body: AgentCreate, user: CurrentUser = Depends(require_roles("admin", "owner"))):
    return agent_service.create_agent(user.organization_id, body.model_dump())


@router.patch("/{agent_id}")
def update_agent(agent_id: str, body: AgentUpdate, user: CurrentUser = Depends(require_roles("admin", "owner"))):
    return agent_service.update_agent(user.organization_id, agent_id, {k: v for k, v in body.model_dump().items() if v is not None})


@router.post("/{agent_id}/freeze")
def freeze_agent(agent_id: str, body: AgentFreeze, user: CurrentUser = Depends(require_roles("admin", "owner"))):
    return agent_service.set_status(user.organization_id, agent_id, "frozen", body.reason)


@router.post("/{agent_id}/unfreeze")
def unfreeze_agent(agent_id: str, user: CurrentUser = Depends(require_roles("admin", "owner"))):
    return agent_service.set_status(user.organization_id, agent_id, "active")


@router.post("/{agent_id}/rotate-key")
def rotate_key(agent_id: str, user: CurrentUser = Depends(require_roles("admin", "owner"))):
    return agent_service.rotate_session_key(user.organization_id, agent_id)


@router.delete("/{agent_id}")
def delete_agent(agent_id: str, user: CurrentUser = Depends(require_roles("admin", "owner"))):
    agent_service.delete_agent(user.organization_id, agent_id)
    return {"message": "deleted"}
