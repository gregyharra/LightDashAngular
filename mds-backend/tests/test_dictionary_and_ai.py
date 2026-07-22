import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

import pytest
from fastapi.testclient import TestClient

from mds.db.seed import MOCK_PROJECT_UUID
from mds.main import app


@pytest.fixture(scope="module")
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def test_dictionary_quality(client: TestClient) -> None:
    response = client.get(f"/api/v1/projects/{MOCK_PROJECT_UUID}/dictionary/quality")
    # 200 when dbt artifacts exist, 503 when not configured in CI
    assert response.status_code in (200, 503)
    if response.status_code == 200:
        body = response.json()
        assert body["status"] == "ok"
        assert "score" in body["results"]


def test_ai_chat_requires_message(client: TestClient) -> None:
    response = client.post(
        f"/api/v1/projects/{MOCK_PROJECT_UUID}/ai/chat",
        json={"messages": [], "mode": "ask"},
    )
    assert response.status_code in (400, 503)
