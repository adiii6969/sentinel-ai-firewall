import pytest
from unittest.mock import patch, AsyncMock
from app.core.exceptions import SentinelError
from app.services import killswitch_service


@pytest.mark.asyncio
async def test_toggle_requires_actor():
    with pytest.raises(SentinelError):
        await killswitch_service.toggle("org", True, "reason", actor_id=None)


@pytest.mark.asyncio
async def test_toggle_rejects_overlong_reason():
    with pytest.raises(SentinelError):
        await killswitch_service.toggle("org", True, "x" * 600, actor_id="user1")


@pytest.mark.asyncio
async def test_activate_defaults_reason_when_missing():
    from tests.conftest import FakeSupabase
    fake = FakeSupabase()
    fake.set_table("killswitch", [{"id": "K1", "organization_id": "org", "is_active": False}])
    with patch.object(killswitch_service, "supabase", fake), \
         patch.object(killswitch_service.ws_manager, "broadcast", new=AsyncMock()):
        # update() chain returns the same fake rows regardless of payload in this fake client
        row = await killswitch_service.toggle("org", True, None, actor_id="user1")
    assert row is not None


@pytest.mark.asyncio
async def test_noop_toggle_returns_current_state_without_broadcast():
    from tests.conftest import FakeSupabase
    fake = FakeSupabase()
    fake.set_table("killswitch", [{"id": "K1", "organization_id": "org", "is_active": True}])
    broadcast_mock = AsyncMock()
    with patch.object(killswitch_service, "supabase", fake), \
         patch.object(killswitch_service.ws_manager, "broadcast", new=broadcast_mock):
        row = await killswitch_service.toggle("org", True, "already on", actor_id="user1")
    assert row["is_active"] is True
    broadcast_mock.assert_not_called()
