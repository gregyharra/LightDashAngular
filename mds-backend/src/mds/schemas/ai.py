from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class AiChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class AiChatRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    messages: list[AiChatMessage]
    mode: Literal["ask", "edit"] = "ask"
    page_context: str | None = Field(default=None, alias="pageContext")


class AiProposedChart(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    table_name: str = Field(alias="tableName")
    chart_kind: str = Field(alias="chartKind")
    metric_query: dict[str, Any] = Field(alias="metricQuery")
    chart_config: dict[str, Any] = Field(alias="chartConfig")
    sql: str | None = None


class AiChatResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    reply: str
    mode: Literal["ask", "edit"]
    proposed_chart: AiProposedChart | None = Field(default=None, alias="proposedChart")
    tools_used: list[str] = Field(default_factory=list, alias="toolsUsed")
