from pydantic import BaseModel


class VendorCreate(BaseModel):
    name: str
    category: str | None = None
    status: str = "pending"
    color: str | None = "#6366F1"


class VendorUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    status: str | None = None
    color: str | None = None
