from app.services import policy_engine
from tests.conftest import FakeSupabase


def test_blocked_vendor_always_blocks():
    wallet = {"status": "active"}
    vendor = {"status": "blocked"}
    # Direct call without DB — vendor/wallet short-circuit happens before any query
    # beyond the agent-status lookup, which we fake out with an active agent.
    from unittest.mock import patch
    fake = FakeSupabase()
    fake.set_table("agents", [{"status": "active"}])
    with patch("app.services.policy_engine.get_killswitch", return_value=None), \
         patch.object(policy_engine, "supabase", fake):
        out = policy_engine.evaluate("org", "agent", wallet, vendor, 100, 10)
    assert out["decision"] == "block"


def test_frozen_wallet_blocks():
    from unittest.mock import patch
    wallet = {"status": "frozen"}
    vendor = {"status": "approved"}
    fake = FakeSupabase()
    fake.set_table("agents", [{"status": "active"}])
    with patch("app.services.policy_engine.get_killswitch", return_value=None), \
         patch.object(policy_engine, "supabase", fake):
        out = policy_engine.evaluate("org", "agent", wallet, vendor, 100, 10)
    assert out["decision"] == "block"
