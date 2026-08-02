"""Risk engine tests use a fake Supabase table interface so they run
without network access; see the `monkeypatch` fixture usage below."""
from app.services.risk_engine import _level


def test_level_bands():
    assert _level(10) == "safe"
    assert _level(40) == "medium"
    assert _level(60) == "high"
    assert _level(90) == "critical"
