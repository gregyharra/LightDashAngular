import os

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("SEED_DEMO_DATA", "false")

from fastapi.testclient import TestClient

from mds.main import app


def test_http_exception_uses_error_envelope() -> None:
    client = TestClient(app)
    response = client.get("/api/v1/warehouses/not-a-uuid")

    assert response.status_code == 404
    body = response.json()
    assert body == {
        "status": "error",
        "error": {
            "name": "NotFound",
            "statusCode": 404,
            "message": "Warehouse not found",
        },
    }


def test_validation_error_uses_readable_message() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/v1/warehouses",
        json={"name": "Missing required fields"},
    )

    assert response.status_code == 422
    body = response.json()
    assert body["status"] == "error"
    assert body["error"]["name"] == "ValidationError"
    assert body["error"]["statusCode"] == 422
    assert "Field required" in body["error"]["message"]
    assert isinstance(body["error"]["data"], list)


def test_error_messages_do_not_leak_passwords() -> None:
    from mds.api.errors import sanitize_error_message

    message = sanitize_error_message("Login failed for user=mds password=super-secret")
    assert "super-secret" not in message
    assert "[redacted]" in message
