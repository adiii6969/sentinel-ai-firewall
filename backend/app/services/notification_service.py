from app.core.supabase_client import supabase
from app.core.exceptions import SentinelError
from app.utils.ws_manager import ws_manager

_VALID_TYPES = {"success", "warning", "danger", "info"}
_MAX_TEXT_LEN = 1000


async def notify(org_id: str, user_id: str | None, type_: str, text: str):
    if type_ not in _VALID_TYPES:
        raise SentinelError(f"type must be one of {sorted(_VALID_TYPES)}", 422)
    if not text or not text.strip():
        raise SentinelError("text is required", 422)
    if len(text) > _MAX_TEXT_LEN:
        text = text[:_MAX_TEXT_LEN]

    row = supabase.table("notifications").insert({
        "organization_id": org_id, "user_id": user_id, "type": type_, "text": text,
    }).execute().data[0]
    await ws_manager.broadcast(org_id, {"channel": "notifications", "data": row})
    return row
