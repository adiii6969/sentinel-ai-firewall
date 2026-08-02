from pydantic import BaseModel


class AgentCreate(BaseModel):
    name: str
    status: str = "active"


class AgentUpdate(BaseModel):
    name: str | None = None
    status: str | None = None


class AgentFreeze(BaseModel):
    reason: str | None = None
