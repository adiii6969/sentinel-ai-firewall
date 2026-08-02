from unittest.mock import patch
from app.services import agent_service
from tests.conftest import FakeSupabase


class MultiTableFakeSupabase(FakeSupabase):
    """FakeSupabase already routes by table name; nothing extra needed
    beyond registering wallets/transactions/agents rows per test."""
    pass


def test_list_agents_aggregates_spend_and_wallets():
    fake = MultiTableFakeSupabase()
    fake.set_table("agents", [
        {"id": "A1", "organization_id": "org", "name": "Procurement Bot", "status": "active"},
    ])
    fake.set_table("wallets", [{"id": "W1", "agent_id": "A1", "status": "active"}])
    fake.set_table("transactions", [
        {"agent_id": "A1", "amount": "100.00", "status": "approved", "created_at": "2026-01-01T00:00:00Z"},
        {"agent_id": "A1", "amount": "50.00", "status": "blocked", "created_at": "2026-01-02T00:00:00Z"},
    ])
    with patch.object(agent_service, "supabase", fake):
        agents = agent_service.list_agents("org")

    assert len(agents) == 1
    a = agents[0]
    assert a["total_spent"] == 100.00  # only approved counts toward spend
    assert a["transaction_count"] == 2  # but every attempt counts
    assert len(a["wallets"]) == 1


def test_list_agents_handles_no_agents():
    fake = MultiTableFakeSupabase()
    fake.set_table("agents", [])
    with patch.object(agent_service, "supabase", fake):
        assert agent_service.list_agents("org") == []


def test_set_status_frozen_freezes_wallets_and_raises_alert():
    fake = MultiTableFakeSupabase()
    fake.set_table("agents", [{"id": "A1", "organization_id": "org", "name": "Bot", "status": "frozen"}])
    with patch.object(agent_service, "supabase", fake):
        row = agent_service.set_status("org", "A1", "frozen", reason="suspicious burst of payments")
    assert row["status"] == "frozen"
