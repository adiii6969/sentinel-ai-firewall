class SentinelError(Exception):
    """Base app error -> mapped to a clean JSON response by the global handler."""
    def __init__(self, message: str, status_code: int = 400, code: str = "sentinel_error"):
        self.message = message
        self.status_code = status_code
        self.code = code
        super().__init__(message)


class FirewallBlocked(SentinelError):
    def __init__(self, message: str):
        super().__init__(message, status_code=403, code="firewall_blocked")


class KillSwitchActive(SentinelError):
    def __init__(self):
        super().__init__("Kill switch is active — all transactions are frozen", 423, "killswitch_active")
