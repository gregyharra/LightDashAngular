import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from mds.config import settings
from mds.db.seed import MOCK_PROJECT_UUID
from mds.main import app
from mds.services.dbt.loader import clear_dbt_artifacts_cache

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "dbt"
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")


@pytest.fixture(scope="module", autouse=True)
def _configure_local_dbt_path() -> None:
    target_dir = FIXTURES_DIR / "target"
    target_dir.mkdir(parents=True, exist_ok=True)
    if not (FIXTURES_DIR / "dbt_project.yml").exists():
        (FIXTURES_DIR / "dbt_project.yml").write_text("name: jaffle_shop\n", encoding="utf-8")
    settings.dbt_project_path = str(FIXTURES_DIR)
    settings.dbt_artifacts_path = ""
    clear_dbt_artifacts_cache()
    yield
    clear_dbt_artifacts_cache()


@pytest.fixture(scope="module")
def client() -> TestClient:
    clear_dbt_artifacts_cache()
    with TestClient(app) as test_client:
        yield test_client


def test_lineage_from_local_dbt_artifacts(client: TestClient) -> None:
    response = client.get(f"/api/v1/projects/{MOCK_PROJECT_UUID}/lineage")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    lineage = body["results"]
    assert lineage["projectUuid"] == str(MOCK_PROJECT_UUID)
    assert lineage["dbtProject"]["name"] == "jaffle_shop"
    node_ids = {node["id"] for node in lineage["nodes"]}
    assert "model.jaffle_shop.marts.fct_orders" in node_ids
    assert "source.jaffle_shop.raw.raw_orders" in node_ids
    assert any(edge["target"] == "model.jaffle_shop.marts.fct_orders" for edge in lineage["edges"])


def test_dbt_tree_from_local_dbt_artifacts(client: TestClient) -> None:
    response = client.get(f"/api/v1/projects/{MOCK_PROJECT_UUID}/dbt-tree")
    assert response.status_code == 200
    root = response.json()["results"]["root"]
    top_names = {folder["name"] for folder in root}
    assert {"models", "seeds", "sources"}.issubset(top_names)


def test_explores_from_local_dbt_artifacts(client: TestClient) -> None:
    response = client.get(f"/api/v1/projects/{MOCK_PROJECT_UUID}/explores")
    assert response.status_code == 200
    explores = response.json()["results"]
    assert "fct_orders" in explores
    assert explores["fct_orders"]["lineageNodeId"] == "model.jaffle_shop.marts.fct_orders"


def test_explore_detail_builds_dimensions_and_metrics(client: TestClient) -> None:
    response = client.get(f"/api/v1/projects/{MOCK_PROJECT_UUID}/explores/fct_orders")
    assert response.status_code == 200
    explore = response.json()["results"]
    table = explore["tables"]["fct_orders"]
    assert "order_id" in table["dimensions"]
    assert "row_count" in table["metrics"]
    assert "total_amount" in table["metrics"]


def test_refresh_reloads_artifacts(client: TestClient) -> None:
    response = client.post(f"/api/v1/projects/{MOCK_PROJECT_UUID}/refresh")
    assert response.status_code == 200
    assert response.json()["results"]["jobUuid"]


def test_missing_manifest_returns_helpful_error(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    empty_dir = FIXTURES_DIR.parent / "empty_dbt_project"
    empty_dir.mkdir(parents=True, exist_ok=True)
    settings.dbt_project_path = str(empty_dir)
    clear_dbt_artifacts_cache()

    response = client.get(f"/api/v1/projects/{MOCK_PROJECT_UUID}/lineage")
    assert response.status_code == 503
    assert "dbt compile" in response.json()["error"]["message"]

    settings.dbt_project_path = str(FIXTURES_DIR)
    clear_dbt_artifacts_cache()
