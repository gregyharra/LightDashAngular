import os
import time
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

    nodes_by_id = {node["id"]: node for node in lineage["nodes"]}
    fct_orders = nodes_by_id["model.jaffle_shop.marts.fct_orders"]
    assert fct_orders["sql"] == "select * from {{ ref('stg_orders') }}"

    stg_orders = nodes_by_id["model.jaffle_shop.staging.stg_orders"]
    assert "from {{ source('raw', 'raw_orders') }}" in stg_orders["sql"]

    assert "sql" not in nodes_by_id["source.jaffle_shop.raw.raw_orders"]

    column_edges = lineage.get("columnEdges") or []
    assert column_edges
    rename_edges = [
        edge
        for edge in column_edges
        if edge.get("transformationType") == "rename" and edge.get("targetColumn") == "order_id"
    ]
    assert rename_edges


def test_dbt_tree_from_local_dbt_artifacts(client: TestClient) -> None:
    response = client.get(f"/api/v1/projects/{MOCK_PROJECT_UUID}/dbt-tree")
    assert response.status_code == 200
    root = response.json()["results"]["root"]
    top_names = {folder["name"] for folder in root}
    assert {"models", "seeds", "sources"}.issubset(top_names)

    models_folder = next(folder for folder in root if folder["name"] == "models")
    model_child_names = {child["name"] for child in models_folder["children"]}
    assert "models" not in model_child_names
    assert {"staging", "marts"}.issubset(model_child_names)

    seeds_folder = next(folder for folder in root if folder["name"] == "seeds")
    seed_child_names = {child["name"] for child in seeds_folder["children"]}
    assert "seeds" not in seed_child_names
    assert "country_codes" in seed_child_names

    sources_folder = next(folder for folder in root if folder["name"] == "sources")
    source_child_names = {child["name"] for child in sources_folder["children"]}
    assert "sources" not in source_child_names
    assert "raw" in source_child_names


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


def test_refresh_regenerates_stale_manifest(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    scripts_dir = FIXTURES_DIR / "scripts"
    scripts_dir.mkdir(exist_ok=True)
    script_path = scripts_dir / "generate_manifest.py"
    original_script = script_path.read_text(encoding="utf-8") if script_path.exists() else None
    script_path.write_text(
        "\n".join(
            [
                "import json",
                "from pathlib import Path",
                "root = Path(__file__).resolve().parents[1]",
                "target = root / 'target'",
                "target.mkdir(exist_ok=True)",
                "manifest = {",
                "  'metadata': {'project_name': 'jaffle_shop'},",
                "  'nodes': {",
                "    'model.jaffle_shop.marts.fct_orders': {",
                "      'resource_type': 'model',",
                "      'name': 'fct_orders',",
                "      'original_file_path': 'models/marts/fct_orders.sql',",
                "      'depends_on': {'nodes': []},",
                "    },",
                "    'model.jaffle_shop.marts.fct_customers': {",
                "      'resource_type': 'model',",
                "      'name': 'fct_customers',",
                "      'original_file_path': 'models/marts/fct_customers.sql',",
                "      'depends_on': {'nodes': []},",
                "    },",
                "  },",
                "  'sources': {},",
                "}",
                "(target / 'manifest.json').write_text(json.dumps(manifest), encoding='utf-8')",
            ]
        ),
        encoding="utf-8",
    )

    manifest_path = FIXTURES_DIR / "target" / "manifest.json"
    original_manifest = manifest_path.read_text(encoding="utf-8")
    manifest_path.write_text('{"metadata": {}, "nodes": {}, "sources": {}}', encoding="utf-8")
    stale_mtime = time.time() - 60
    os.utime(manifest_path, (stale_mtime, stale_mtime))
    (FIXTURES_DIR / "models" / "staging" / "stg_orders.sql").touch()
    clear_dbt_artifacts_cache()

    try:
        response = client.post(f"/api/v1/projects/{MOCK_PROJECT_UUID}/refresh")
        assert response.status_code == 200

        lineage = client.get(f"/api/v1/projects/{MOCK_PROJECT_UUID}/lineage").json()["results"]
        node_ids = {node["id"] for node in lineage["nodes"]}
        assert "model.jaffle_shop.marts.fct_orders" in node_ids
        assert "model.jaffle_shop.marts.fct_customers" in node_ids
    finally:
        manifest_path.write_text(original_manifest, encoding="utf-8")
        if original_script is None:
            script_path.unlink(missing_ok=True)
            if scripts_dir.exists() and not any(scripts_dir.iterdir()):
                scripts_dir.rmdir()
        else:
            script_path.write_text(original_script, encoding="utf-8")
        clear_dbt_artifacts_cache()


def test_dbt_tree_falls_back_to_env_path_when_no_explicit_path(
    client: TestClient,
    tmp_path: Path,
) -> None:
    create = client.post("/api/v1/projects", json={"name": "Clone path without artifacts"})
    assert create.status_code == 200
    project_uuid = create.json()["results"]["projectUuid"]

    clear_dbt_artifacts_cache()
    response = client.get(f"/api/v1/projects/{project_uuid}/dbt-tree")
    assert response.status_code == 200
    root = response.json()["results"]["root"]
    top_names = {folder["name"] for folder in root}
    assert {"models", "seeds", "sources"}.issubset(top_names)


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
