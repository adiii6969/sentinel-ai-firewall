import pytest


@pytest.fixture
def anyio_backend():
    return "asyncio"


class FakeResult:
    """Mimics the object returned by supabase-py's .execute()."""
    def __init__(self, data):
        self.data = data
        self.count = len(data) if isinstance(data, list) else None


class FakeQuery:
    """Chainable stand-in for a supabase-py query builder.
    Every filter/order/limit method just returns self; only the final
    .execute() matters, and it returns whatever rows were registered
    for that table via FakeSupabase.set_table(...)."""
    def __init__(self, rows):
        self._rows = rows
        self._single = False

    def __getattr__(self, _name):
        def _chain(*_args, **_kwargs):
            return self
        return _chain

    def execute(self):
        if self._single:
            return FakeResult(self._rows[0] if self._rows else None)
        return FakeResult(self._rows)

    def single(self):
        self._single = True
        return self

    def maybe_single(self):
        self._single = True
        return self


class FakeSupabase:
    """Stand-in for the module-level `supabase` client. Register rows
    per table name; unregistered tables return an empty list."""
    def __init__(self):
        self._tables = {}

    def set_table(self, name, rows):
        self._tables[name] = rows

    def table(self, name):
        return FakeQuery(self._tables.get(name, []))
