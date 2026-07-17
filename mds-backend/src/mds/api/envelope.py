from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


def ok(results: Any) -> dict[str, Any]:
    return {"status": "ok", "results": results}


def api_error(name: str, status_code: int, message: str, data: Any = None) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "status": "error",
        "error": {
            "name": name,
            "statusCode": status_code,
            "message": message,
        },
    }
    if data is not None:
        payload["error"]["data"] = data
    return payload


async def http_exception_handler(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    name = detail if isinstance(exc.detail, str) else "HttpError"
    return JSONResponse(
        status_code=exc.status_code,
        content=api_error(name, exc.status_code, detail),
    )


async def validation_exception_handler(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=api_error("ValidationError", 422, "Invalid request body", exc.errors()),
    )
