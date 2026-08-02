from datetime import datetime, timezone
from unittest.mock import patch
from app.services import policy_engine
from tests.conftest import FakeSupabase

WALLET = {"status": "active"}
VENDOR = {"status": "approved", "category": "Messaging"}


def _base_patches(rules, tx_rows=None):
    """Common patches so evaluate() reaches the firewall-rules section
    without tripping earlier checks (killswitch/agent/wallet/vendor/limits)."""
    fake = FakeSupabase()
    fake.set_table("agents", [{"status": "active"}])
    fake.set_table("transactions", tx_rows or [])
    return patch.multiple(
        policy_engine,
        get_killswitch=lambda org_id: None,
        get_limits=lambda org_id: {"risk_freeze_threshold": 80},
        get_agent_limits=lambda org_id, agent_id: None,
        get_rules=lambda org_id: rules,
        supabase=fake,
    )


def test_allowed_categories_blocks_disallowed_vendor():
    rule = {"name": "Cloud only", "rule_type": "allowed_categories",
            "config": {"categories": ["Cloud infrastructure"]}}
    with _base_patches([rule]):
        out = policy_engine.evaluate("org", "agent", WALLET, VENDOR, 50, 10)
    assert out["decision"] == "block"
    assert "Messaging" in out["reasons"][0]


def test_allowed_categories_passes_allowed_vendor():
    rule = {"name": "Messaging ok", "rule_type": "allowed_categories",
            "config": {"categories": ["Messaging"]}}
    with _base_patches([rule]):
        out = policy_engine.evaluate("org", "agent", WALLET, VENDOR, 50, 10)
    assert out["decision"] == "approve"


def test_time_restriction_blocks_outside_window():
    rule = {"name": "Business hours", "rule_type": "time_restriction",
            "config": {"start_hour": 0, "end_hour": 1}}  # only 00:00-01:00 UTC allowed
    with _base_patches([rule]):
        now = datetime.now(timezone.utc)
        if 0 <= now.hour < 1:
            rule["config"] = {"start_hour": (now.hour + 2) % 24, "end_hour": (now.hour + 3) % 24 or 24}
        out = policy_engine.evaluate("org", "agent", WALLET, VENDOR, 50, 10)
    assert out["decision"] == "block"
    assert "blocked outside" in out["reasons"][0]


def test_frequency_limit_blocks_when_exceeded():
    rule = {"name": "Max 2/min", "rule_type": "frequency_limit",
            "config": {"max_count": 2, "window_seconds": 60}}
    tx_rows = [{"id": "1"}, {"id": "2"}]  # count_since will report 2, meeting the cap
    with _base_patches([rule], tx_rows=tx_rows):
        out = policy_engine.evaluate("org", "agent", WALLET, VENDOR, 50, 10)
    assert out["decision"] == "block"
    assert "requests in" in out["reasons"][0]


def test_frequency_limit_passes_when_under_cap():
    rule = {"name": "Max 5/min", "rule_type": "frequency_limit",
            "config": {"max_count": 5, "window_seconds": 60}}
    tx_rows = [{"id": "1"}]  # only 1 recent transaction, well under cap
    with _base_patches([rule], tx_rows=tx_rows):
        out = policy_engine.evaluate("org", "agent", WALLET, VENDOR, 50, 10)
    assert out["decision"] == "approve"
