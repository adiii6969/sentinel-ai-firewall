from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.core.supabase_client import supabase, supabase_public
from app.utils.ws_manager import ws_manager

router = APIRouter()


@router.websocket("/ws")
async def ws_endpoint(websocket: WebSocket, token: str = Query(...)):
    try:
        user_resp = supabase_public.auth.get_user(token)
        if not user_resp or not user_resp.user:
            raise ValueError("invalid token")
        profile = supabase.table("profiles").select("organization_id").eq("id", user_resp.user.id).single().execute().data
        org_id = profile["organization_id"]
    except Exception:
        await websocket.close(code=4401)
        return

    await ws_manager.connect(org_id, websocket)
    try:
        while True:
            await websocket.receive_text()  # client pings; server pushes via broadcast()
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(org_id, websocket)
