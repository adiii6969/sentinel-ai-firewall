from fastapi import Request
from fastapi.responses import JSONResponse
from app.core.exceptions import SentinelError
from app.utils.logger import logger


async def sentinel_error_handler(request: Request, exc: SentinelError):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.code, "message": exc.message})


async def unhandled_error_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.url.path}: {exc}")
    return JSONResponse(status_code=500, content={"error": "internal_error", "message": "Something went wrong"})
