import json
import time
from pathlib import Path

import pytest

from mds.config import settings
from mds.services.dbt.loader import clear_dbt_artifacts_cache, load_dbt_artifacts
from mds.services.dbt.manifest import (
    ensure_fresh_manifest,
    get_latest_source_mtime,
    is_manifest_stale,
    regenerate_manifest,
)


@pytest.fixture
def dbt_project(tmp_path: Path) -> Path:
    project = tmp_path / "dbt_project"
    project.mkdir()
    (project / "dbt_project.yml").write_text("name: sample\n", encoding="utf-8")
    models = project / "models" / "staging"
    models.mkdir(parents=True)
    (models / "stg_orders.sql").write_text("select 1", encoding="utf-8")
    target = project / "target"
    target.mkdir()
    return project


def _write_manifest(project: Path, *, node_name: str = "stg_orders") -> Path:
    manifest_path = project / "target" / "manifest.json"
    manifest = {
        "metadata": {"project_name": "sample"},
        "nodes": {
            f"model.sample.staging.{node_name}": {
                "resource_type": "model",
                "name": node_name,
            }
        },
        "sources": {},
    }
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    return manifest_path


def test_get_latest_source_mtime_uses_newest_project_file(dbt_project: Path) -> None:
    manifest_path = _write_manifest(dbt_project)
    manifest_mtime = manifest_path.stat().st_mtime
    time.sleep(0.05)

    sql_path = dbt_project / "models" / "staging" / "stg_orders.sql"
    sql_path.write_text("select 2", encoding="utf-8")

    source_mtime = get_latest_source_mtime(dbt_project)
    assert source_mtime is not None
    assert source_mtime > manifest_mtime


def test_is_manifest_stale_when_source_newer_than_manifest(dbt_project: Path) -> None:
    manifest_path = _write_manifest(dbt_project)
    time.sleep(0.05)
    (dbt_project / "models" / "staging" / "stg_orders.sql").write_text("select 2", encoding="utf-8")

    assert is_manifest_stale(dbt_project, manifest_path) is True


def test_is_manifest_stale_false_when_manifest_is_current(dbt_project: Path) -> None:
    manifest_path = _write_manifest(dbt_project)
    time.sleep(0.05)
    manifest_path.touch()

    assert is_manifest_stale(dbt_project, manifest_path) is False


def test_cache_invalidates_when_manifest_mtime_changes(dbt_project: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "dbt_project_path", str(dbt_project))
    monkeypatch.setattr(settings, "dbt_artifacts_path", None)
    monkeypatch.setattr(settings, "auto_regenerate_manifest", False)
    clear_dbt_artifacts_cache()

    _write_manifest(dbt_project, node_name="old_model")
    first = load_dbt_artifacts(str(dbt_project))
    assert len(first.manifest["nodes"]) == 1
    assert "old_model" in next(iter(first.manifest["nodes"].values()))["name"]

    time.sleep(0.05)
    _write_manifest(dbt_project, node_name="new_model")
    second = load_dbt_artifacts(str(dbt_project))
    assert second.manifest is not first.manifest
    assert len(second.manifest["nodes"]) == 1
    assert "new_model" in next(iter(second.manifest["nodes"].values()))["name"]


def test_auto_regenerate_runs_generate_manifest_script(dbt_project: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    scripts = dbt_project / "scripts"
    scripts.mkdir()
    (scripts / "generate_manifest.py").write_text(
        "\n".join(
            [
                "import json",
                "from pathlib import Path",
                "root = Path(__file__).resolve().parents[1]",
                "target = root / 'target'",
                "target.mkdir(exist_ok=True)",
                "manifest = {",
                "  'metadata': {'project_name': 'sample'},",
                "  'nodes': {",
                "    'model.sample.staging.stg_orders': {'resource_type': 'model', 'name': 'stg_orders'},",
                "    'model.sample.staging.stg_customers': {'resource_type': 'model', 'name': 'stg_customers'},",
                "  },",
                "  'sources': {},",
                "}",
                "(target / 'manifest.json').write_text(json.dumps(manifest), encoding='utf-8')",
            ]
        ),
        encoding="utf-8",
    )

    manifest_path = dbt_project / "target" / "manifest.json"
    _write_manifest(dbt_project, node_name="stale_only")
    time.sleep(0.05)
    (dbt_project / "models" / "staging" / "stg_orders.sql").write_text("select 3", encoding="utf-8")

    monkeypatch.setattr(settings, "dbt_project_path", str(dbt_project))
    monkeypatch.setattr(settings, "dbt_artifacts_path", None)
    monkeypatch.setattr(settings, "auto_regenerate_manifest", True)
    clear_dbt_artifacts_cache()

    artifacts = load_dbt_artifacts(str(dbt_project))
    assert len(artifacts.manifest["nodes"]) == 2


def test_regenerate_manifest_uses_project_script(dbt_project: Path) -> None:
    scripts = dbt_project / "scripts"
    scripts.mkdir()
    (scripts / "generate_manifest.py").write_text(
        "\n".join(
            [
                "import json",
                "from pathlib import Path",
                "root = Path(__file__).resolve().parents[1]",
                "target = root / 'target'",
                "target.mkdir(exist_ok=True)",
                "(target / 'manifest.json').write_text(",
                "  json.dumps({'metadata': {}, 'nodes': {'model.sample.a.b': {}}, 'sources': {}}),",
                "  encoding='utf-8',",
                ")",
            ]
        ),
        encoding="utf-8",
    )

    assert regenerate_manifest(dbt_project) is True
    manifest = json.loads((dbt_project / "target" / "manifest.json").read_text(encoding="utf-8"))
    assert "model.sample.a.b" in manifest["nodes"]


def test_ensure_fresh_manifest_skips_when_manifest_is_current(dbt_project: Path) -> None:
    manifest_path = _write_manifest(dbt_project)
    time.sleep(0.05)
    manifest_path.touch()

    assert ensure_fresh_manifest(dbt_project) is False


def test_ensure_fresh_manifest_regenerates_when_stale(dbt_project: Path) -> None:
    scripts = dbt_project / "scripts"
    scripts.mkdir()
    (scripts / "generate_manifest.py").write_text(
        "\n".join(
            [
                "import json",
                "from pathlib import Path",
                "root = Path(__file__).resolve().parents[1]",
                "(root / 'target' / 'manifest.json').write_text(",
                "  json.dumps({'metadata': {}, 'nodes': {'model.sample.regenerated.x': {}}, 'sources': {}}),",
                "  encoding='utf-8',",
                ")",
            ]
        ),
        encoding="utf-8",
    )

    manifest_path = _write_manifest(dbt_project)
    time.sleep(0.05)
    (dbt_project / "models" / "staging" / "stg_orders.sql").write_text("select 4", encoding="utf-8")

    assert ensure_fresh_manifest(dbt_project) is True
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert "model.sample.regenerated.x" in manifest["nodes"]
