from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class WarehouseResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    warehouse_uuid: str = Field(alias="warehouseUuid")
    organization_uuid: str = Field(alias="organizationUuid")
    name: str
    type: str
    host: str
    port: int
    catalog: str
    schema_name: str = Field(alias="schema")
    user: str
    has_password: bool = Field(alias="hasPassword")
    ssl: bool
    extra_config: dict[str, Any] = Field(default_factory=dict, alias="extraConfig")
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")


class WarehouseListItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    warehouse_uuid: str = Field(alias="warehouseUuid")
    name: str
    type: str
    host: str
    port: int
    catalog: str
    schema_name: str = Field(alias="schema")
    has_password: bool = Field(alias="hasPassword")
    updated_at: str = Field(alias="updatedAt")


class WarehouseCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    type: str = "trino"
    host: str
    port: int = 8080
    catalog: str
    schema_name: str = Field(alias="schema")
    user: str
    password: str | None = None
    ssl: bool = False
    extra_config: dict[str, Any] = Field(default_factory=dict, alias="extraConfig")


class WarehouseUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = None
    type: str | None = None
    host: str | None = None
    port: int | None = None
    catalog: str | None = None
    schema_name: str | None = Field(default=None, alias="schema")
    user: str | None = None
    password: str | None = None
    clear_password: bool = Field(default=False, alias="clearPassword")
    ssl: bool | None = None
    extra_config: dict[str, Any] | None = Field(default=None, alias="extraConfig")


class WarehouseTestResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    success: bool
    message: str
