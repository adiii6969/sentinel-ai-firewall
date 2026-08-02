from pydantic import BaseModel


class LimitsUpdate(BaseModel):
    per_transaction: float | None = None
    hourly: float | None = None
    daily: float | None = None
    weekly: float | None = None
    monthly: float | None = None
    risk_freeze_threshold: int | None = None
