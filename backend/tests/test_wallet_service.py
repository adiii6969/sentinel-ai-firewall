from unittest.mock import patch
from app.services import wallet_service
from tests.conftest import FakeSupabase


def test_list_wallets_attaches_agent_name_and_status():
    fake = FakeSupabase()
    fake.set_table("wallets", [{"id": "W1", "agent_id": "A1", "organization_id": "org"}])
    fake.set_table("agents", [{"id": "A1", "name": "Procurement Bot", "status": "active"}])
    with patch.object(wallet_service, "supabase", fake):
        wallets = wallet_service.list_wallets("org")
    assert wallets[0]["agent_name"] == "Procurement Bot"
    assert wallets[0]["agent_status"] == "active"


def test_list_wallets_unassigned_when_no_agent():
    fake = FakeSupabase()
    fake.set_table("wallets", [{"id": "W1", "agent_id": None, "organization_id": "org"}])
    fake.set_table("agents", [])
    with patch.object(wallet_service, "supabase", fake):
        wallets = wallet_service.list_wallets("org")
    assert wallets[0]["agent_name"] == "Unassigned"
    assert wallets[0]["agent_status"] is None


def test_freeze_wallet_sets_status_frozen():
    fake = FakeSupabase()
    fake.set_table("wallets", [{"id": "W1", "organization_id": "org", "status": "frozen"}])
    with patch.object(wallet_service, "supabase", fake):
        row = wallet_service.freeze_wallet("org", "W1")
    assert row["status"] == "frozen"


def test_unfreeze_wallet_sets_status_active():
    fake = FakeSupabase()
    fake.set_table("wallets", [{"id": "W1", "organization_id": "org", "status": "active"}])
    with patch.object(wallet_service, "supabase", fake):
        row = wallet_service.unfreeze_wallet("org", "W1")
    assert row["status"] == "active"
