"""In-process WebSocket connection manager, keyed by organization_id so
every connected dashboard for an org gets realtime pushes (transactions,
risk, killswitch, notifications, alerts)."""
from collections import defaultdict
from fastapi import WebSocket


class WSManager:
    def __init__(self):
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, org_id: str, ws: WebSocket):
        await ws.accept()
        self._connections[org_id].add(ws)

    def disconnect(self, org_id: str, ws: WebSocket):
        self._connections[org_id].discard(ws)

    async def broadcast(self, org_id: str, message: dict):
        dead = []
        for ws in self._connections.get(org_id, set()):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(org_id, ws)


ws_manager = WSManager()
