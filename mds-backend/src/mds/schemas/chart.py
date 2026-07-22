from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CreateSavedChartPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    description: str | None = None
    space_uuid: UUID | None = Field(default=None, alias="spaceUuid")
    table_name: str = Field(alias="tableName")
    chart_kind: str = Field(alias="chartKind")
    metric_query: dict[str, Any] = Field(alias="metricQuery")
    chart_config: dict[str, Any] = Field(alias="chartConfig")


class UpdateSavedChartPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = None
    description: str | None = None
    space_uuid: UUID | None = Field(default=None, alias="spaceUuid")
    table_name: str | None = Field(default=None, alias="tableName")
    chart_kind: str | None = Field(default=None, alias="chartKind")
    metric_query: dict[str, Any] | None = Field(default=None, alias="metricQuery")
    chart_config: dict[str, Any] | None = Field(default=None, alias="chartConfig")
