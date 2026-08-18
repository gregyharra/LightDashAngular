from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from mds.schemas.query import MetricQuery


class ExportRequest(BaseModel):
    metric_query: MetricQuery = Field(alias="metricQuery")
    format: Literal["csv", "xlsx"]
    override_row_cap: bool = Field(default=False, alias="overrideRowCap")
    filename_base: str | None = Field(default=None, alias="filenameBase")

    model_config = ConfigDict(populate_by_name=True)
