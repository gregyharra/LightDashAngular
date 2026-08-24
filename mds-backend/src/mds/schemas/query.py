from __future__ import annotations

import re
from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator

_IDENTIFIER_PATTERN = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


class TimeTravelConfig(BaseModel):
    as_of_timestamp: str = Field(alias="asOfTimestamp")
    table_format: Literal["iceberg", "delta"] | None = Field(default=None, alias="tableFormat")

    model_config = {"populate_by_name": True}


class MetricExprField(BaseModel):
    type: Literal["field"]
    field_id: str = Field(alias="fieldId")

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class MetricExprLiteral(BaseModel):
    type: Literal["literal"]
    value_type: Literal["number"] = Field(alias="valueType")
    value: float | int

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class MetricExprBinary(BaseModel):
    type: Literal["binary"]
    op: Literal["+", "-", "*", "/"]
    left: "MetricExpr"
    right: "MetricExpr"

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class MetricExprCall(BaseModel):
    type: Literal["call"]
    fn: Literal["coalesce", "nullif", "abs", "round"]
    args: list["MetricExpr"]

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class MetricExprAgg(BaseModel):
    type: Literal["agg"]
    op: Literal["sum", "count", "count_distinct", "avg", "min", "max"]
    arg: "MetricExpr"

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


MetricExpr = Annotated[
    Union[MetricExprField, MetricExprLiteral, MetricExprAgg, MetricExprBinary, MetricExprCall],
    Field(discriminator="type"),
]


class AdditionalMetric(BaseModel):
    name: str
    label: str
    table_name: str = Field(alias="tableName")
    base_dimension_name: str | None = Field(default=None, alias="baseDimensionName")
    expr: MetricExpr

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    @field_validator("name", "table_name")
    @classmethod
    def validate_identifier(cls, value: str) -> str:
        if not _IDENTIFIER_PATTERN.match(value):
            raise ValueError(f"Invalid identifier: {value}")
        return value


class MetricQuery(BaseModel):
    explore_name: str = Field(alias="exploreName")
    dimensions: list[str]
    metrics: list[str]
    filters: dict[str, Any] = Field(default_factory=dict)
    sorts: list[dict[str, Any]] = Field(default_factory=list)
    limit: int = 500
    table_calculations: list[Any] = Field(default_factory=list, alias="tableCalculations")
    additional_metrics: list[AdditionalMetric] = Field(default_factory=list, alias="additionalMetrics")
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
    bypass_cache: bool = Field(default=False, alias="bypassCache")

    model_config = {"populate_by_name": True}

    def resolved_query(self) -> MetricQuery:
        if self.query is not None:
            return self.query
        if self.metric_query is not None:
            return self.metric_query
        raise ValueError("Missing metric query payload")
