from pydantic import BaseModel


class KillSwitchToggle(BaseModel):
    is_active: bool
    reason: str | None = None
