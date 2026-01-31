from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from jose import jwt, JWTError

from app.config import settings


class ReadOnlyDemoMiddleware(BaseHTTPMiddleware):
    """Block write operations for demo tenants.

    Security: Checks the signed 'is_demo' claim in JWT instead of database lookup.
    This prevents performance issues (no DB query on every write request) while
    maintaining security (JWT signature prevents claim tampering).
    """

    async def dispatch(self, request: Request, call_next):
        # Allow read operations
        if request.method in ["GET", "OPTIONS", "HEAD"]:
            return await call_next(request)

        # Check if request is from demo tenant
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return await call_next(request)

        token = auth_header.replace("Bearer ", "")

        try:
            # Decode token and check is_demo claim
            # JWT signature verification prevents tampering with is_demo flag
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
            )

            # Check the signed is_demo claim (no database hit needed)
            if payload.get("is_demo"):
                return JSONResponse(
                    status_code=403,
                    content={
                        "detail": "Demo mode: Read-only access. Sign up for full access."
                    }
                )

        except JWTError:
            pass  # Invalid token, let other middleware/dependencies handle it

        return await call_next(request)
