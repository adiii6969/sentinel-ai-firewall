import pytest
from unittest.mock import AsyncMock
from tests.conftest import FakeSupabase
from app.services import advisor_service, limits_service


def test_daily_limit_recommendation_carries_structured_payload(monkeypatch):
    fake = FakeSupabase()
    fake.set_table("limits", [{"daily": "100.00"}])
    fake.set_table("transactions", [{"amount": "90.00", "agent_id": "agent-1"}])  # 90% of the $100 daily cap
    fake.set_table("vendors", [])
    fake.set_table("vendor_reputation", [])
    fake.set_table("risk_history", [])
    monkeypatch.setattr(advisor_service, "supabase", fake)
    monkeypatch.setattr(advisor_service.limits_service, "get_limits", lambda org_id: {"daily": "100.00"})

    recs = advisor_service.generate("org-1")

    daily_recs = [r for r in recs if r.get("rec_type") == "increase_daily_limit"]
    assert len(daily_recs) == 1
    assert daily_recs[0]["payload"]["current_daily"] == 100.0
    assert daily_recs[0]["payload"]["suggested_daily"] == 125.0


@pytest.mark.asyncio
async def test_apply_increase_daily_limit_calls_update_limits(monkeypatch):
    from app.routers import advisor as advisor_router

    fake = FakeSupabase()
    rec = {
        "id": "rec-1", "organization_id": "org-1", "status": "open",
        "rec_type": "increase_daily_limit", "payload": {"suggested_daily": 125.0},
    }
    fake.set_table("recommendations", [rec])
    monkeypatch.setattr(advisor_router, "supabase", fake)

    called = {}

    async def fake_update_limits(org_id, data):
        called["org_id"] = org_id
        called["data"] = data
        return {"daily": data["daily"]}

    monkeypatch.setattr(limits_service, "update_limits", fake_update_limits)
    monkeypatch.setattr(advisor_router, "limits_service", limits_service)

    class FakeUser:
        organization_id = "org-1"

    result = await advisor_router.apply("rec-1", user=FakeUser())

    assert called["data"] == {"daily": 125.0}
    # Note: FakeQuery's update() doesn't mutate stored rows (see test_killswitch_service.py),
    # so we assert on the side effect (the update_limits call) rather than the returned row.
    assert result is not None


@pytest.mark.asyncio
async def test_apply_unknown_rec_type_rejected(monkeypatch):
    from app.core.exceptions import SentinelError
    from app.routers import advisor as advisor_router

    fake = FakeSupabase()
    rec = {"id": "rec-2", "organization_id": "org-1", "status": "open", "rec_type": None, "payload": {}}
    fake.set_table("recommendations", [rec])
    monkeypatch.setattr(advisor_router, "supabase", fake)

    class FakeUser:
        organization_id = "org-1"

    with pytest.raises(SentinelError):
        await advisor_router.apply("rec-2", user=FakeUser())


@pytest.mark.asyncio
async def test_apply_already_applied_rejected(monkeypatch):
    from app.core.exceptions import SentinelError
    from app.routers import advisor as advisor_router

    fake = FakeSupabase()
    rec = {"id": "rec-3", "organization_id": "org-1", "status": "applied", "rec_type": "increase_daily_limit", "payload": {}}
    fake.set_table("recommendations", [rec])
    monkeypatch.setattr(advisor_router, "supabase", fake)

    class FakeUser:
        organization_id = "org-1"

    with pytest.raises(SentinelError):
        await advisor_router.apply("rec-3", user=FakeUser())
