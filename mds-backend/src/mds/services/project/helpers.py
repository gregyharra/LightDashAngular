from __future__ import annotations

from fastapi import HTTPException

from sqlalchemy.orm import Session

from mds.db.models import Project, Warehouse
from mds.schemas.project import ProjectCreate, ProjectUpdate
from mds.services.encryption import encrypt_secret
from mds.services.project.git import (
    GIT_PROVIDERS,
    detect_git_provider,
    get_repo_status,
    remove_project_data_dir,
)


def format_dt(value) -> str:
    return value.isoformat().replace("+00:00", "Z")


def project_payload(project: Project, warehouse: Warehouse | None = None) -> dict:
    repo_status = get_repo_status(project)
    return {
        "projectUuid": str(project.uuid),
        "name": project.name,
        "type": "DEFAULT",
        "createdByUserUuid": str(project.created_by_user_uuid)
        if project.created_by_user_uuid
        else None,
        "createdByUserName": "Demo Analyst" if project.created_by_user_uuid else None,
        "createdAt": format_dt(project.created_at),
        "upstreamProjectUuid": None,
        "warehouseType": project.warehouse_type,
        "warehouseUuid": str(project.warehouse_uuid) if project.warehouse_uuid else None,
        "warehouseName": warehouse.name if warehouse else None,
        "expiresAt": None,
        "gitRepoUrl": project.git_repo_url,
        "gitDefaultBranch": project.git_default_branch or "main",
        "gitProvider": project.git_provider,
        "gitSubdirectory": project.git_subdirectory,
        "hasGitToken": project.encrypted_git_token is not None,
        "dbtProjectPath": project.dbt_project_path,
        "repo": {
            "configured": repo_status["configured"],
            "cloned": repo_status["cloned"],
            "branch": repo_status["branch"],
            "commitSha": repo_status["commitSha"],
            "lastSyncAt": repo_status["lastSyncAt"],
        },
    }


def _validate_git_provider(provider: str | None) -> str | None:
    if provider is None:
        return None
    normalized = provider.strip().lower()
    if normalized not in GIT_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid git provider. Must be one of: {', '.join(sorted(GIT_PROVIDERS))}",
        )
    return normalized


def apply_git_fields_on_create(project: Project, body: ProjectCreate) -> None:
    repo_url = (body.git_repo_url or "").strip() or None
    project.git_repo_url = repo_url
    project.git_default_branch = (body.git_default_branch or "main").strip() or "main"
    project.git_subdirectory = (body.git_subdirectory or "").strip() or None

    if body.git_provider is not None:
        project.git_provider = _validate_git_provider(body.git_provider)
    elif repo_url:
        project.git_provider = detect_git_provider(repo_url)
    else:
        project.git_provider = None

    if body.git_token:
        project.encrypted_git_token = encrypt_secret(body.git_token)

    if body.dbt_project_path is not None:
        project.dbt_project_path = (body.dbt_project_path or "").strip() or None


def apply_git_fields_on_update(project: Project, body: ProjectUpdate) -> None:
    if "git_repo_url" in body.model_fields_set:
        repo_url = (body.git_repo_url or "").strip() or None
        project.git_repo_url = repo_url
        if repo_url and "git_provider" not in body.model_fields_set and not project.git_provider:
            project.git_provider = detect_git_provider(repo_url)

    if "git_default_branch" in body.model_fields_set:
        branch = (body.git_default_branch or "main").strip() or "main"
        project.git_default_branch = branch

    if "git_subdirectory" in body.model_fields_set:
        project.git_subdirectory = (body.git_subdirectory or "").strip() or None

    if "git_provider" in body.model_fields_set:
        project.git_provider = _validate_git_provider(body.git_provider)

    if body.clear_git_token:
        project.encrypted_git_token = None
    elif "git_token" in body.model_fields_set and body.git_token:
        project.encrypted_git_token = encrypt_secret(body.git_token)

    if "dbt_project_path" in body.model_fields_set:
        project.dbt_project_path = (body.dbt_project_path or "").strip() or None


def delete_project(db: Session, project: Project) -> None:
    remove_project_data_dir(str(project.uuid))
    db.delete(project)
    db.commit()
