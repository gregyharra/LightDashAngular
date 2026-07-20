from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class WarehouseConnectionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    project_uuid: str = Field(alias="projectUuid")
    type: str
    host: str
    port: int
    catalog: str
    schema_name: str = Field(alias="schema")
    user: str
    has_password: bool = Field(alias="hasPassword")
    ssl: bool
    extra_config: dict[str, Any] = Field(default_factory=dict, alias="extraConfig")
    configured: bool


class WarehouseConnectionUpsert(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    type: str = "trino"
    host: str
    port: int = 8080
    catalog: str
    schema_name: str = Field(alias="schema")
    user: str
    password: str | None = None
    clear_password: bool = Field(default=False, alias="clearPassword")
    ssl: bool = False
    extra_config: dict[str, Any] = Field(default_factory=dict, alias="extraConfig")


class WarehouseConnectionTestResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    success: bool
    message: str
