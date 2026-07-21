import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

import pytest
from fastapi.testclient import TestClient

from mds.db.seed import MOCK_CHART_4_UUID, MOCK_PROJECT_2_UUID, MOCK_PROJECT_UUID
from mds.main import app


@pytest.fixture(scope="module")
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def test_list_saved_charts(client: TestClient) -> None:
    response = client.get(f"/api/v1/projects/{MOCK_PROJECT_UUID}/saved")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    uuids = {item["uuid"] for item in body["results"]}
    assert str(MOCK_CHART_4_UUID) in uuids
    assert len(body["results"]) == 3


def test_list_saved_charts_empty_project(client: TestClient) -> None:
    response = client.get(f"/api/v1/projects/{MOCK_PROJECT_2_UUID}/saved")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["results"] == []


def test_get_saved_chart(client: TestClient) -> None:
    response = client.get(
        f"/api/v1/projects/{MOCK_PROJECT_UUID}/saved/{MOCK_CHART_4_UUID}"
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    chart = body["results"]
    assert chart["uuid"] == str(MOCK_CHART_4_UUID)
    assert chart["chartKind"] == "big_number"
    assert chart["metricQuery"]["exploreName"] == "orders"
    assert chart["updatedByUser"]["firstName"] == "Demo"


def test_get_saved_chart_not_found(client: TestClient) -> None:
    response = client.get(
        f"/api/v1/projects/{MOCK_PROJECT_UUID}/saved/00000000-0000-0000-0000-000000000099"
    )
    assert response.status_code == 404
