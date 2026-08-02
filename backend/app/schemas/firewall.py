from pydantic import BaseModel


class FirewallRuleCreate(BaseModel):
    name: str
    rule_type: str
    config: dict = {}
    enabled: bool = True


class FirewallRuleUpdate(BaseModel):
    name: str | None = None
    rule_type: str | None = None
    config: dict | None = None
    enabled: bool | None = None
