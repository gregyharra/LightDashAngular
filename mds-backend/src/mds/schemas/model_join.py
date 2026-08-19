from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ModelJoinCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    source_model_id: str = Field(alias="sourceModelId")
    source_column: str = Field(alias="sourceColumn")
    target_model_id: str = Field(alias="targetModelId")
    target_column: str = Field(alias="targetColumn")
    join_type: str = Field(default="left", alias="joinType")
    relationship: str | None = None
    label: str | None = None


class ModelJoinUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    source_model_id: str | None = Field(default=None, alias="sourceModelId")
    source_column: str | None = Field(default=None, alias="sourceColumn")
    target_model_id: str | None = Field(default=None, alias="targetModelId")
    target_column: str | None = Field(default=None, alias="targetColumn")
    join_type: str | None = Field(default=None, alias="joinType")
    relationship: str | None = None
    label: str | None = None


class ModelJoinView(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    uuid: UUID | None = None
    source_model_id: str = Field(alias="sourceModelId")
    source_model_name: str = Field(alias="sourceModelName")
    source_column: str = Field(alias="sourceColumn")
    target_model_id: str = Field(alias="targetModelId")
    target_model_name: str = Field(alias="targetModelName")
    target_column: str = Field(alias="targetColumn")
    join_type: str = Field(alias="joinType")
    relationship: str | None = None
    label: str | None = None
    sql_on: str = Field(alias="sqlOn")
    origin: str
