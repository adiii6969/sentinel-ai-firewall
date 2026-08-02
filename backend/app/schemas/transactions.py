from pydantic import BaseModel


class TransactionRequest(BaseModel):
    """An AI agent's request to spend — this is what the firewall inspects."""
    agent_id: str
    wallet_id: str
    vendor_id: str
    amount: float
    currency: str = "USD"


class ApprovalDecision(BaseModel):
    decision: str  # approved | rejected
    note: str | None = None
