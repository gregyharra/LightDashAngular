from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UpdatedByUserSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    user_uuid: UUID = Field(alias="userUuid")
    first_name: str = Field(alias="firstName")
    last_name: str = Field(alias="lastName")


class DashboardTabSchema(BaseModel):
    uuid: UUID
    name: str
    order: int
    hidden: bool | None = None


class CreateDashboardPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    description: str | None = None
    space_uuid: UUID | None = Field(default=None, alias="spaceUuid")
    tabs: list[DashboardTabSchema] | None = None
    tiles: list[dict[str, Any]] | None = None


class UpdateDashboardPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = None
    description: str | None = None
    tabs: list[DashboardTabSchema] | None = None
    tiles: list[dict[str, Any]] | None = None
