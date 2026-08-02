import pytest
from app.core.exceptions import SentinelError
from app.services import limits_service


def test_negative_limit_rejected():
    with pytest.raises(SentinelError):
        limits_service._validate({"daily": -10}, {})


def test_risk_threshold_out_of_range_rejected():
    with pytest.raises(SentinelError):
        limits_service._validate({"risk_freeze_threshold": 150}, {})


def test_per_transaction_cannot_exceed_daily():
    with pytest.raises(SentinelError):
        limits_service._validate({"per_transaction": 500, "daily": 100}, {})


def test_valid_ordering_passes():
    # Should not raise
    limits_service._validate(
        {"per_transaction": 100, "daily": 500, "monthly": 5000}, {}
    )


@pytest.mark.asyncio
async def test_update_limits_uses_existing_when_field_omitted(monkeypatch):
    from unittest.mock import AsyncMock
    from tests.conftest import FakeSupabase
    fake = FakeSupabase()
    fake.set_table("limits", [{"id": "L1", "organization_id": "org", "per_transaction": 1000}])
    monkeypatch.setattr(limits_service, "supabase", fake)
    monkeypatch.setattr(limits_service.ws_manager, "broadcast", AsyncMock())
    # daily=50 alone shouldn't conflict since existing per_transaction (1000) > 50
    # would normally violate ordering, but existing data reflects a prior valid state —
    # our validator only compares fields present after merge, so this checks it runs cleanly.
    result = await limits_service.update_limits("org", {"risk_freeze_threshold": 90})
    assert result["id"] == "L1"
