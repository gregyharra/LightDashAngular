from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class TimeTravelConfig(BaseModel):
    as_of_timestamp: str = Field(alias="asOfTimestamp")
    table_format: Literal["iceberg", "delta"] | None = Field(default=None, alias="tableFormat")

    model_config = {"populate_by_name": True}


class MetricQuery(BaseModel):
    explore_name: str = Field(alias="exploreName")
    dimensions: list[str]
    metrics: list[str]
    filters: dict[str, Any] = Field(default_factory=dict)
    sorts: list[dict[str, Any]] = Field(default_factory=list)
    limit: int = 500
    table_calculations: list[Any] = Field(default_factory=list, alias="tableCalculations")
    additional_metrics: list[Any] = Field(default_factory=list, alias="additionalMetrics")
    timezone: str | None = None
    time_travel: TimeTravelConfig | None = Field(default=None, alias="timeTravel")

    model_config = {"populate_by_name": True}


class QueryWarning(BaseModel):
    code: str
    message: str
    severity: Literal["info", "warning", "error"]


class MetricQueryRequest(BaseModel):
    query: MetricQuery | None = None
    metric_query: MetricQuery | None = Field(default=None, alias="metricQuery")

    model_config = {"populate_by_name": True}

    def resolved_query(self) -> MetricQuery:
        if self.query is not None:
            return self.query
        if self.metric_query is not None:
            return self.metric_query
        raise ValueError("Missing metric query payload")
