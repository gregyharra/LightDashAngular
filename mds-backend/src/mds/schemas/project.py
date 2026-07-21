from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

GitProvider = Literal["github", "gitlab", "bitbucket", "generic"]


class ProjectRepoSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    configured: bool
    cloned: bool
    branch: str | None = None
    commit_sha: str | None = Field(default=None, alias="commitSha")
    last_sync_at: str | None = Field(default=None, alias="lastSyncAt")


class ProjectResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    project_uuid: str = Field(alias="projectUuid")
    name: str
    warehouse_type: str = Field(alias="warehouseType")
    warehouse_uuid: str | None = Field(default=None, alias="warehouseUuid")
    warehouse_name: str | None = Field(default=None, alias="warehouseName")
    created_by_user_uuid: str | None = Field(default=None, alias="createdByUserUuid")
    created_at: str = Field(alias="createdAt")
    git_repo_url: str | None = Field(default=None, alias="gitRepoUrl")
    git_default_branch: str = Field(default="main", alias="gitDefaultBranch")
    git_provider: str | None = Field(default=None, alias="gitProvider")
    git_subdirectory: str | None = Field(default=None, alias="gitSubdirectory")
    has_git_token: bool = Field(default=False, alias="hasGitToken")
    dbt_project_path: str | None = Field(default=None, alias="dbtProjectPath")
    repo: ProjectRepoSummary | None = None


class ProjectCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    warehouse_uuid: str | None = Field(default=None, alias="warehouseUuid")
    git_repo_url: str | None = Field(default=None, alias="gitRepoUrl")
    git_default_branch: str = Field(default="main", alias="gitDefaultBranch")
    git_provider: GitProvider | None = Field(default=None, alias="gitProvider")
    git_subdirectory: str | None = Field(default=None, alias="gitSubdirectory")
    git_token: str | None = Field(default=None, alias="gitToken")


class ProjectUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = None
    warehouse_uuid: str | None = Field(default=None, alias="warehouseUuid")
    git_repo_url: str | None = Field(default=None, alias="gitRepoUrl")
    git_default_branch: str | None = Field(default=None, alias="gitDefaultBranch")
    git_provider: GitProvider | None = Field(default=None, alias="gitProvider")
    git_subdirectory: str | None = Field(default=None, alias="gitSubdirectory")
    git_token: str | None = Field(default=None, alias="gitToken")
    clear_git_token: bool = Field(default=False, alias="clearGitToken")


class ProjectRepoStatus(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    configured: bool
    cloned: bool
    clone_path: str | None = Field(default=None, alias="clonePath")
    branch: str | None = None
    default_branch: str = Field(alias="defaultBranch")
    commit_sha: str | None = Field(default=None, alias="commitSha")
    last_sync_at: str | None = Field(default=None, alias="lastSyncAt")
    git_repo_url: str | None = Field(default=None, alias="gitRepoUrl")
    git_provider: str | None = Field(default=None, alias="gitProvider")
    git_subdirectory: str | None = Field(default=None, alias="gitSubdirectory")
    dbt_project_path: str | None = Field(default=None, alias="dbtProjectPath")
