from app.core.supabase_client import supabase
from app.core.exceptions import SentinelError
from app.utils.ws_manager import ws_manager

_ORDERED_FIELDS = ["per_transaction", "hourly", "daily", "weekly", "monthly"]


def get_limits(org_id: str) -> dict:
    res = supabase.table("limits").select("*").eq("organization_id", org_id).eq("scope", "organization").maybe_single().execute()
    if res is not None and res.data:
        return res.data
    return supabase.table("limits").insert({"organization_id": org_id, "scope": "organization"}).execute().data[0]


def _validate(data: dict, existing: dict) -> None:
    merged = {**existing, **data}
    for field in _ORDERED_FIELDS + ["risk_freeze_threshold"]:
        value = merged.get(field)
        if value is not None and float(value) < 0:
            raise SentinelError(f"{field} cannot be negative", 422)

    if merged.get("risk_freeze_threshold") is not None and not (0 <= merged["risk_freeze_threshold"] <= 100):
        raise SentinelError("risk_freeze_threshold must be between 0 and 100", 422)

    # Each narrower window's cap must not exceed the next wider one, when both are set.
    present = [(f, float(merged[f])) for f in _ORDERED_FIELDS if merged.get(f) is not None]
    for (name_a, val_a), (name_b, val_b) in zip(present, present[1:]):
        if val_a > val_b:
            raise SentinelError(f"{name_a} limit (${val_a}) cannot exceed {name_b} limit (${val_b})", 422)


async def update_limits(org_id: str, data: dict) -> dict:
    existing = get_limits(org_id)
    _validate(data, existing)
    row = supabase.table("limits").update(data).eq("id", existing["id"]).execute().data[0]
    await ws_manager.broadcast(org_id, {"channel": "limits", "data": row})
    return row
