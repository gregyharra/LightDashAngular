"""Tests for build_project_lineage result caching in _load_lineage_context."""

from __future__ import annotations

import json
import uuid as uuid_lib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from mds.config import settings
from mds.db.models import Project
from mds.db.session import SessionLocal
from mds.main import app
from mds.routers.semantic import _load_lineage_context
from mds.services.dbt.loader import clear_dbt_artifacts_cache, clear_lineage_cache


@pytest.fixture
def initialized_db() -> None:
    with TestClient(app):
        yield


@pytest.fixture(autouse=True)
def _clear_caches() -> None:
    clear_dbt_artifacts_cache()
    clear_lineage_cache()
    yield
    clear_dbt_artifacts_cache()
    clear_lineage_cache()


def _write_minimal_manifest(project_dir: Path) -> None:
    target = project_dir / "target"
    target.mkdir(exist_ok=True)
    manifest = {
        "metadata": {"project_name": "sample"},
        "nodes": {
            "model.sample.staging.stg_orders": {
                "resource_type": "model",
                "name": "stg_orders",
                "schema": "staging",
            }
        },
        "sources": {},
    }
    (target / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")


def _create_project_with_dbt_path(dbt_path: Path) -> uuid_lib.UUID:
    project_uuid = uuid_lib.uuid4()
    db = SessionLocal()
    try:
        db.add(
            Project(
                uuid=project_uuid,
                name="Lineage cache test",
                warehouse_type="trino",
                dbt_project_path=str(dbt_path),
            )
        )
        db.commit()
    finally:
        db.close()
    return project_uuid


def test_second_load_lineage_context_skips_build_project_lineage(
    initialized_db: None,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    dbt_dir = tmp_path / "dbt_project"
    dbt_dir.mkdir()
    (dbt_dir / "dbt_project.yml").write_text("name: sample\n", encoding="utf-8")
    _write_minimal_manifest(dbt_dir)

    monkeypatch.setattr(settings, "dbt_artifacts_path", None)
    monkeypatch.setattr(settings, "auto_regenerate_manifest", False)

    project_uuid = _create_project_with_dbt_path(dbt_dir)
    build_calls = 0
    original_build = __import__(
        "mds.services.dbt.parse", fromlist=["build_project_lineage"]
    ).build_project_lineage

    def counting_build(*args, **kwargs):
        nonlocal build_calls
        build_calls += 1
        return original_build(*args, **kwargs)

    monkeypatch.setattr(
        "mds.routers.semantic.build_project_lineage",
        counting_build,
    )

    db = SessionLocal()
    try:
        _load_lineage_context(db, str(project_uuid))
        _load_lineage_context(db, str(project_uuid))
    finally:
        db.close()

    assert build_calls == 1


def test_clear_dbt_artifacts_cache_forces_lineage_rebuild(
    initialized_db: None,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    dbt_dir = tmp_path / "dbt_project"
    dbt_dir.mkdir()
    (dbt_dir / "dbt_project.yml").write_text("name: sample\n", encoding="utf-8")
    _write_minimal_manifest(dbt_dir)

    monkeypatch.setattr(settings, "dbt_artifacts_path", None)
    monkeypatch.setattr(settings, "auto_regenerate_manifest", False)

    project_uuid = _create_project_with_dbt_path(dbt_dir)
    build_calls = 0
    original_build = __import__(
        "mds.services.dbt.parse", fromlist=["build_project_lineage"]
    ).build_project_lineage

    def counting_build(*args, **kwargs):
        nonlocal build_calls
        build_calls += 1
        return original_build(*args, **kwargs)

    monkeypatch.setattr(
        "mds.routers.semantic.build_project_lineage",
        counting_build,
    )

    db = SessionLocal()
    try:
        _load_lineage_context(db, str(project_uuid))
        clear_dbt_artifacts_cache()
        _load_lineage_context(db, str(project_uuid))
    finally:
        db.close()

    assert build_calls == 2
