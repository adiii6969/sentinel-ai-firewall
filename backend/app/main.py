from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.core.config import settings
from app.core.exceptions import SentinelError
from app.middleware.error_handler import sentinel_error_handler, unhandled_error_handler
from app.middleware.rate_limit import limiter
from app.routers import (
    auth, dashboard, firewall, risk, vendors, transactions,
    limits, killswitch, advisor, analytics, audit, notifications, websocket,
    agents, wallets,
)

app = FastAPI(
    title="Sentinel — AI Spending Firewall API",
    description="Production backend for the Sentinel AI spending firewall, risk engine and audit platform.",
    version="1.0.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_exception_handler(SentinelError, sentinel_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
for r in (auth, dashboard, firewall, risk, vendors, transactions,
          limits, killswitch, advisor, analytics, audit, notifications,
          agents, wallets):
    app.include_router(r.router, prefix="/api/v1")

app.include_router(websocket.router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok"}
