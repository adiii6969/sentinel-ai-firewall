from pydantic import BaseModel


class WalletCreate(BaseModel):
    name: str | None = None
    agent_id: str | None = None
    address: str
    chain: str = "ethereum"
    balance: float = 0


class WalletUpdate(BaseModel):
    name: str | None = None
    status: str | None = None
    balance: float | None = None
    address: str | None = None
